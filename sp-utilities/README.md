## Service Provider Utilities & Actions

This project is a set of common scripts and utilities to manage services.

### [Creator Node](https://github.com/AudiusProject/audius-k8s/tree/master/ops/k8s-manifests/sp-utilities/creator-node)
There are two utility scripts for creator node

1. Health Checks - Run several tests against your content node to verify that it's healthy (including disk space, db connectivity, timeouts etc)
2. Delist Content - Delist user, track or segment content from your content node

### [Discovery Node](https://github.com/AudiusProject/audius-k8s/tree/master/ops/k8s-manifests/sp-utilities/discovery-provider)

Used for checking health and indexing progress for your discovery provider.

### [Automatic claims](https://github.com/AudiusProject/audius-k8s/tree/master/ops/k8s-manifests/sp-utilities/claim)

If you would like to automatically run claim operations whenever a new round is initiated, `claim.js` is included for your convenience in the claim folder.
