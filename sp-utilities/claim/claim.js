const axios = require('axios')
const Web3 = require('web3')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const { program } = require('commander')

const audius = require('@audius/libs')

const defaultRegistryAddress = '0xd976d3b4f4e22a238c1A736b6612D22f17b6f64C'
const defaultTokenAddress = '0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998'
const defaultWeb3Provider = 'https://mainnet.infura.io/v3/a3ed533ddfca4c76ab4df7556e2745e1'

async function configureLibs(ethRegistryAddress, ethTokenAddress, web3Provider) {
  const configuredWeb3 = await audius.Utils.configureWeb3(web3Provider, null, false)

  const audiusLibsConfig = {
    ethWeb3Config: audius.configEthWeb3(ethTokenAddress, ethRegistryAddress, configuredWeb3, '0x0'),
    isServer: true,
  }

  const libs = new audius(audiusLibsConfig)
  await libs.init()

  return libs
}

async function getGasPrice() {
  try {
    const gasPrices = await axios.get('https://ethgasstation.info/json/ethgasAPI.json');
    return Web3.utils.toWei((gasPrices.data.fastest / 10).toString(), 'gwei');
  } catch (err) {
    console.error(`Got ${err} when trying to fetch gas from ethgasstation.info, falling back web3's gas estimation`)
    return (await Web3.eth.getGasPrice()).toString();
  }
}

async function getClaimsManagerContract(ethRegistryAddress, ethTokenAddress, web3) {
  const audiusLibs = await configureLibs(ethRegistryAddress, ethTokenAddress, web3.eth.currentProvider)
  await audiusLibs.ethContracts.ClaimsManagerClient.init()
  return new web3.eth.Contract(
    audiusLibs.ethContracts.ClaimsManagerClient._contract.options.jsonInterface,
    audiusLibs.ethContracts.ClaimsManagerClient._contract.options.address
  )
}

async function getDelegateManagerContract(ethRegistryAddress, ethTokenAddress, web3) {
  const audiusLibs = await configureLibs(ethRegistryAddress, ethTokenAddress, web3.eth.currentProvider)
  await audiusLibs.ethContracts.DelegateManagerClient.init()
  return new web3.eth.Contract(
    audiusLibs.ethContracts.DelegateManagerClient._contract.options.jsonInterface,
    audiusLibs.ethContracts.DelegateManagerClient._contract.options.address
  )
}

async function initiateRound(privateKey, { ethRegistryAddress, ethTokenAddress, web3Provider, gas, gasPrice, transferRewardsToSolana }) {
  const web3 = new Web3(
    new HDWalletProvider({
      privateKeys: [privateKey],
      providerOrUrl: web3Provider,
    })
  )

  web3.eth.transactionPollingTimeout = 3600
  const accountAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address

  const claimsManagerContract = await getClaimsManagerContract(ethRegistryAddress, ethTokenAddress, web3)

  const lastFundedBlock = await claimsManagerContract.methods.getLastFundedBlock().call()
  const requiredBlockDiff = await claimsManagerContract.methods.getFundingRoundBlockDiff().call()

  const currentBlock = await web3.eth.getBlockNumber()
  const blockDiff = currentBlock - lastFundedBlock - 12

  if (blockDiff <= requiredBlockDiff) {
    console.log(`Block difference of ${requiredBlockDiff} not met, ${requiredBlockDiff - blockDiff} blocks remaining`)
    process.exit(1)
  }

  console.log('Initializing Round')
  await claimsManagerContract.methods.initiateRound().send({
    from: accountAddress,
    gas,
    gasPrice: gasPrice ? web3.utils.toWei(gasPrice, 'gwei') : (await getGasPrice()),
  })
  console.log('Successfully initiated Round')
  if (transferRewardsToSolana) {
    const { transferCommunityRewardsToSolana } = require('@audius/libs/scripts/communityRewards/transferCommunityRewardsToSolana')
    console.log('Running rewards manager transfer')
    await transferCommunityRewardsToSolana()
    console.log('Successfully transferred rewards to solana')
  }
}

async function claimRewards(
  spOwnerWallet,
  privateKey,
  { ethRegistryAddress, ethTokenAddress, web3Provider, gas, gasPrice }
) {
  const web3 = new Web3(
    new HDWalletProvider({
      privateKeys: [privateKey],
      providerOrUrl: web3Provider,
    })
  )

  web3.eth.transactionPollingTimeout = 3600
  const accountAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address

  const claimsManagerContract = await getClaimsManagerContract(ethRegistryAddress, ethTokenAddress, web3)
  const delegateManagerContract = await getDelegateManagerContract(ethRegistryAddress, ethTokenAddress, web3)

  const claimPending = await claimsManagerContract.methods.claimPending(spOwnerWallet).call()

  if (claimPending) {
    console.log('Claiming Rewards')
    await delegateManagerContract.methods.claimRewards(spOwnerWallet).send({
      from: accountAddress,
      gas,
      gasPrice: gasPrice ? web3.utils.toWei(gasPrice, 'gwei') : (await getGasPrice()),
    })
    console.log('Claimed Rewards successfully')
  } else {
    console.log('No claims pending')
  }
}

async function main() {
  program
    .command('initiate-round <privateKey>')
    .description('Initiates new round for claiming rewards')
    .option('--eth-registry-address <ethRegistryAddress>', 'Registry contract address', defaultRegistryAddress)
    .option('--eth-token-address <ethTokenAddress>', 'Token contract address', defaultTokenAddress)
    .option('--web3-provider <web3Provider>', 'Web3 provider to use', defaultWeb3Provider)
    .option('--gas <gas>', 'amount of gas to use', 100000)
    .option('--gas-price <gasPrice>', 'gas price in gwei')
    .option('--transfer-rewards-to-solana', 'whether to also transfer rewards to solana rewards manager on success. Requires env vars to be set.', false)
    .action(initiateRound)

  program
    .command('claim-rewards <spOwnerWallet> <privateKey>')
    .description('Claim rewards for given spOwnerWallet')
    .option('--eth-registry-address <ethRegistryAddress>', 'Registry contract address', defaultRegistryAddress)
    .option('--eth-token-address <ethTokenAddress>', 'Token contract address', defaultTokenAddress)
    .option('--web3-provider <web3Provider>', 'Web3 provider to use', defaultWeb3Provider)
    .option('--gas <gas>', 'ammount of gas to use', 1000000)
    .option('--gas-price <gasPrice>', 'gas price in gwei')
    .action(claimRewards)

  try {
    await program.parseAsync(process.argv)
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

main()
