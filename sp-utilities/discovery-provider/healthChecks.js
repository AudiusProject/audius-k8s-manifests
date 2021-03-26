const axios = require('axios')
const assert = require('assert')

const DISCOVERY_PROVIDER_ENDPOINT = process.env.discoveryProviderEndpoint

/**
 * Parses the environment variables and command line args
 * export discoveryProviderEndpoint=http://discoveryprovider.domain.com
 */
function parseEnvVarsAndArgs () {
  if (!DISCOVERY_PROVIDER_ENDPOINT) {
    let errorMsg = `discoveryProviderEndpoint [${DISCOVERY_PROVIDER_ENDPOINT}] has not been exported. `
    errorMsg += "Please export environment variable 'discoveryProviderEndpoint' with https."
    throw new Error(errorMsg)
  }
}

async function healthCheck () {
  const requestConfig = {
    url: `${DISCOVERY_PROVIDER_ENDPOINT}/health_check`,
    method: 'get',
    responseType: 'json'
  }
  const resp = await axios(requestConfig)
  const data = resp.data
  assert.deepStrictEqual(resp.status, 200)
  assert.deepStrictEqual(data.data.db.number > 0, true)
  assert.deepStrictEqual(data.data.block_difference < 5, true)
  console.log('✓ Health check passed successfully')
}

async function ipCheck () {
  const discoveryRequestConfig = {
    url: `${DISCOVERY_PROVIDER_ENDPOINT}/ip_check`,
    method: 'get',
    responseType: 'json'
  }
  const discoveryResp = await axios(discoveryRequestConfig)
  const discoveryClaimedIP = discoveryResp.data.data

  const ipApiRequestConfig = {
    url: 'https://ipapi.co/json',
    method: 'get',
    responseType: 'json'
  }
  const ipApiResp = await axios(ipApiRequestConfig)
  const ipApiClaimedIP = ipApiResp.data.ip

  assert.deepStrictEqual(discoveryResp.status, 200)
  assert.deepStrictEqual(ipApiResp.status, 200)
  assert.deepStrictEqual(discoveryClaimedIP, ipApiClaimedIP)
  console.log('✓ IP check passed successfully')
}

async function run () {
  try {
    parseEnvVarsAndArgs()
  } catch (e) {
    console.error(`\nIncorrect script usage: ${e.message}`)
    process.exit(1)
  }
  try {
    await healthCheck()
    await ipCheck()
    console.log("All checks passed!")
    process.exit(0)
  } catch (e) {
    console.error(`Error running script: ${e.message}`)
    process.exit(1)
  }
}

run()
