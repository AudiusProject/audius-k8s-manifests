# install basic deps
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt-get update && sudo apt-get install -y apt-transport-https curl jq python3.8 python3.8-distutils

# audius-cli init
chmod +x $(dirname $(readlink -f "$0"))/audius-cli
sudo ln -sf $(dirname $(readlink -f "$0"))/audius-cli /usr/local/bin/audius-cli
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3.8 get-pip.py --force-reinstall
python3.8 -m pip install --user python-crontab pyyaml psutil
rm get-pip.py

# backup existing configs
python3.8 $(dirname $(readlink -f "$0"))/backup.py
