set -x

sudo apt update
sudo apt dist-upgrade

# disable swap
sudo swapoff /swap.img
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# install basic deps
sudo apt-get update && sudo apt-get install -y apt-transport-https curl jq

# install docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt update
sudo apt install -y docker-ce

# install kubectl + kubeadm
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
sudo bash -c 'cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
deb https://apt.kubernetes.io/ kubernetes-xenial main
EOF'
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

# kubeadm init
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/k8s-manifests/kube-flannel-rbac.yml
kubectl taint nodes --all node-role.kubernetes.io/master-

# alias kubectl to k
echo 'alias k=kubectl' >>~/.bashrc

# create directories for persistent storage
sudo mkdir -p /var/k8s
sudo chown $(id -u):$(id -g) /var/k8s

# create readlink for audius-cli
sudo ln -sf $(dirname $(readlink -f "$0"))/audius-cli /usr/local/bin/audius-cli

# reboot for good measure
sudo shutdown -r now
