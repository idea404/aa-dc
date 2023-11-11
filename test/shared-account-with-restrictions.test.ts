import "@matterlabs/hardhat-zksync-node/dist/type-extensions";
import * as hre from "hardhat";
import { ethers, BigNumber } from "ethers";
import * as zks from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { expectThrowsAsync, fundAccount } from "./utils";
import { deployAccountAbstraction, deployContract } from "../utils";

const config = {
  firstWalletPrivateKey: "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110",
  firstWalletAddress: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
};

async function sendAATransaction(
  tx: ethers.PopulatedTransaction,
  aaContractAddress: string,
  provider: zks.Provider,
  signer: zks.Wallet,
  customGasLimit?: BigNumber
) {
  tx.from = aaContractAddress;
  const gasLimit = customGasLimit || await provider.estimateGas(tx);
  const gasPrice = await provider.getGasPrice();
  tx = {
    ...tx,
    gasLimit,
    gasPrice,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(aaContractAddress),
    type: 113,
    customData: {
      gasPerPubdata: zks.utils.DEFAULT_GAS_PER_PUBDATA_LIMIT
    } as zks.types.Eip712Meta,
    value: BigNumber.from(0),
  };
  const signedTxHash = zks.EIP712Signer.getSignedDigest(tx);
  const signature = ethers.utils.joinSignature(signer._signingKey().signDigest(signedTxHash));
  tx.customData = {
    ...tx.customData,
    customSignature: signature,
  };
  const aaTx = await provider.sendTransaction(zks.utils.serialize(tx));
  await aaTx.wait();
}

describe("Shared account with restrictions", function () {
  let provider: zks.Provider;
  let admin: zks.Wallet;

  before(async function () {
    provider = new zks.Provider(hre.network.config.url);
    admin = new zks.Wallet(config.firstWalletPrivateKey, provider);
  });

  // single test just to showcase how it works
  it("verifies account works as expected", async () => {
    const deployer = new Deployer(hre, admin);

    // Deploy AA contract
    const aaContract = await deployAccountAbstraction(deployer, "SharedAccountWithRestrictionsFactory", "SharedAccountWithRestrictions");

    // Fund the AA contract
    await fundAccount(admin, aaContract.address, "2");

    // Deploy some test contracts
    const testContract1 = await deployContract(deployer, "TestContract", []);
    const testContract2 = await deployContract(deployer, "TestContract", []);
    const testContract3 = await deployContract(deployer, "TestContract", []);

    // add owners
    const owner1 = zks.Wallet.createRandom();
    const owner2 = zks.Wallet.createRandom();
    await (await aaContract.addOwner(owner1.address)).wait();
    await (await aaContract.addOwner(owner2.address)).wait();

    // add allowed call addresses and methods
    await (await aaContract.addAllowedCallAddress(testContract1.address, [
      testContract1.interface.getSighash('testFunction1')
    ])).wait();
    await (await aaContract.addAllowedCallAddress(testContract2.address, [
      testContract2.interface.getSighash('testFunction2')
    ])).wait();

    // try to use account with some random wallet
    const randomWallet = zks.Wallet.createRandom();
    let txWithRandomSigner = await testContract1.populateTransaction.testFunction1(randomWallet.address)
    const sendTxSignedByRandomWallet = () => sendAATransaction(
      txWithRandomSigner,
      aaContract.address,
      provider,
      randomWallet
    )
    await expectThrowsAsync(sendTxSignedByRandomWallet, "Account validation error");

    // use account with owner wallet and allowed contract method
    // should not throw
    let txWithOwner1Signer = await testContract1.populateTransaction.testFunction1(owner1.address)
    await sendAATransaction(
      txWithOwner1Signer,
      aaContract.address,
      provider,
      owner1
    );
    // should not throw
    let txWithOwner2Signer = await testContract2.populateTransaction.testFunction2()
    await sendAATransaction(
      txWithOwner2Signer,
      aaContract.address,
      provider,
      owner2
    );

    // try to use account with owner wallet and not allowed call address
    let txWithNotAllowedCallAddress = await testContract3.populateTransaction.testFunction1(owner1.address)
    const sendTxWithNotAllowedCallAddress = () => sendAATransaction(
      txWithNotAllowedCallAddress,
      aaContract.address,
      provider,
      owner1
    )
    await expectThrowsAsync(sendTxWithNotAllowedCallAddress, "Account validation error");

    // try to use account with owner wallet and allowed call address but not allowed method
    let txWithNotAllowedMethod = await testContract1.populateTransaction.testFunction3()
    const sendTxWithNotAllowedMethod = () => sendAATransaction(
      txWithNotAllowedMethod,
      aaContract.address,
      provider,
      owner1
    )
    await expectThrowsAsync(sendTxWithNotAllowedMethod, "Account validation error");
  });
});
