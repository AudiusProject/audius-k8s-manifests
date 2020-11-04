## Service Provider Utilities & Actions

This project is a set of common scripts and utilities to manage services. There's two sub-folders, one for `creator-node` and one for `discovery-provider`.

### creator-node/

`healthChecks.js` - Used for checking health, disk space, db connectivity, load balancer timeouts and other health information about a creator node.

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

`delistContent.js` - Used to delist content on your node by track or user.

The script takes three parameters
`node delistContent.js <add|remove> <track|user> <id>`

The first parameter is to either add to the set of delisted content or to remove from the set of delisted content.

The second parameter is type, either track or user.

The third parameter is the id of the user or track to delist.

```bash
➜ pwd
/Audius/audius-k8s-manifests/sp-utilities/creator-node

# entering creatorNodeEndpoint and delegatePrivateKey sends those values as env vars to the script without having to export to your terminal
➜ creatorNodeEndpoint=https://creatornode.domain.co delegatePrivateKey=5e468bc1b395e2eb8f3c90ef897406087b0599d139f6ca0060ba85dcc0dce8dc node delistContent.js add track 115
```


### discovery-provider


`healthChecks.js` - Used for checking health and indexing progress for your discovery provider.

Usage

```bash
➜ discoveryProviderEndpoint=https://discoveryprovider.domain.co node healthChecks.js
✓ Health check passed
All checks passed!
```

If you see the message "Error running script" this script did not finish successfully. If you see "All checks passed!" this script finished successfully.