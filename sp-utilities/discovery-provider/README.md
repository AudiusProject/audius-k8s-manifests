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