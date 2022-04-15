#!/bin/bash

echo from post-pull.sh
# removed in release-v0.3.52 when we removed the IPFS dependency
# https://github.com/AudiusProject/audius-protocol/commit/030b1d0efba337b10c5095b90f369712d2604257
if kubectl get deployments | grep discovery-provider-ipfs > /dev/null; then
  kubectl delete deployment discovery-provider-ipfs
fi
