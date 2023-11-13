import "@matterlabs/hardhat-zksync-node/dist/type-extensions";
import { expect } from "chai";
import * as hre from "hardhat";
import { ethers } from "ethers";
import * as zks from "zksync-web3";
import { deployFactory, deployMultisig, fundAccount, MultiSigWallet, deployPension, SingleSignerAAWallet, advanceBlocks, deploySharedRestricted, deployContract } from "./utils";

const config = {
  firstWalletPrivateKey: "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110",
  firstWalletAddress: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
  secondWalletPrivateKey: "0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3",
  secondWalletAddress: "0xa61464658AfeAf65CccaaFD3a512b69A83B77618",
  thirdWalletPrivateKey: "0xd293c684d884d56f8d6abd64fc76757d3664904e309a0645baf8522ab6366d9e",
  thirdWalletAddress: "0x0D43eB5B8a47bA8900d84AA36656c92024e9772e",
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
        // expect to be about 10
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
        const pensionWallet = new SingleSignerAAWallet(
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
          expect(e.message).to.contains("execution reverted: Failed to pay for the transaction: Current block: 17, Expiry block: 21. Action locked until expiry block.");
        }
        const balance = (await provider.getBalance(ownerWallet.address)).toBigInt();
        const difference = balanceBefore - balance;
        // expect no difference 
        expect(difference.toString().substring(0, 2)).to.equal("0");
      });

      it("Should be able to withdraw after the lockup period", async function () {
        // Advance the blockchain by 10 blocks
        await advanceBlocks(10);
    
        const pensionWallet = new SingleSignerAAWallet(
          pensionAccountContract.address, 
          ownerWallet.privateKey, 
          provider
        );

        const balanceBefore = (await provider.getBalance(firstRichWallet.address)).toBigInt();
        const tx = await pensionWallet.transfer({
          to: firstRichWallet.address,
          amount: ethers.utils.parseUnits("10", 18),
          overrides: { type: 113 },
        });
        await tx.wait();
    
        const balanceAfter = (await provider.getBalance(firstRichWallet.address)).toBigInt();
        const difference = balanceAfter - balanceBefore;
    
        // Assert that the balance has increased by approximately 10 ETH
        expect(difference / BigInt(10 ** 18) > 9.9).to.be.true;
        expect(difference / BigInt(10 ** 18) < 10.1).to.be.true;
      });
    });
  });

  describe("Shared Restricted Account Abstraction Tests", function () {
    const accountContractName = "SharedRestrictedAccount";
    const factoryContractName = "SharedRestrictedAccountFactory";
    let factoryContract: ethers.Contract;
    describe("Shared Restricted Account Factory", function () {
      before(async function () {
        factoryContract = await deployFactory(firstRichWallet, accountContractName, factoryContractName);
      });

      it("Should have a tx hash that starts from 0x", async function () {
        result = factoryContract.deployTransaction.hash;
        expect(result).to.contains("0x");
      });
    });

    describe("Shared Restricted Account", function () {
      const firstOwnerWallet = new zks.Wallet(config.secondWalletPrivateKey, provider);
      const secondOwnerWallet = new zks.Wallet(config.thirdWalletPrivateKey, provider);
      let sharedRestrictedAccountContract: ethers.Contract;
      let testContract1: ethers.Contract;
      let testContract2: ethers.Contract;
      let testContract3: ethers.Contract;
      before(async function () {
        sharedRestrictedAccountContract = await deploySharedRestricted(firstRichWallet, factoryContract.address, firstRichWallet);
        await fundAccount(firstRichWallet, sharedRestrictedAccountContract.address);
        testContract1 = await deployContract(firstRichWallet, "TestContract");
        testContract2 = await deployContract(firstRichWallet, "TestContract");
        testContract3 = await deployContract(firstRichWallet, "TestContract");
      });

      it("Should have a tx hash that starts from 0x", async function () {
        result = factoryContract.deployTransaction.hash;
        expect(result).to.contains("0x");
      });

      it("Should have no owners initially", async function () {
        const owners = await sharedRestrictedAccountContract.getOwners();
        expect(owners.length).to.equal(0);
      });

      it("Should be able to add owners", async function () {
        const tx = await sharedRestrictedAccountContract.addOwner(firstOwnerWallet.address);
        await tx.wait();
        const owners = await sharedRestrictedAccountContract.getOwners();
        expect(owners.length).to.equal(1);
        expect(owners[0]).to.equal(firstOwnerWallet.address);
        const tx2 = await sharedRestrictedAccountContract.addOwner(secondOwnerWallet.address);
        await tx2.wait();
        const owners2 = await sharedRestrictedAccountContract.getOwners();
        expect(owners2.length).to.equal(2);
        expect(owners2[0]).to.equal(firstOwnerWallet.address);
        expect(owners2[1]).to.equal(secondOwnerWallet.address);
      });

      it("Should have no allowed call addresses initially", async function () {
        const allowedCallAddresses = await sharedRestrictedAccountContract.getAllowedCallAddresses();
        expect(allowedCallAddresses.length).to.equal(0);
      });

      it("Should be able to add allowed call addresses", async function () {
        const tx = await sharedRestrictedAccountContract.addAllowedCallAddress(testContract1.address, [
          testContract1.interface.getSighash('testFunction1')
        ]);
        await tx.wait();
        const allowedCallAddresses = await sharedRestrictedAccountContract.getAllowedCallAddresses();
        expect(allowedCallAddresses.length).to.equal(1);
        expect(allowedCallAddresses[0]).to.equal(testContract1.address);
        const tx2 = await sharedRestrictedAccountContract.addAllowedCallAddress(testContract2.address, [
          testContract2.interface.getSighash('testFunction2')
        ]);
        await tx2.wait();
        const allowedCallAddresses2 = await sharedRestrictedAccountContract.getAllowedCallAddresses();
        expect(allowedCallAddresses2.length).to.equal(2);
        expect(allowedCallAddresses2[0]).to.equal(testContract1.address);
        expect(allowedCallAddresses2[1]).to.equal(testContract2.address);
      });

      it("Should not be able to use account with some random wallet", async function () {
        const randomWallet = zks.Wallet.createRandom();
        const accountWallet = new SingleSignerAAWallet(
          sharedRestrictedAccountContract.address, 
          randomWallet.privateKey, 
          provider
        );
        try {
          accountWallet.transfer({
            to: firstRichWallet.address,
            amount: ethers.utils.parseUnits("1", 18),
            overrides: { type: 113 },
          });
        } catch (e) {
          expect(e.message).to.contains("execution reverted: Account validation error");
        }
      });

      it("Should be able to use account with owner wallet and allowed contract method", async function () {
        const accountWallet = new SingleSignerAAWallet(
          sharedRestrictedAccountContract.address, 
          firstOwnerWallet.privateKey, 
          provider
        );
        const testContract1accountWallet = testContract1.connect(accountWallet);
        const result = await testContract1accountWallet.testFunction1(firstOwnerWallet.address);
        expect(result).to.equal(firstOwnerWallet.address);
        const testContract2accountWallet = testContract2.connect(accountWallet);
        const result2 = await testContract2accountWallet.testFunction2();
        expect(result2).to.equal(true);
      });

      it("Should not be able to use account with owner wallet and not allowed call address", async function () {
        const accountWallet = new SingleSignerAAWallet(
          sharedRestrictedAccountContract.address, 
          firstOwnerWallet.privateKey, 
          provider
        );
        const testContract3accountWallet = testContract3.connect(accountWallet);
        try {
          testContract3accountWallet.testFunction1(firstOwnerWallet.address);
        } catch (e) {
          expect(e.message).to.contains("execution reverted: Account validation error");
        }
      });

      it("Should not be able to use account with owner wallet and allowed call address but not allowed method", async function () {
        const accountWallet = new SingleSignerAAWallet(
          sharedRestrictedAccountContract.address, 
          firstOwnerWallet.privateKey, 
          provider
        );
        const testContract1accountWallet = testContract1.connect(accountWallet);
        try {
          testContract1accountWallet.testFunction3();
        } catch (e) {
          expect(e.message).to.contains("execution reverted: Account validation error");
        }
      });
    });
  });
});
