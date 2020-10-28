# Audius Service Providers

This guide describes how to run Audius services on a single node Kubernetes cluster. Notes about multi node clusters are given as necessary.

### 1. Cluster Setup

A convenience script is also included to do a "one click" kubeadm node setup. You can run 
```
yes | sh setup.sh
```

However, if the node setup is not successful and kubectl is not available, it's advised to follow the installation steps by hand [here](./cluster-setup.md).

### 2. Alias k to kubectl (optional)
Bash completion for Kubernetes is a must. Add the below to your `~/.bash_profile`.
```
# alias k to kubectl
alias k=kubectl

# this command should not throw an error kubernetes is properly configured and aliased
k get pods
```


### 3. Storage

Provision a shared host directory for persistent storage.

```
mkdir -p /var/k8s

# if sudo was required, you will need to change ownership of this dir
sudo chown <user>:<group> /var/k8s
```

**NOTE**

Storage will persist on the host even after deleting `pv,pvc` objects.<br>
Hence, to nuke all data and start clean be sure to run..
```
rm -rf /var/k8s/*
```

### 4. Setup Service

See below for a guide to deploying [Creator Node](#creator-node) and [Discovery Provider](#discovery-provider) via `kubectl`. After you finish setting up the service, please continue with the Logger section.

Note - the "Creator Node" and "Discovery Provider" have recently been renamed "Content Node" and "Discovery Node" respectively. However for consistency within the code and this README, we will continue use the terms "Creator Node" and "Discovery Node" here.

### 5. Logger

See the [Logger](#logger) section below for instructions on setting up the logger

### 6. Security & Infrastructure configuration

1.) In order for clients to talk to your service, you'll need to expose two ports: the web server port and the IPFS swarm port. In order to find these ports, run `kubectl get svc`. The web server port is mapped to 4000 for creator node and 5000 for discovery provider. The IPFS swarm port is mapped to 4001

```
NAME                             TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                                        AGE
discovery-provider-backend-svc   NodePort    10.98.78.108    <none>        5000:31744/TCP                                 18h
discovery-provider-cache-svc     ClusterIP   10.101.94.71    <none>        6379/TCP                                       18h
discovery-provider-db-svc        ClusterIP   10.110.50.147   <none>        5432/TCP                                       18h
discovery-provider-ipfs-svc      NodePort    10.106.89.157   <none>        4001:30480/TCP,5001:30499/TCP,8080:30508/TCP   18h
kubernetes                       ClusterIP   10.96.0.1       <none>        443/TCP                                        7d5h

In this case, the web server port is 31744 and the IPFS port is 30480.
```

2.) Once you expose these ports, you should be able to publicly hit the health check via the public IP of your instance or load balancer. The next step is to register a DNS record. It's recommended that you map the web server port to port 443. Also make sure traffic is not allowed without HTTPS. All non HTTPS traffic should redirect to the HTTPS port.

3.) Now we will configure IPFS. 

If you are using a multi-node Kubernetes deployment, you'll need to first attach a nodeSelector to the IPFS deployment. In either the [creator node deployment](https://github.com/AudiusProject/audius-k8s-manifests/blob/master/audius/creator-node/creator-node-deploy-ipfs.yaml) or [discovery provider deployment](https://github.com/AudiusProject/audius-k8s-manifests/blob/master/audius/discovery-provider/discovery-provider-deploy.yaml) templates, modify the template to add the nodeSelector. See example below

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: discovery-provider-ipfs
  namespace: default
spec:
  selector:
    matchLabels:
      release: discovery-provider
      tier: ipfs
      
  replicas: 1
  
  template:
    metadata:
      labels:
        release: discovery-provider
        tier: ipfs
        
      annotations:
        checksum/config: 2c3c0976bd0ded5df1835e1e093b20769ec8e20378de4be0ef0a85dc50e15730
    spec:
      
      # add the following two lines along with your host
      nodeSelector:
        kubernetes.io/hostname: "your host here"
