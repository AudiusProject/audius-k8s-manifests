# Audius Service Providers

This guide describes how to run Audius services on a single node Kubernetes cluster. 

### 1. Cluster Setup

Follow the installation notes [here](./cluster-setup.md) to provision a basic a single node cluster.

### 2. Alias k to kubectl (optional)
Bash completion for Kubernetes is a must. Add the below to your `~/.bash_profile`.
```
alias k=kubectl
source <(kubectl completion bash | sed s/kubectl/k/g)
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

See below for a guide to deploying [Creator Node](#creator-node) and [Discovery Provider](#discovery-provider) via `kubectl`.

### 5. Logger

See the [Logger](#logger) section below for instructions on setting up the logger

---
## Creator Node

An Audius Creator Node maintains the availability of creators' content on IPFS.
The information stored includes Audius user metadata, images, and audio content.
The content is backed by either AWS S3 or a local directory.

> **Note**
> In the future, the service will be extended to handle proxy re-encryption requests from end-user clients
> and support other storage backends.

#### Run

1. Install service and volume objects
```
k apply -f audius/creator-node/creator-node-svc.yaml
k apply -f audius/creator-node/creator-node-pvc.yaml
```

2. Deploy creator node ipfs
```
k apply -f audius/creator-node/creator-node-deploy-ipfs.yaml
```

3. Before deploying creator node backend, we must obtain IPFS running host IP and service nodePort, so we can pass that config to creator node.

> NOTE If you only have an "InternalIP", ensure your cluster node has an externally accessible network interface

```
# IPFS_CLUSTER_IP
kubectl get node $(kubectl -n default get pod -l release=creator-node,tier=ipfs -o=jsonpath='{.items[0].spec.nodeName}') -o=jsonpath='{.status.addresses[?(@.type=="ExternalIP")].address}'

# IPFS_CLUSTER_PORT
kubectl -n default get svc creator-node-ipfs-svc -o=jsonpath='{.spec.ports[?(@.name=="swarm")].nodePort}'
```

4. Update creator node backend config map with the above values
```
# creator-node-cm.yaml
...
  ipfsClusterIP: "<ip-from-above>"
  ipfsClusterPort: "<port-from-above>"
```

5. Install updated config map
```
k apply -f audius/creator-node/creator-node-cm.yaml
```

6. Deploy creator node backend
```
k apply -f audius/creator-node/creator-node-deploy-backend.yaml
```

7. Configure Firewall. IPFS swarm port and creator node web server port must be accessible.
> **DO NOT** open the ipfs "api" port.
```
# IPFS_CLUSTER_PORT
kubectl get svc creator-node-ipfs-svc -o=jsonpath='{.spec.ports[?(@.name=="swarm")].nodePort}'

# CREATOR_NODE_PORT
kubectl get svc creator-node-backend-svc -o=jsonpath='{.spec.ports[0].nodePort}'
```

8. Health check
```
curl localhost:<CREATOR_NODE_PORT>/health_check
curl <CREATOR_NODE_PORT>/ipfs_peer_info
```

#### Upgrade
To add/change environment variables, follow steps 4 and 5 in the Run section above.

To upgrade your Creator Node to the newest version, follow steps 6 and 8. Step 7 doesn't usually need to be run, except for the first time.


---

## Discovery Provider

An Audius Discovery Provider indexes the contents of the Audius contracts on the Ethereum blockchain for clients to query.
The indexed content includes user, track, and album/playlist information along with social features.
The data is stored for quick access, updated on a regular interval, and made available for clients via a RESTful API.


#### Run

1. Install config map, service and volume objects
```
k apply -f audius/discovery-provider/discovery-provider-cm.yaml
k apply -f audius/discovery-provider/discovery-provider-svc.yaml
k apply -f audius/discovery-provider/discovery-provider-pvc.yaml
```

2. Deploy discovery provider stack, with workers disabled (prepares for db seed)
```
k apply -f audius/discovery-provider/discovery-provider-deploy-no-workers.yaml
```

3. Seed discovery provider db (speeds up chain indexing significantly)
```
k apply -f audius/discovery-provider/discovery-provider-db-seed-job.yaml
k wait --for=condition=complete job/discovery-provider-db-seed-job
```

4. When seed job completes, start chain indexing workers
```
k apply -f audius/discovery-provider/discovery-provider-deploy.yaml
```

5. Get service nodePort
```
kubectl get service discovery-provider-backend-svc
```

6. Health check
```
curl <host>:<svc-nodePort>/health_check
```

#### Upgrade
To add/change environment variables, edit the filie `audius/discovery-provider/discovery-provider-cm.yaml` and run `k apply -f audius/discovery-provider/discovery-provider-cm.yaml`.

To upgrade your Discovery Provider to the newest version, run the command in step 4.

## Logger

In order to assist with any debugging. We provide a central logging service that you may publish to.

#### Run

First, obtain the service provider secrets from your contact at Audius. This contains the required token(s) for logging to function. And apply the secret with

```
kubectl apply -f <secret_from_audius>.yaml
```

Next, update the logger tags in the fluentd daemonset with your name, so we can identify you. Replace `<SERVICE_PROVIDER_NAME>` with your name here: https://github.com/AudiusProject/audius-k8s-manifests/blob/master/audius/logger/logger.yaml#L208

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
