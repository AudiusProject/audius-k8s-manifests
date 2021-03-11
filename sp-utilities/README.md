## Service Provider Utilities & Actions

This project is a set of common scripts and utilities to manage services. There's three sub-folders, one for `creator-node` and one for `discovery-provider`, and one to process claims.

### creator-node/

#### `healthChecks.js` - Used for checking health, disk space, db connectivity, load balancer timeouts and other health information about a creator node.

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

#### `delistContent.js` - Used to delist content from your node by track id(s), user id(s), and/or cid(s)

The script takes three parameters
`node delistContent.js -a <add|remove>  -t <track|user|cid> -l <id(s) or cid(s)>`

The first parameter is to either add to the set of delisted content or to remove from the set of delisted content.

The second parameter is type, either track id(s), user id(s), or cid(s).

The third parameter is the id(s) of the user or track to delist, or track cid(s).

The order of the parameters is not considered. Delisting content might take some time if there is a lot of content. 

```bash
➜ pwd
/Audius/audius-k8s-manifests/sp-utilities/creator-node

# entering creatorNodeEndpoint and delegatePrivateKey sends those values as env vars to the script without having to export to your terminal
➜ creatorNodeEndpoint=https://creatornode.domain.co
➜ delegatePrivateKey=5e468bc1b395e2eb8f3c90ef897406087b0599d139f6ca0060ba85dcc0dce8dc
➜ discoveryProviderEndpoint=https://discoveryprovider.domain.co
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

More examples on how to use this script:
```
// node delistContent.js -a add -l 1,3,7 -t user
// node delistContent.js -a add -l 1,3,7 -t track
// node delistContent.js -a add -l Qm..., Qm..., -t cid

// node delistContent.js -a remove -l 1,3,7 -t user
// node delistContent.js -a remove -l 1,3,7 -t track
// node delistContent.js -a remove -l Qm..., Qm..., -t cid

// add -v flag to each command above to see the segments and number of segments touched

// For help:
// node delistContent.js --help
```

### discovery-provider


#### `healthChecks.js` - Used for checking health and indexing progress for your discovery provider.

Usage

```bash
➜ pwd
/Audius/audius-k8s-manifests/sp-utilities/discovery-provider

➜ discoveryProviderEndpoint=https://discoveryprovider.domain.co node healthChecks.js
✓ Health check passed
All checks passed!
```

If you see the message "Error running script" this script did not finish successfully. If you see "All checks passed!" this script finished successfully.

### claim

If you would like to automatically run claim operations whenever a new round is initiated, `claim.js` is included for your convenience in the claim folder.

```
npm install
cd sp-utilities/claim
```

Then you can run the following command to setup a cron job. (Be sure to replace the full path to `claim.js`)
```
(crontab -l 2>/dev/null; echo "0 */6 * * * node full/path/to/claim.js <spOwnerWallet> <privateKey>") | crontab -
```

Be sure to replace `full/path/to/claim.js` with the actual path on your local machine.


```
Usage: claim [options] <spOwnerWallet> <privateKey>

Options:
  --eth-registry-address <ethRegistryAddress>  Registry contract address (default: "0xd976d3b4f4e22a238c1A736b6612D22f17b6f64C")
  --eth-token-address <ethTokenAddress>        Token contract address (default: "0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998")
  --web3-provider <web3Provider>               Web3 provider to use (default: "https://mainnet.infura.io/v3/a3ed533ddfca4c76ab4df7556e2745e1")
  --init-round                             initiate new rounds
  -h, --help                                   display help for command
```
