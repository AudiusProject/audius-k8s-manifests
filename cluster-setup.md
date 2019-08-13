# Cluster Setup

Provision a single node (master + worker) Kubernetes cluster on an Ubuntu box.

> **NOTE** This is to be used as a guide only

```
sudo apt update
sudo apt dist-upgrade
sudo shutdown -r now

# disable swap
sudo swapoff /swap.img
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# install basic deps
apt-get update && apt-get install -y apt-transport-https curl

# install docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt update
sudo apt install docker-ce

# install kubectl + kubeadm
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
deb https://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
apt-get install -y kubelet kubeadm kubectl
apt-mark hold kubelet kubeadm kubectl

# reboot after both for good measure
sudo shutdown -r now

# kubeadm init
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/k8s-manifests/kube-flannel-rbac.yml
kubectl taint nodes --all node-role.kubernetes.io/master-

# create directories for persistent storage
sudo mkdir -p /var/k8s
sudo chown $(id -u):$(id -g) /var/k8s

# reboot again for good measure
sudo shutdown -r now

# sanity check - you should be up and running
kubectl get all
```
