const axios = require('axios')
const Web3 = require('web3')
const web3 = new Web3()
const { promisify } = require('util')

const crypto = require('crypto')
const assert = require('assert')

const PRIVATE_KEY = process.env.delegatePrivateKey
const CREATOR_NODE_ENDPOINT = process.env.creatorNodeEndpoint

/**
 * Parses the environment variables and command line args
 * export creatorNodeEndpoint=http://creatornode.domain.com
 * export delegatePrivateKey=f0b743ce8adb7938f1212f188347a63...
 * NOTE: DO NOT PREFIX PRIVATE KEY WITH 0x
 */
function parseEnvVarsAndArgs () {
  if (!CREATOR_NODE_ENDPOINT || !PRIVATE_KEY) {
    let errorMsg = `creatorNodeEndpoint [${CREATOR_NODE_ENDPOINT}] or delegatePrivateKey [${PRIVATE_KEY}] have not been exported. `
    errorMsg += "Please export environment variables 'delegatePrivateKey' (without leading 0x) and 'creatorNodeEndpoint' with https."
    throw new Error(errorMsg)
  }
}

async function healthCheck () {
  let requestConfig = {
    url: `${CREATOR_NODE_ENDPOINT}/health_check`,
    method: 'get',
    responseType: 'json'
  }
  let resp = await axios(requestConfig)
  let data = resp.data
  assert.deepStrictEqual(resp.status, 200)
  assert.deepStrictEqual(data.data.healthy, true)
  assert.ok(
    data.data.selectedDiscoveryProvider !== null && data.data.selectedDiscoveryProvider !== undefined,
    `Selected discovery provider should not be null or undefined`
  )
  assert.ok(
    data.data.signature !== null && data.data.signature !== undefined,
    `Signature should not be null or undefined`
  )
  console.log('✓ Health check passed successfully')
}

async function healthCheckDB () {
  let requestConfig = {
    url: `${CREATOR_NODE_ENDPOINT}/db_check`,
    method: 'get',
    responseType: 'json'
  }
  let resp = await axios(requestConfig)
  assert.deepStrictEqual(resp.status, 200)
  console.log('✓ DB health check passed successfully')
}

async function healthCheckDisk () {
  let requestConfig = {
    url: `${CREATOR_NODE_ENDPOINT}/disk_check`,
    method: 'get',
    responseType: 'json'
  }
  let resp = await axios(requestConfig)
  let data = resp.data
  console.log(data)
  assert.deepStrictEqual(resp.status, 200)
  const [size, magnitude] = data.data.available.split(' ')
  assert.deepStrictEqual(magnitude, 'TB')
  assert.ok(parseFloat(size) > 1.5, 'Minimum available disk space should be 1.5 TB')
  console.log('✓ Disk health check passed successfully')
}

/**
 * Process command line args and issue duration health check
 */
async function healthCheckDuration () {
  const randomBytes = promisify(crypto.randomBytes)
  try {
    parseEnvVarsAndArgs()
  } catch (e) {
    console.error(`\nIncorrect script usage: ${e.message}`)
    console.error(`Script usage: node verifyHealthcheckDuration.js`)
    return
  }

  try {
    // Generate signature using local key
    const randomBytesToSign = (await randomBytes(18)).toString()
    const signedLocalData = _generateTimestampAndSignature({ randomBytesToSign }, PRIVATE_KEY)
    // Add randomBytes to outgoing request parameters
    const reqParam = signedLocalData
    reqParam.randomBytes = randomBytesToSign
    let requestConfig = {
      url: `${CREATOR_NODE_ENDPOINT}/health_check/duration`,
      method: 'get',
      params: reqParam,
      responseType: 'json'
    }
    let resp = await axios(requestConfig)
    assert.deepStrictEqual(resp.status, 200)
    console.log('✓ Duration health check passed successfully')
  } catch (e) {
    console.error(e)
  }
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
    await healthCheckDB()
    await healthCheckDisk()
    await healthCheckDuration()
    process.exit(0)
  } catch (e) {
    console.error(`Error running script because of error: ${e.message}`)
    process.exit(1)
  }
}

run()

/**
 * HELPER FUNCTIONS
 */

/**
 * Generate the timestamp and signature for api signing
 * @param {object} data
 * @param {string} privateKey
 */
const _generateTimestampAndSignature = (data, privateKey) => {
  const timestamp = new Date().toISOString()
  const toSignObj = { ...data, timestamp }
  // JSON stringify automatically removes white space given 1 param
  const toSignStr = JSON.stringify(_sortKeys(toSignObj))
  const toSignHash = web3.utils.keccak256(toSignStr)
  const signedResponse = web3.eth.accounts.sign(toSignHash, privateKey)

  return { timestamp, signature: signedResponse.signature }
}

const _sortKeys = x => {
  if (typeof x !== 'object' || !x) { return x }
  if (Array.isArray(x)) { return x.map(_sortKeys) }
  return Object.keys(x).sort().reduce((o, k) => ({ ...o, [k]: _sortKeys(x[k]) }), {})
}
