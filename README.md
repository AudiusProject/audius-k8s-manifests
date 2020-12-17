# Audius Service Providers

This guide describes how to run Audius services on a single node Kubernetes cluster. Notes about multi node clusters are given as relevant.

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

See below for a guide to deploying [Creator Node](#creator-node-1) and [Discovery Provider](#discovery-provider-1) via `kubectl`. After you finish setting up the service, please continue with the Logger section.

Note - the "Creator Node" and "Discovery Provider" have recently been renamed "Content Node" and "Discovery Node" respectively. However for consistency within the code and this README, we will continue use the terms "Creator Node" and "Discovery Node" here.

### 5. Logger

See the [Logger](#logger) section below for instructions on setting up the logger

### 6. Security & Infrastructure configuration

1.) In order for clients to talk to your service, you'll need to expose two ports: the web server port and the IPFS swarm port. In order to find these ports, run `kubectl get svc`. The web server port is mapped to 4000 for creator node and 5000 for discovery provider. The IPFS swarm port is mapped to 4001

```
kubectl get svc

NAME                             TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                                        AGE
discovery-provider-backend-svc   NodePort    10.98.78.108    <none>        5000:31744/TCP                                 18h
discovery-provider-cache-svc     ClusterIP   10.101.94.71    <none>        6379/TCP                                       18h
discovery-provider-db-svc        ClusterIP   10.110.50.147   <none>        5432/TCP                                       18h
discovery-provider-ipfs-svc      NodePort    10.106.89.157   <none>        4001:30480/TCP,5001:30499/TCP,8080:30508/TCP   18h
kubernetes                       ClusterIP   10.96.0.1       <none>        443/TCP                                        7d5h

In this case, the web server port is 31744 and the IPFS port is 30480.
```

2.) Once you expose these ports, you should be able to publicly hit the health check via the public IP of your instance or load balancer. The next step is to register a DNS record. It's recommended that you map the web server port the DNS and have a domain or subdomain for each service you're running. Also make sure traffic is not allowed without HTTPS. All non HTTPS traffic should redirect to the HTTPS port.

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

IPFS has some trouble identifying the public host and port inside Kubernetes, so we need to manually set the host and port in the public "Announce" address. This is why we need a node selector for multi node kubernetes deployments, to ensure that the IPFS node does not move. Run the command below to set the Announce address

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

4.) Set load balancer timeouts. Minimum timeouts are 1 hour (3600 seconds) for Creator Node requests and 1 minutes (60 seconds) for Discovery Provider requests. Track uploads especially for larger files can take several minutes to complete. 

5.) In addition to configuring your security groups to restrict access to just the web server and IPFS swarm port (4001), 
it's recommended that your server or load balancer is protected from DoS attacks. Services like Cloudfront and Cloudflare offer free or low cost services to do this. It would also be possible to use iptables to configure protection as laid out here https://javapipe.com/blog/iptables-ddos-protection/. Please make sure proxies don't override the timeouts from Step 4.

### 7. Pre-registration checks

Before registering a service to the dashboard we need to make sure the service is properly configured. Follow the checks below for the type of service you're configuring. Failure to verify that all of these work properly could cause user actions to fail and may lead to slashing actions.

The `sp-actions/` folder contains scripts that test the health of services. Run the corresponding checks for your service type below to verify your service is correctly sete up. Be sure to run `npm install` in `sp-actions/` to install all depdencies.

For more information about `sp-actions/` see the README in the [sp-actions/ folder](https://github.com/AudiusProject/audius-k8s-manifests/tree/master/sp-utilities)

#### Creator Node

```bash
➜ pwd
/Audius/audius-k8s-manifests/sp-utilities/creator-node

# entering creatorNodeEndpoint and delegatePrivateKey sends those values as env vars to the script without having to export to your terminal
➜ creatorNodeEndpoint=https://creatornode.domain.co delegatePrivateKey=5e468bc1b395e2eb8f3c90ef897406087b0599d139f6ca0060ba85dcc0dce8dc node healthChecks.js
Starting tests now. This may take a few minutes.
✓ Health check passed
✓ DB health check passed
✓ Heartbeat duration health check passed
! Non-heartbeat duration health check timed out at 180 seconds with error message: "Request failed with status code 504". This is not an issue.
All checks passed!

```

If you see the message "Error running script" this script did not finish successfully. If you see "All checks passed!" this script finished successfully.

#### Discovery Provider

```bash
➜ discoveryProviderEndpoint=https://discoveryprovider.domain.co node healthChecks.js
✓ Health check passed
All checks passed!
```

If you see the message "Error running script" this script did not finish successfully. If you see "All checks passed!" this script finished successfully.

### 8. Register the service on the dashboard

Since you've completed all the steps thus far, you're about ready to register!

You can register via the dashboard on https://dashboard.audius.org

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

3.) Update Creator Node backend config map with the env vars. Make sure all required environment variables are exposed. The  full list of env vars and explanations can be found on the wiki [here](https://github.com/AudiusProject/audius-protocol/wiki/Content-Node:-Configuration-Details#required-environment-variables)
```
# creator-node-cm.yaml
...
  spOwnerWallet: "<address of wallet that contains audius tokens>
  delegateOwnerWallet: "<address of wallet that contains no tokens but that is registered on chain>"
  delegatePrivateKey: "<private key>"
  creatorNodeEndpoint: "<your service url>"

Note - if you haven't registered the service yet, please enter the url you plan to register in the creatorNodeEndpoint field.
```

4.) Install updated config map
```
k apply -f audius/creator-node/creator-node-cm.yaml
```

