import { Wallet, Provider } from "zksync-web3";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { deployAccountAbstraction } from "../utils";

import dotenv from "dotenv";
dotenv.config();

const KEY = process.env.PRIVATE_KEY as string;

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider({ url: (hre.network.config as HttpNetworkConfig).url });
  const wallet = new Wallet(KEY).connect(provider);
  const deployer = new Deployer(hre, wallet);
  await deployAccountAbstraction(deployer, "SharedAccountWithRestrictionsFactory", "SharedAccountWithRestrictions");
}
