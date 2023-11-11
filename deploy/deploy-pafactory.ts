import { utils, Wallet } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { config, saveContractToVars } from "./utils";

const KEY = config.firstWalletPrivateKey;

export default async function (hre: HardhatRuntimeEnvironment) {
  // Private key of the account used to deploy
  const wallet = new Wallet(KEY);
  const deployer = new Deployer(hre, wallet);
  const pensionAccountFactoryArtifact = await deployer.loadArtifact("PensionAccountFactory");
  const paArtifact = await deployer.loadArtifact("PensionAccount");

  // Getting the bytecodeHash of the account
  const bytecodeHash = utils.hashBytecode(paArtifact.bytecode);

  const factory = await deployer.deploy(
    pensionAccountFactoryArtifact,
    [bytecodeHash],
    undefined,
    [
      // Since the factory requires the code of the multisig to be available,
      // we should pass it here as well.
      paArtifact.bytecode,
    ]
  );

  console.log(`Pension Account factory address: ${factory.address}`);
  saveContractToVars(hre.network.name, "PensionAccountFactory", factory.address);
}
