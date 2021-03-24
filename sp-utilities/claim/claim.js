const Web3 = require('web3')
const HDWalletProvider = require("@truffle/hdwallet-provider");
const { program } = require('commander')

const audius = require('@audius/libs')

const defaultRegistryAddress = '0xd976d3b4f4e22a238c1A736b6612D22f17b6f64C'
const defaultTokenAddress = '0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998'
const defaultWeb3Provider = 'https://mainnet.infura.io/v3/a3ed533ddfca4c76ab4df7556e2745e1'


const configureLibs = async (account, ethRegistryAddress, ethTokenAddress, web3Provider) => {
    const configuredWeb3 = await audius.Utils.configureWeb3(
        web3Provider,
        null,
        false,
    )

    const audiusLibsConfig = {
        ethWeb3Config: audius.configEthWeb3(
            ethTokenAddress,
            ethRegistryAddress,
            configuredWeb3,
            account
        ),
        isServer: true
    }

    const libs = new audius(audiusLibsConfig)
    await libs.init()

    return libs
}


async function run(spOwnerWallet, privateKey, { ethRegistryAddress, ethTokenAddress, web3Provider, initRound, initiateGas, claimGas }) {
    const provider = new HDWalletProvider({ privateKeys: [privateKey], providerOrUrl: web3Provider })
    const web3 = new Web3(provider)

    const audiusLibs = await configureLibs(
        spOwnerWallet,
        ethRegistryAddress,
        ethTokenAddress,
        provider,
    )

    const claimsManagerContract = audiusLibs.ethContracts.ClaimsManagerClient
    const delegateContract = audiusLibs.ethContracts.DelegateManagerClient

    const claimPending = await claimsManagerContract.claimPending(spOwnerWallet)

    if ((!claimPending) && initRound) {
        const currentBlock = await web3.eth.getBlockNumber();
        const lastFundedBlock = await claimsManagerContract.getLastFundedBlock()
        const blockDiff = currentBlock - lastFundedBlock
        const requiredBlockDiff = await claimsManagerContract.getFundingRoundBlockDiff()

        if (blockDiff <= requiredBlockDiff) {
            console.log(`Block difference (${requiredBlockDiff}) not met`)
            process.exit(1)
        }

        console.log('Initializing Round')
        await claimsManagerContract.initiateRound(0, initiateGas)
        console.log('Initiated Round')
    }

    if (claimPending) {
        console.log('Claiming Rewards')
        await delegateContract.claimRewards(spOwnerWallet, 0, claimGas)
        console.log('Claimed Rewards successfully')
    }

    process.exit(0)
}

async function main() {
    program
        .arguments('<spOwnerWallet> <privateKey>')
        .option('--eth-registry-address <ethRegistryAddress>', 'Registry contract address', defaultRegistryAddress)
        .option('--eth-token-address <ethTokenAddress>', 'Token contract address', defaultTokenAddress)
        .option('--web3-provider <web3Provider>', 'Web3 provider to use', defaultWeb3Provider)
        .option('--init-round', 'Initiate new rounds')
        .option('--claim-gas', 'Gas for claiming', 1500000)
        .option('--initiate-gas', 'Gas for Initiating new rounds', 100000)
        .action(run)

    await program.parseAsync(process.argv)
}

main()
