## Creator Node
There are two utility scripts for creator node

1. [Health Checks](#health-checks) - Runs several tests against your content node to verify that it's healthy (including disk space, db connectivity, timeouts etc)
2. [Delist Content](#delist-content) - Delist user, track or segment content from your content node

#### Health Checks

#### `healthChecks.js`

To run this script, go to the sp-utilities/creator-node/ folder and run the command

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

---

#### Delist Content

#### `delistContent.js`

##### Script Usage
The script takes three parameters
`node delistContent.js -a <add|remove>  -t <track|user|cid> -l <id(s) or cid(s)>`

`-a` - Action to perform, either `add` or `remove`. If you want to add to the list of delisted content, select `add`. If you want to remove from the list of delisted content and serve it, select `remove`

`-t` - Type of id, either `track`, `user` or `cid`

`-l` - Id(s) to delist


The script also requires 3 environment variables to be exported before running
`creatorNodeEndpoint` - Url of your content node

`delegatePrivateKey` - Delegate private key exposed on your content node, associated to the signer on your content node's health check

`discoveryProviderEndpoint` - A discovery node to query data from. One can be obtained from the [dashboard](https://dashboard.audius.org/#/services/discovery-node)

The order of the parameters is not considered. Delisting content might take some time if there is a lot of content. 

##### Example Usage
```
➜ export creatorNodeEndpoint=https://creatornode.domain.co
➜ export delegatePrivateKey=5e468bc1b395e2eb8f3c90ef897406087b0599d139f6ca0060ba85dcc0dce8dc
➜ export discoveryProviderEndpoint=https://discoveryprovider.domain.co

➜ node delistContent.js -a add -l 1,3,7 -t user
➜ node delistContent.js -a add -l 1,3,7 -t track
➜ node delistContent.js -a add -l Qm..., Qm..., -t cid

➜ node delistContent.js -a remove -l 1,3,7 -t user
➜ node delistContent.js -a remove -l 1,3,7 -t track
➜ node delistContent.js -a remove -l Qm..., Qm..., -t cid

// add -v flag to each command above to see the segments and number of segments touched

// For help:
// node delistContent.js --help
```

##### Example output

```bash
➜ pwd
/Audius/audius-k8s-manifests/sp-utilities/creator-node

# entering creatorNodeEndpoint and delegatePrivateKey sends those values as env vars to the script without having to export to your terminal
➜ export creatorNodeEndpoint=https://creatornode.domain.co
➜ export delegatePrivateKey=5e468bc1b395e2eb8f3c90ef897406087b0599d139f6ca0060ba85dcc0dce8dc
➜ export discoveryProviderEndpoint=https://discoveryprovider.domain.co
➜ node delistContent.js -a add -l 1 -t track 

Updating Content Blacklist...

Verifying content against blacklist...

Successfully performed [ADD] for type [TRACK]!
Values: [1]

➜ node delistContent.js -a remove -l 1 -t track

Updating Content Blacklist...

Verifying content against blacklist...

Successfully performed [REMOVE] for type [TRACK]!
Values: [1]
```