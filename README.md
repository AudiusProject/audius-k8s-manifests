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

> **Docker For Mac**<br>
> Make /var/k8s available in Docker Preferences > File Sharing.<br>
> Note, due to a macOS bug, you may have to input this path manually rather than using the dropdown file picker.

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

Deploy persistent storage.
```
kubectl apply -f audius/creator-node/creator-node-pvc.yaml
```

Deploy service and config map objects.
```
kubectl apply -f audius/creator-node/creator-node-svc.yaml
kubectl apply -f audius/creator-node/creator-node-cm.yaml
```

Deploy creator node stack.
```
kubectl apply -f audius/creator-node/creator-node-deploy.yaml
```

Get service port.
```
kubectl get service creator-node-backend-svc
```

Health check.
```
curl <host>:<svc-port>/health_check
```


## Discovery Provider

An Audius Discovery Provider indexes the contents of the Audius contracts on the Ethereum blockchain for clients to query.
The indexed content includes user, track, and album/playlist information along with social features.
The data is stored for quick access, updated on a regular interval, and made available for clients via a RESTful API.

---

#### Run

Deploy persistent storage.
```
kubectl apply -f audius/discovery-provider/discovery-provider-pvc.yaml
```

Deploy service and config map objects.
```
kubectl apply -f audius/discovery-provider/discovery-provider-svc.yaml
kubectl apply -f audius/discovery-provider/discovery-provider-cm.yaml
```

Deploy discovery provider stack in **seed mode**.
```
kubectl apply -f audius/discovery-provider/discovery-provider-deploy-seed.yaml
```

Seed discovery provider db (speeds up chain indexing significantly).
```
kubectl apply -f audius/discovery-provider/discovery-provider-db-seed-job.yaml
kubectl wait --for=condition=complete job/discovery-provider-db-seed-job
```

When seed job completes, re-deploy the stack in **normal mode** to start the workers.
```
kubectl apply -f audius/discovery-provider/discovery-provider-deploy.yaml
```

Get service port.
```
kubectl get service discovery-provider-backend-svc
```

Health check.
```
curl <host>:<svc-port>/health_check
```
