# Audius Service Providers

Bash completion for Kubernetes is a must. Add the below to your `~/.bash_profile`.
```
alias k=kubectl
source <(kubectl completion bash | sed s/kubectl/k/g)
```

See below for a guide to deploying [Creator Node](#creator-node) and [Discovery Provider](#discovery-provider) via `kubectl`.


### Cluster Setup

Follow the installation notes [here](./cluster-setup.md) to provision a basic a single node cluster.


### Storage

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


## Creator Node

An Audius Creator Node maintains the availability of creators' content on IPFS.
The information stored includes Audius user metadata, images, and audio content.
The content is backed by either AWS S3 or a local directory.

> **Note**
> In the future, the service will be extended to handle proxy re-encryption requests from end-user clients
> and support other storage backends.

---

#### Run

Install service and volume objects
```
k apply -f audius/creator-node/creator-node-svc.yaml
k apply -f audius/creator-node/creator-node-pvc.yaml
```

Deploy creator node ipfs
```
k apply -f audius/creator-node/creator-node-deploy-ipfs.yaml
```

Before deploying creator node backend, we must obtain IPFS running host IP and service nodePort, so we can pass that config to creator node.

> NOTE If you only have an "InternalIP", ensure your cluster node has an externally accessible network interface

```
# IPFS_CLUSTER_IP
kubectl get node $(kubectl -n default get pod -l release=creator-node,tier=ipfs -o=jsonpath='{.items[0].spec.nodeName}') -o=jsonpath='{.status.addresses[?(@.type=="ExternalIP")].address}'

# IPFS_CLUSTER_PORT
kubectl -n default get svc creator-node-ipfs-svc -o=jsonpath='{.spec.ports[?(@.name=="swarm")].nodePort}'
```

Update creator node backend config map with the above values
```
# creator-node-cm.yaml
...
  ipfsClusterIP: "<ip-from-above>"
  ipfsClusterPort: "<port-from-above>"
```

Install updated config map
```
k apply -f audius/creator-node/creator-node-cm.yaml
```

Deploy creator node backend
```
k apply -f audius/creator-node/creator-node-deploy-backend.yaml
```

Configure Firewall. IPFS swarm port and creator node web server port must be accessible.
> **DO NOT** open the ipfs "api" port.
```
# IPFS_CLUSTER_PORT
kubectl get svc creator-node-ipfs-svc -o=jsonpath='{.spec.ports[?(@.name=="swarm")].nodePort}'

# CREATOR_NODE_PORT
kubectl get svc creator-node-backend-svc -o=jsonpath='{.spec.ports[0].nodePort}'
```

Health check
```
curl <creator-node-dns-address>/health_check
curl <creator-node-dns-address>/ipfs_peer_info
```


## Discovery Provider

An Audius Discovery Provider indexes the contents of the Audius contracts on the Ethereum blockchain for clients to query.
The indexed content includes user, track, and album/playlist information along with social features.
The data is stored for quick access, updated on a regular interval, and made available for clients via a RESTful API.

---

#### Run

Install config map, service and volume objects
```
k apply -f audius/discovery-provider/discovery-provider-cm.yaml
k apply -f audius/discovery-provider/discovery-provider-svc.yaml
k apply -f audius/discovery-provider/discovery-provider-pvc.yaml
```

Deploy discovery provider stack, with workers disabled (prepares for db seed)
```
k apply -f audius/discovery-provider/discovery-provider-deploy-no-workers.yaml
```

Seed discovery provider db (speeds up chain indexing significantly)
```
k apply -f audius/discovery-provider/discovery-provider-db-seed-job.yaml
k wait --for=condition=complete job/discovery-provider-db-seed-job
```

When seed job completes, start chain indexing workers
```
k apply -f audius/discovery-provider/discovery-provider-deploy.yaml
```

Get service nodePort
```
kubectl get service discovery-provider-backend-svc
```

Health check
```
curl <host>:<svc-nodePort>/health_check
```