```

The last step to configuring IPFS is setting the Announce address. IPFS has some trouble identifying the public host and port inside Kubernetes, so we need to manually set the host and port. This is why we need a node selector. Run the command below to set the Announce address

```
k exec -it <ipfs pod name> -- ipfs config --json Addresses.Announce '["/ip4/<public ip>/tcp/<public ipfs port 4001>"]'
<ipfs pod name> can be found by running `kubectl get pods`
The <public ip> and <public ipfs port 4001> are the same values from section 1 that were exposed publicly.
```

Delete the ipfs pod by running `kubectl delete pod <ipfs pod name>` to restart ipfs. Once it comes up, get the new ipfs pod name and run `kubectl exec <ipfs pod name> --- ipfs id` and verify that it's been updated with the correct values in the Address[0] field. In order to confirm the connection, copy the value from the Address[0] field and from a new host or local, run the following command `docker exec <container name> ipfs swarm connect <Address[0]>`
```
➜ docker run -d ipfs/go-ipfs:release 
9fcc86b09f1852817b0bfe0618092546b3b3463cff2856a57911e10f738652c2

➜ docker exec 9fcc86b09f1852817b0bfe0618092546b3b3463cff2856a57911e10f738652c2 ipfs swarm connect /ip4/55.67.121.184/tcp/31276/ipfs/QmQsZ5wqmV1rVxPYjsBQWYtEV5BAqzqwE2ff8Q522xr4Ys
connect QmQsZ5wqmV1rVxPYjsBQWYtEV5BAqzqwE2ff8Q522xr4Ys success
```

4.) Set load balancer timeouts. Minimum timeouts are 1 hour (3600 seconds) for Creator Node requests and 10 minutes (60 seconds) for Discovery Provider requests. Track uploads especially for larger files can take several minutes to complete. 

5.) In addition to configuring your security groups to restrict access to just the web server and IPFS swarm port (4001), 
it's recommended that your server or load balancer is protected from DoS attacks. Services like Cloudfront and Cloudflare offer free or low cost services to do this. It would also be possible to use iptables to configure protection as laid out here https://javapipe.com/blog/iptables-ddos-protection/. Please make sure proxies don't affect additional timeouts that override those from Step 4.

### 7. Register the service on the dashboard

Since you've completed all the steps thus far, you're about ready to register! The last step is to hit the health check for your node via the DNS. 

`https://<your-service-url>/health_check`

For a Creator Node, one of the fields you should see is spID. If you see an spID > 0, your service is up and healthy.

For a Discovery Provider, if your blockDiff = 0, your service is up and healthy.

After you've verified a healthy response, you can register via the dashboard on https://dashboard.audius.co


---
## Creator Node

An Audius Creator Node maintains the availability of creators' content on IPFS.
The information stored includes Audius user metadata, images, and audio content.
The content is backed by a local directory.

> **Note**
> In the future, the service will be extended to handle proxy re-encryption requests from end-user clients
> and support other storage backends.

#### Run

1.) Install service and volume objects
```
k apply -f audius/creator-node/creator-node-svc.yaml
k apply -f audius/creator-node/creator-node-pvc.yaml
```

2.) Deploy Creator Node ipfs
```
k apply -f audius/creator-node/creator-node-deploy-ipfs.yaml
```

3.) Before deploying Creator Node backend, we must obtain IPFS running host IP and service nodePort, so we can pass that config to Creator Node.

> NOTE If you only have an "InternalIP", ensure your cluster node has an externally accessible network interface

```
# IPFS_CLUSTER_IP
kubectl get node $(kubectl -n default get pod -l release=creator-node,tier=ipfs -o=jsonpath='{.items[0].spec.nodeName}') -o=jsonpath='{.status.addresses[?(@.type=="ExternalIP")].address}'

# IPFS_CLUSTER_PORT
kubectl -n default get svc creator-node-ipfs-svc -o=jsonpath='{.spec.ports[?(@.name=="swarm")].nodePort}'
```

4.) Update Creator Node backend config map with the env vars. The  full list of env vars and explanations can be found on the wiki [here](https://github.com/AudiusProject/audius-protocol/wiki/Content-Node-%E2%80%90-How-to-run#required-environment-variables)
```
# creator-node-cm.yaml
...
  spOwnerWallet: "<address of wallet that contains audius tokens>
  delegateOwnerWallet: "<address of wallet that contains no tokens but that is registered on chain>"
  delegatePrivateKey: "<private key>"
  creatorNodeEndpoint: "<your service url>"

Note - if you haven't registered the service yet, please enter the url you plan to register in the creatorNodeEndpoint field.
```

5.) Install updated config map
```
k apply -f audius/creator-node/creator-node-cm.yaml
```

6.) Deploy Creator Node backend
```
k apply -f audius/creator-node/creator-node-deploy-backend.yaml
```

7.) Health check

