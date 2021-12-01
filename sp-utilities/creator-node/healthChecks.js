const axios = require('axios')
const Web3 = require('web3')
const FormData = require('form-data')

const crypto = require('crypto')
const assert = require('assert')

const { promisify } = require('util')
const { generateTimestampAndSignature } = require('./apiSigning')

const web3 = new Web3()

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
    data.signature !== null && data.signature !== undefined,
    `Signature should not be null or undefined`
  )
  assert.ok(
    data.data.spOwnerWallet !== null && data.data.spOwnerWallet !== undefined,
    `spOwnerWallet should not be null or undefined`
  )
  console.log('✓ Health check passed')
}

async function healthCheckDB () {
  let requestConfig = {
    url: `${CREATOR_NODE_ENDPOINT}/db_check`,
    method: 'get',
    responseType: 'json'
  }
  let resp = await axios(requestConfig)
  assert.deepStrictEqual(resp.status, 200)
  console.log('✓ DB health check passed')
}

async function healthCheckIPFS () {
  let requestConfig = {
    url: `${CREATOR_NODE_ENDPOINT}/health_check/ipfs`,
    method: 'get',
    responseType: 'json'
  }
  let resp = await axios(requestConfig)
  let data = resp.data
  assert.deepStrictEqual(resp.status, 200)
  assert.deepStrictEqual(data.data.hash.includes('Qm'), true)
  console.log('✓ IPFS health check passed')
}

async function healthCheckDisk () {
  let requestConfig = {
    url: `${CREATOR_NODE_ENDPOINT}/disk_check`,
    method: 'get',
    responseType: 'json'
  }
  let resp = await axios(requestConfig)
  let data = resp.data
  assert.deepStrictEqual(resp.status, 200)
  assert.deepStrictEqual(data.data.storagePath, '/file_storage')
  const [size, magnitude] = data.data.available.split(' ')
  assert.deepStrictEqual(magnitude, 'TB')
  assert.ok(parseFloat(size) > 1.5, 'Minimum available disk space should be 1.5 TB')
  console.log('✓ Disk health check passed')
}

// This is the heartbeat route. It should always pass
async function healthCheckDurationHeartbeat () {
  const randomBytes = promisify(crypto.randomBytes)
  try {
    parseEnvVarsAndArgs()
  } catch (e) {
    console.error(`\nIncorrect usage: ${e.message}`)
    return
  }

  try {
    // Generate signature using local key
    const randomBytesToSign = (await randomBytes(18)).toString()
    const signedLocalData = generateTimestampAndSignature({ randomBytesToSign }, PRIVATE_KEY)
    // Add randomBytes to outgoing request parameters
    const reqParam = signedLocalData
    reqParam.randomBytes = randomBytesToSign
    let requestConfig = {
      url: `${CREATOR_NODE_ENDPOINT}/health_check/duration/heartbeat`,
      method: 'get',
      params: reqParam,
      responseType: 'json'
    }
    let resp = await axios(requestConfig)
    assert.deepStrictEqual(resp.status, 200)
    console.log('✓ Heartbeat duration health check passed')
  } catch (e) {
    console.error(e)
  }
}

// Test the non heartbeat route. There's a chance this could time out so handle accordingly
async function healthCheckDuration () {
  const randomBytes = promisify(crypto.randomBytes)
  let start = Date.now()
  let resp

  try {
    parseEnvVarsAndArgs()
  } catch (e) {
    console.error(`\nIncorrect usage: ${e.message}`)
    return
  }

  try {
    // Generate signature using local key
    const randomBytesToSign = (await randomBytes(18)).toString()
    const signedLocalData = generateTimestampAndSignature({ randomBytesToSign }, PRIVATE_KEY)
    // Add randomBytes to outgoing request parameters
    const reqParam = signedLocalData
    reqParam.randomBytes = randomBytesToSign
    let requestConfig = {
      url: `${CREATOR_NODE_ENDPOINT}/health_check/duration`,
      method: 'get',
      params: reqParam,
      responseType: 'json'
    }
    resp = await axios(requestConfig)
    console.log('✓ Non-heartbeat duration health check passed')
  } catch (e) {
    if (e.message.includes('504')) {
      console.log(`! Non-heartbeat duration health check timed out at ${Math.floor((Date.now() - start) / 1000)} seconds with error message: "${e.message}". This is not an issue.`)
    } else {
      throw new Error(`Non-heartbeat duration health check timed out at ${Math.floor((Date.now() - start) / 1000)} seconds with error message: "${e.message}".`)
    }
  }
}

// Test the file upload limit
async function healthCheckFileUpload () {
  const randomBytes = promisify(crypto.randomBytes)
  let resp

  try {
    parseEnvVarsAndArgs()
  } catch (e) {
    console.error(`\nIncorrect usage: ${e.message}`)
    return
  }

  try {
    // Generate signature using local key
    const randomBytesToSign = (await randomBytes(18)).toString()
    const signedLocalData = generateTimestampAndSignature({ randomBytesToSign }, PRIVATE_KEY)
    // Add randomBytes to outgoing request parameters
    const reqParam = signedLocalData
    reqParam.randomBytes = randomBytesToSign

    let sampleTrack = new FormData()
    sampleTrack.append('file', (await axios({
      method: 'get',
      url: 'https://s3-us-west-1.amazonaws.com/download.audius.co/sp-health-check-files/97mb_music.mp3', // 97 MB
      responseType: 'stream'
    })).data)

    let requestConfig = {
      headers: {
        ...sampleTrack.getHeaders()
      },
      url: `${CREATOR_NODE_ENDPOINT}/health_check/fileupload`,
      method: 'post',
      params: reqParam,
      responseType: 'json',
      data: sampleTrack,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
    resp = await axios(requestConfig)
    console.log('✓ File upload health check passed')
  } catch (e) {
    throw new Error(`File upload health check errored with error message: "${e.message}".`)
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
    console.log(`Starting tests now. This may take a few minutes.`)
    await healthCheck()
    await healthCheckIPFS()
    await healthCheckDB()
    await healthCheckDisk()
    await healthCheckDurationHeartbeat()
    await healthCheckDuration()
    await healthCheckFileUpload()
    console.log("All checks passed!")
    process.exit(0)
  } catch (e) {
    console.error(`Error running script: ${e.message}`)
    process.exit(1)
  }
}

run()
