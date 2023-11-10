import "@matterlabs/hardhat-zksync-node/dist/type-extensions";
import { expect } from "chai";
import * as hre from "hardhat";
import { ethers } from "ethers";
import * as zks from "zksync-web3";
import { deployFactory, deployMultisig, fundAccount, MultiSigWallet, signMultiSigTx } from "./utils";

const config = {
  firstWalletPrivateKey: "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110",
  firstWalletAddress: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
};

describe("Account Abstraction Tests", function () {
  let accountContractName: string;
  let accountContract: zks.Contract;
  let factoryContractName: string;
  let factoryContract: zks.Contract;
  let provider: zks.Provider;
  let firstRichWallet: zks.Wallet;
  let result: any;

  before(async function () {
    provider = new zks.Provider(hre.network.config.url);
    firstRichWallet = new zks.Wallet(config.firstWalletPrivateKey, provider);
  });

  describe("MultiSig Account Abstraction Tests", function () {
    accountContractName = "TwoUserMultisig";
    factoryContractName = "AAFactory";
    describe("MultiSig Account Factory", function () {
      before(async function () {
        factoryContract = await deployFactory(firstRichWallet, accountContractName, factoryContractName);
      });

      it("Should have a tx hash that starts from 0x", async function () {
        result = factoryContract.deployTransaction.hash;
        expect(result).to.contains("0x");
      });
    });

    describe("MultiSig Account", async function () {
      let ownerWallet1: zks.Wallet;
      let ownerWallet2: zks.Wallet;
      let multiSigWallet: MultiSigWallet;
      before(async function () {
        ownerWallet1 = zks.Wallet.createRandom();
        ownerWallet2 = zks.Wallet.createRandom();
        accountContract = await deployMultisig(firstRichWallet, factoryContract.address, ownerWallet1, ownerWallet2);
        await fundAccount(firstRichWallet, accountContract.address);
        // await signMultiSigTx(firstRichWallet, accountContract.address, factoryContract.address, ownerWallet1, ownerWallet2);
      });

      it("Should have a tx hash that starts from 0x", async function () {
        result = factoryContract.deployTransaction.hash;
        expect(result).to.contains("0x");
      });

      it("Should have a balance", async function () {
        const result = await accountContract.provider.getBalance(accountContract.address);
        const balance = parseFloat(ethers.utils.formatEther(result));
        expect(balance).to.be.greaterThan(99.99);
      });

      it("Should be able to send 10 ETH to the main wallet", async function () {
        multiSigWallet = new MultiSigWallet(
          accountContract.address, 
          ownerWallet1.privateKey, 
          ownerWallet2.privateKey, 
          provider
        );
        const balanceBefore = (await provider.getBalance(firstRichWallet.address)).toBigInt();
        await (
          await multiSigWallet.transfer({
            to: firstRichWallet.address,
            amount: ethers.utils.parseUnits("10", 18),
            overrides: { type: 113 },
          })
        ).wait();
        const balance = (await provider.getBalance(firstRichWallet.address)).toBigInt();
        const difference = balance - balanceBefore;
        // expect to be slightly higher than 5
        expect(difference / BigInt(10 ** 18) > 9.9).to.be.true;
        expect(difference / BigInt(10 ** 18) < 10.1).to.be.true;
      });
    });
  });
});