Run a health check locally. To get the port that's exposed to the host, run `kubectl get svc`. The port that's mapped to the web server port 4000 is the port referenced below.
```
curl localhost:<CREATOR_NODE_PORT>/health_check
curl localhost:<CREATOR_NODE_PORT>/ipfs_peer_info
```

#### Upgrade
To upgrade your creator node to the latest version, first check that your service exposes all the required environment variables. Full list of required and optional env vars can be found [here](https://github.com/AudiusProject/audius-protocol/wiki/Content-Node-%E2%80%90-How-to-run#required-environment-variables). Follow steps 4 and 5 in the Run section above to add and apply environment variables.

Then, to upgrade the deployment to the latest version, follow steps 6 and 8. Step 7 does not usually need to be run, except for the first time.


---

## Discovery Provider

An Audius Discovery Provider indexes the contents of the Audius contracts on the Ethereum blockchain for clients to query.
The indexed content includes user, track, and album/playlist information along with social features.
The data is stored for quick access, updated on a regular interval, and made available for clients via a RESTful API.


#### Run
1.) Update the `audius/discovery-provider/discovery-provider-cm.yaml` with values for `audius_delegate_owner_wallet` and `audius_delegate_private_key`.

Note - If you are using an external managed Postgres database (version 11.1+), enter the db url into the `audius_db_url` and the `audius_db_url_read_replica` fields. If there's no read replica, enter the primary db url for both env vars.

See wiki [here](https://github.com/AudiusProject/audius-protocol/wiki/Discovery-Node-%E2%80%90-How-to-run#required-environment-variables) for full list of env vars and descriptions.

2.) Install config map, service and volume objects
```
k apply -f audius/discovery-provider/discovery-provider-cm.yaml
k apply -f audius/discovery-provider/discovery-provider-svc.yaml
k apply -f audius/discovery-provider/discovery-provider-pvc.yaml
```

3.) Deploy discovery provider stack, with workers disabled (prepares for db seed)
```
k apply -f audius/discovery-provider/discovery-provider-deploy-no-workers.yaml
```

4.) Seed discovery provider db (speeds up chain indexing significantly)
```
k apply -f audius/discovery-provider/discovery-provider-db-seed-job.yaml
k wait --for=condition=complete job/discovery-provider-db-seed-job
```

5.) When seed job completes, start chain indexing workers
```
k apply -f audius/discovery-provider/discovery-provider-deploy.yaml
```

6.) Get service nodePort
```
kubectl get service discovery-provider-backend-svc
```

7.) Health check
Run a health check locally. To get the port that's exposed to the host, run `kubectl get svc`. The port that's mapped to the web server port 5000 is the port referenced below.
```
curl localhost:<DISCOVERY_PORT>/health_check
```

#### Upgrade
To upgrade your discovery provider to the latest version, first check that your service exposes all the required environment variables. Full list of required and optional env vars can be found [here](https://github.com/AudiusProject/audius-protocol/wiki/Discovery-Node-%E2%80%90-How-to-run#required-environment-variables). Edit the file `discovery-provider-cm.yaml` and run the command `k apply -f audius/discovery-provider/discovery-provider-cm.yaml` to apply the environment variables

Then, to upgrade the deployment to the latest version, run the command in step 5.

### Next

Once you've finished setting up the Discovery Provider, continue to the [Logger](#logger) section.


---

## Logger

In order to assist with any debugging. We provide a logging service that you may publish to.

#### Run

First, obtain the service provider secrets from your contact at Audius. This contains the required token(s) for logging to function. And apply the secret with

```
kubectl apply -f <secret_from_audius>.yaml
```

Next, update the logger tags in the fluentd daemonset with your name, so we can identify you. Replace `<SERVICE_PROVIDER_NAME>` with your name and `<SERVICE_TYPE_ID>` with the type of service and an id like `CREATOR_1` or `DISCOVERY_3` here: https://github.com/AudiusProject/audius-k8s-manifests/blob/master/audius/logger/logger.yaml#L208

Now, apply the fluentd logger stack.

```
kubectl apply -f audius/logger/logger.yaml
```

#### Upgrade
There are two commands to upgrade the logging stack.
```
kubectl apply -f audius/logger/logger.yaml

kubectl -n kube-system delete pod $(kubectl -n kube-system get pods | grep "fluentd" | awk '{print $1}')
```

### Next

Once you've finished setting up the logger, continue to the [security](#6-security) section.