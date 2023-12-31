import { utils, Wallet, Provider, types } from "zksync-web3";
import * as hre from "hardhat";
import { ethers } from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export async function deployFactory(wallet: Wallet, accountContractName: string, accountFactoryContractName: string) {
  const deployer = new Deployer(hre, wallet);
  const accountFactoryArtifact = await deployer.loadArtifact(accountFactoryContractName);
  const accountArtifact = await deployer.loadArtifact(accountContractName);

  // Getting the bytecodeHash of the account
  const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);

  let accountFactory = await deployer.deploy(accountFactoryArtifact, [bytecodeHash], undefined, [
    // Since the factory requires the code of the multisig to be available,
    // we should pass it here as well.
    accountArtifact.bytecode,
  ]);

  return accountFactory;
}

export async function deployContract(wallet: Wallet, contractName: string, args: any[] = [], additionalFactoryDeps: string[] = []) {
  const deployer = new Deployer(hre, wallet);
  const contractArtifact = await deployer.loadArtifact(contractName);
  const contract = await deployer.deploy(contractArtifact, args, undefined, additionalFactoryDeps);
  return contract;
}

export async function deployMultisig(wallet: Wallet, factoryAddress: string, ownerWallet1: Wallet, ownerWallet2: Wallet) {
  const factoryArtifact = await hre.artifacts.readArtifact("AAFactory");
  const accountArtifact = await hre.artifacts.readArtifact("TwoUserMultisig");

  const aaFactory = new ethers.Contract(factoryAddress, factoryArtifact.abi, wallet);

  // For the simplicity of the tutorial, we will use zero hash as salt
  const salt = ethers.constants.HashZero;

  // deploy account owned by owner1 & owner2
  const tx = await aaFactory.deployAccount(salt, ownerWallet1.address, ownerWallet2.address, { gasLimit: 10000000 });
  await tx.wait();

  // Getting the address of the deployed contract account
  const abiCoder = new ethers.utils.AbiCoder();
  let multisigAddress = utils.create2Address(factoryAddress, await aaFactory.aaBytecodeHash(), salt, abiCoder.encode(["address", "address"], [ownerWallet1.address, ownerWallet2.address]));

  const accountContract = new ethers.Contract(multisigAddress, accountArtifact.abi, wallet);
  return accountContract;
}

export async function deployPension(wallet: Wallet, factoryAddress: string, walletOwner: Wallet) {
  const paFactoryArtifact = await hre.artifacts.readArtifact("PensionAccountFactory");
  const accountArtifact = await hre.artifacts.readArtifact("PensionAccount");
  
  const paFactory = new ethers.Contract(factoryAddress, paFactoryArtifact.abi, wallet);

  // Contract constructor args
  const dex = createMockAddress("decentralizedex"); // "0xdex0000000000000000000000000000000000000"
  const doge = createMockAddress("dogecoin"); // "0xdoge000000000000000000000000000000000000"
  const pepe = createMockAddress("pepecoin"); // "0xpepe000000000000000000000000000000000000"
  const shib = createMockAddress("shibainucoin"); // "0xshib0000000000000000000000000000000000000"
  const btc = createMockAddress("bitcoin"); // "0xbtc00000000000000000000000000000000000000"

  // For the simplicity of the tutorial, we will use zero hash as salt
  const salt = ethers.constants.HashZero;

  // deploy account with dex and token addresses
  const tx = await paFactory.deployPensionAccount(salt, walletOwner.address, dex, doge, pepe, shib, btc, { gasLimit: 10000000 });
  await tx.wait();

  // Getting the address of the deployed contract account
  const abiCoder = new ethers.utils.AbiCoder();
  let contractAddress = utils.create2Address(
    factoryAddress,
    await paFactory.pensionAccountBytecodeHash(),
    salt,
    abiCoder.encode(["address", "address", "address", "address", "address", "address"], [walletOwner.address, dex, doge, pepe, shib, btc])
  );

  const pensionAccountContract = new ethers.Contract(contractAddress, accountArtifact.abi, wallet);
  return pensionAccountContract;
}

