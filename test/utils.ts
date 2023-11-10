import { utils, Wallet, Provider, types, EIP712Signer } from "zksync-web3";
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

export async function signMultiSigTx(wallet: Wallet, multiSigAddress: string, factoryAddress: string, owner1: Wallet, owner2: Wallet) {
  const factoryArtifact = await hre.artifacts.readArtifact("AAFactory");
  const aaFactory = new ethers.Contract(factoryAddress, factoryArtifact.abi, wallet);
  const provider = wallet.provider;
  const salt = ethers.constants.HashZero;
    // Transaction to deploy a new account using the multisig we just deployed
    let aaTx = await aaFactory.populateTransaction.deployAccount(
      salt,
      // These are accounts that will own the newly deployed account
      Wallet.createRandom().address,
      Wallet.createRandom().address
    );
  
    const gasLimit = await provider.estimateGas(aaTx);
    const gasPrice = await provider.getGasPrice();
  
    aaTx = {
      ...aaTx,
      // deploy a new account using the multisig
      from: multiSigAddress,
      gasLimit: gasLimit,
      gasPrice: gasPrice,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(multiSigAddress),
      type: 113,
      customData: {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      } as types.Eip712Meta,
      value: ethers.BigNumber.from(0),
    };
    const signedTxHash = EIP712Signer.getSignedDigest(aaTx);
  
    const signature = ethers.utils.concat([
      // Note, that `signMessage` wouldn't work here, since we don't want
      // the signed hash to be prefixed with `\x19Ethereum Signed Message:\n`
      ethers.utils.joinSignature(owner1._signingKey().signDigest(signedTxHash)),
      ethers.utils.joinSignature(owner2._signingKey().signDigest(signedTxHash)),
    ]);
  
    aaTx.customData = {
      ...aaTx.customData,
      customSignature: signature,
    };
  
    const sentTx = await provider.sendTransaction(utils.serialize(aaTx));
    await sentTx.wait();  
    return sentTx;
}

export async function deployAccount(wallet: Wallet, factoryAddress: string, accountOwnerPublicKey: string) {
  const paFactoryArtifact = await hre.artifacts.readArtifact("PensionAccountFactory");
  const paFactory = new ethers.Contract(factoryAddress, paFactoryArtifact.abi, wallet);

  // Account owner address
  const owner = ethers.utils.getAddress(accountOwnerPublicKey);

  // Contract constructor args
  const dex = "0x123dex";
  const doge = "0x123doge";
  const pepe = "0x123pepe";
  const shib = "0x123shib";
  const btc = "0x123btc";

  // For the simplicity of the tutorial, we will use zero hash as salt
  const salt = ethers.constants.HashZero;

  // deploy account with dex and token addresses
  const tx = await paFactory.deployAccount(salt, owner, dex, doge, pepe, shib, btc, { gasLimit: 10000000 });
  await tx.wait();

  // Getting the address of the deployed contract account
  const abiCoder = new ethers.utils.AbiCoder();
  let multisigAddress = utils.create2Address(
    factoryAddress,
    await paFactory.aaBytecodeHash(),
    salt,
    abiCoder.encode(["owner", "dex", "doge", "pepe", "shib", "btc"], [owner, dex, doge, pepe, shib, btc])
  );

  const pensionAccountContract = new ethers.Contract(multisigAddress, paFactoryArtifact.abi, wallet);
  return pensionAccountContract;
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