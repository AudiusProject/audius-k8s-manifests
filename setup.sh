set -x

sudo apt update
sudo apt dist-upgrade

# disable swap
sudo swapoff /swap.img
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# install basic deps
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt-get update && sudo apt-get install -y apt-transport-https curl jq python3.8 python3.8-distutils

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

# install psql 11
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
RELEASE=$(lsb_release -cs)
echo "deb http://apt.postgresql.org/pub/repos/apt/ ${RELEASE}"-pgdg main | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt -y install postgresql-11

# audius-cli init
chmod +x $(dirname $(readlink -f "$0"))/post-pull.sh
chmod +x $(dirname $(readlink -f "$0"))/audius-cli
sudo ln -sf $(dirname $(readlink -f "$0"))/audius-cli /usr/local/bin/audius-cli
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3.8 get-pip.py --force-reinstall
python3.8 -m pip install --user python-crontab pyyaml
rm get-pip.py

# reboot for good measure
sudo shutdown -r now