export async function deploySharedRestricted(wallet: Wallet, factoryAddress: string, ownerWallet: Wallet) {
  const factoryArtifact = await hre.artifacts.readArtifact("SharedRestrictedAccountFactory");
  const accountArtifact = await hre.artifacts.readArtifact("SharedRestrictedAccount");

  const sraFactory = new ethers.Contract(factoryAddress, factoryArtifact.abi, wallet);

  // For the simplicity of the tutorial, we will use zero hash as salt
  const salt = ethers.constants.HashZero;

  // deploy account owned by owner1 & owner2
  const tx = await sraFactory.deployAccount(salt, ownerWallet.address);
  await tx.wait();

  // Getting the address of the deployed contract account
  const abiCoder = new ethers.utils.AbiCoder();
  let accountAddress = utils.create2Address(factoryAddress, await sraFactory.aaBytecodeHash(), salt, abiCoder.encode(["address"], [ownerWallet.address]));

  const accountContract = new ethers.Contract(accountAddress, accountArtifact.abi, ownerWallet);
  return accountContract;
}

export async function fundAccount(wallet: Wallet, destinationAddress: string, amount: string = "100") {
  // Send funds to the account
  await (
    await wallet.sendTransaction({
      to: destinationAddress,
      // You can increase the amount of ETH sent to the multisig
      value: ethers.utils.parseEther(amount),
    })
  ).wait();
}

// Temporary wallet for testing - that is accepting two private keys - and signs the transaction with both.
export class MultiSigWallet extends Wallet {
  readonly aaAddress: string;
  otherWallet: Wallet;

  // AA_address - is the account abstraction address for which, we'll use the private key to sign transactions.
  constructor(
    aaAddress: string,
    privateKey1: string,
    privateKey2: string,
    providerL2: Provider,
  ) {
    super(privateKey1, providerL2);
    this.otherWallet = new Wallet(privateKey2, providerL2);
    this.aaAddress = aaAddress;
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.aaAddress);
  }

  async signTransaction(transaction: types.TransactionRequest) {
    const sig1 = await this.eip712.sign(transaction);
    const sig2 = await this.otherWallet.eip712.sign(transaction);
    // substring(2) to remove the '0x' from sig2.
    if (transaction.customData === undefined) {
      throw new Error("Transaction customData is undefined");
    }
    transaction.customData.customSignature = sig1 + sig2.substring(2);
    return (0, utils.serialize)(transaction);
  }
}

// Temporary wallet for testing - that is accepting one private key - and signs the transaction with it.
export class SingleSignerAAWallet extends Wallet {
  readonly accountAddress: string;

  // accountAddress - is the account abstraction address for which, we'll use the private key to sign transactions.
  constructor(
    accountAddress: string,
    privateKey: string,
    providerL2: Provider,
  ) {
    super(privateKey, providerL2);
    this.accountAddress = accountAddress;
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.accountAddress);
  }

  async signTransaction(transaction: types.TransactionRequest) {
    const sig1 = await this.eip712.sign(transaction);
    if (transaction.customData === undefined) {
      throw new Error("Transaction customData is undefined");
    }
    transaction.customData.customSignature = sig1;
    return (0, utils.serialize)(transaction);
  }
}

function createMockAddress(base: string) {
  const baseHex = base.replace(/[^0-9A-Fa-f]/g, ''); // Remove non-hex characters
  const paddingLength = 40 - baseHex.length; // Calculate padding length
  return '0x' + baseHex + '0'.repeat(paddingLength);
}

// Helper function to advance the blockchain by a specified number of blocks
export async function advanceBlocks(numberOfBlocks: number) {
  for (let i = 0; i < numberOfBlocks; i++) {
    await hre.network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }
}
