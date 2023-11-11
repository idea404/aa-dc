import "@matterlabs/hardhat-zksync-node/dist/type-extensions";
import { expect } from "chai";
import * as hre from "hardhat";
import { ethers } from "ethers";
import * as zks from "zksync-web3";
import { deployFactory, deployMultisig, fundAccount, MultiSigWallet, deployPension, PensionWallet } from "./utils";

const config = {
  firstWalletPrivateKey: "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110",
  firstWalletAddress: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
};

describe("Account Abstraction Tests", function () {
  let provider: zks.Provider;
  let firstRichWallet: zks.Wallet;
  let result: any;

  before(async function () {
    provider = new zks.Provider(hre.network.config.url);
    firstRichWallet = new zks.Wallet(config.firstWalletPrivateKey, provider);
  });

  describe("MultiSig Account Abstraction Tests", function () {
    const accountContractName = "TwoUserMultisig";
    const factoryContractName = "AAFactory";
    let factoryContract: ethers.Contract;
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
      let accountContract: ethers.Contract;
      let multiSigWallet: MultiSigWallet;
      let ownerWallet1: zks.Wallet;
      let ownerWallet2: zks.Wallet;
      before(async function () {
        ownerWallet1 = zks.Wallet.createRandom();
        ownerWallet2 = zks.Wallet.createRandom();
        accountContract = await deployMultisig(firstRichWallet, factoryContract.address, ownerWallet1, ownerWallet2);
        await fundAccount(firstRichWallet, accountContract.address);
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

  describe("Pension Account Abstraction Tests", function () {
    const accountContractName = "PensionAccount";
    const factoryContractName = "PensionAccountFactory";
    let factoryContract: ethers.Contract;
    describe("Pension Account Factory", function () {
      before(async function () {
        factoryContract = await deployFactory(firstRichWallet, accountContractName, factoryContractName);
      });

      it("Should have a tx hash that starts from 0x", async function () {
        result = factoryContract.deployTransaction.hash;
        expect(result).to.contains("0x");
      });
    });

    describe("Pension Account", function () {
      const ownerWallet = zks.Wallet.createRandom();
      let pensionAccountContract: ethers.Contract;
      before(async function () {
        pensionAccountContract = await deployPension(firstRichWallet, factoryContract.address, ownerWallet);
        await fundAccount(firstRichWallet, pensionAccountContract.address);
      });

      it("Should have a tx hash that starts from 0x", async function () {
        result = factoryContract.deployTransaction.hash;
        expect(result).to.contains("0x");
      });

      it("Should have a balance", async function () {
        const result = await pensionAccountContract.provider.getBalance(pensionAccountContract.address);
        const balance = parseFloat(ethers.utils.formatEther(result));
        expect(balance).to.be.greaterThan(9.99);
      });

      it("Should distribute investments correctly", async function () {
        // Send 10 ETH to the pension account
        const sendAmount = ethers.utils.parseUnits("20", 18);
        await firstRichWallet.transfer({
          to: pensionAccountContract.address,
          amount: sendAmount,
          overrides: { type: 113 },
        });
  
        // Call getInvestmentDetails to get investment distribution
        const investmentDetails = await pensionAccountContract.getInvestmentDetails();
  
        // Check total ETH received
        const ethReceived = parseFloat(ethers.utils.formatEther(investmentDetails.ethReceived));
        expect(ethReceived).to.equal(120);
  
        // Check distribution to each token (30 ETH each)
        const expectedInvestmentPerToken = 30;
        const dogeInvestment = parseFloat(ethers.utils.formatEther(investmentDetails.dogeInvestment));
        expect(dogeInvestment).to.equal(expectedInvestmentPerToken);
        const pepeInvestment = parseFloat(ethers.utils.formatEther(investmentDetails.pepeInvestment));
        expect(pepeInvestment).to.equal(expectedInvestmentPerToken);
        const shibInvestment = parseFloat(ethers.utils.formatEther(investmentDetails.shibInvestment));
        expect(shibInvestment).to.equal(expectedInvestmentPerToken);
        const btcInvestment = parseFloat(ethers.utils.formatEther(investmentDetails.btcInvestment));
        expect(btcInvestment).to.equal(expectedInvestmentPerToken);
      });

      it("Should not be able to withdraw before the lockup period", async function () {
        const pensionWallet = new PensionWallet(
          pensionAccountContract.address, 
          ownerWallet.privateKey, 
          provider
        );
        const balanceBefore = (await provider.getBalance(ownerWallet.address)).toBigInt();
        try {
          const tx = await pensionWallet.transfer({
              to: firstRichWallet.address,
              amount: ethers.utils.parseUnits("10", 18),
              overrides: { type: 113 },
            });
          tx.wait();
          // expect to fail
          expect(true).to.be.false;
        } catch (e) {
          expect(e.message).to.contains("execution reverted: Failed to pay for the transaction: Action locked until expiry time");
        }
        const balance = (await provider.getBalance(ownerWallet.address)).toBigInt();
        const difference = balanceBefore - balance;
        // expect no difference 
        expect(difference.toString().substring(0, 2)).to.equal("0");
      });
    });
  });
});