5.) Deploy Creator Node backend
```
k apply -f audius/creator-node/creator-node-deploy-backend.yaml
```

6.) Health check

Run a health check locally. To get the port that's exposed to the host, run `kubectl get svc`. The port that's mapped to the web server port 4000 is the port referenced below.
```
curl localhost:<CREATOR_NODE_PORT>/health_check
curl localhost:<CREATOR_NODE_PORT>/ipfs_peer_info
```

#### Upgrade

To upgrade your service, you will need to pull the latest manifest code. First, `git stash` your local changes to preserve configs. Then run `git pull` to fetch the latest code. Finally run `git stash apply` to re-apply your configs onto the latest code.

Make sure your local configs are present in the `audius/creator-node/creator-node-cm.yaml` file before moving on to the next step.

Now re-run steps 4 and 5 from above to propagate these changes to your service.

Confirm that the version and gitsha have been updated through the `/health_check` endpoint.


---

## Discovery Provider

An Audius Discovery Provider indexes the contents of the Audius contracts on the Ethereum blockchain for clients to query.
The indexed content includes user, track, and album/playlist information along with social features.
The data is stored for quick access, updated on a regular interval, and made available for clients via a RESTful API.


#### Run
1.) Update the `audius/discovery-provider/discovery-provider-cm.yaml` with values for `audius_delegate_owner_wallet` and `audius_delegate_private_key`.

Note - If you are using an external managed Postgres database (version 11.1+), enter the db url into the `audius_db_url` and the `audius_db_url_read_replica` fields. If there's no read replica, enter the primary db url for both env vars.

Make sure that your service exposes all the required environment variables. See wiki [here](https://github.com/AudiusProject/audius-protocol/wiki/Discovery-Node:-Configuration-Details#required-environment-variables) for full list of env vars and descriptions.

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

To upgrade your service, you will need to pull the latest manifest code. First, `git stash` your local changes to preserve configs. Then run `git pull` to fetch the latest code. Finally run `git stash apply` to re-apply your configs onto the latest code.

Make sure your local configs are present in the `audius/discovery-provider/discovery-provider-cm.yaml` file before moving on to the next step.

Now, re-run `k apply -f audius/discovery-provider/discovery-provider-cm.yaml` and `k apply -f audius/discovery-provider/discovery-provider-deploy.yaml` to apply the changes to your running service.

Confirm that the version and gitsha have been updated through the `/health_check` endpoint.

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

Next, update the logger tags in the fluentd daemonset with your name, so we can identify you and your service uniquely here: https://github.com/AudiusProject/audius-k8s-manifests/blob/master/audius/logger/logger.yaml#L207. This allows our logging service to filter logs by service provider and by service provider and service. `SP_NAME` refers to your organization's name and `SP_NAME_TYPE_ID` refers to your organization's name plus the type of service you're running, plus an id to distinguish multiple services of the same type.

For example, if your name is `Awesome Operator` and you're running a content node, set the tags as:
```
...
env:
- name: LOGGLY_TAGS
  value: external,Awesome-Operator,Awesome-Operator-Content-1
```
The number at the end of the last tag (`Awesome-Operator-Content-1`) is used if you have more than one content node or discovery node, so you can identify each service uniquely. For example, if you run two content nodes, on your second content node, you can set the tags as:
```
...
env:
- name: LOGGLY_TAGS
  value: external,Awesome-Operator,Awesome-Operator-Content-2
```

Once you've updated the tags, apply the fluentd logger stack with the command:

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

Once you've finished setting up the logger, continue to the [security](#6-security-infrastructure-configuration) section.