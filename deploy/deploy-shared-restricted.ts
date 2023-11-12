import { Wallet, Provider, utils } from "zksync-web3";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { config, saveContractToVars } from "../deploy/utils";
import { ethers } from "ethers";

const KEY = config.firstWalletPrivateKey;

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider({ url: (hre.network.config as HttpNetworkConfig).url });
  const wallet = new Wallet(KEY).connect(provider);
  const deployer = new Deployer(hre, wallet);
  const accountFactoryArtifact = await deployer.loadArtifact("SharedRestrictedAccountFactory");
  const accountArtifact = await deployer.loadArtifact("SharedRestrictedAccount");

  // Deploy the factory
  const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);
  const factory = await deployer.deploy(accountFactoryArtifact, [bytecodeHash], undefined, [accountArtifact.bytecode]);
  console.log(`SharedRestrictedAccountFactory address: ${factory.address}`);
  saveContractToVars(hre.network.name, "SharedRestrictedAccountFactory", factory.address);

  // Deploy the account
  const salt = ethers.constants.HashZero;

  // deploy account owned by owner1 & owner2
  const tx = await factory.deployAccount(salt, wallet.address);
  await tx.wait();

  // Getting the address of the deployed contract account
  const abiCoder = new ethers.utils.AbiCoder();
  let accountAddress = utils.create2Address(factory.address, await factory.aaBytecodeHash(), salt, abiCoder.encode(["address"], [wallet.address]));
  console.log(`SharedRestrictedAccount address: ${accountAddress}`);
  saveContractToVars(hre.network.name, "SharedRestrictedAccount", accountAddress);
}
