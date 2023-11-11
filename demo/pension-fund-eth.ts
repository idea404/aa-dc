// This script will: 
// 1. Send ETH to the pension account

import { ethers } from "ethers";
import { Provider, Wallet } from "zksync-web3";
import dotenv from "dotenv";
import { getDeployedContractDetailsFromVars, config } from "../deploy/utils";

dotenv.config();

const NETWORK = "zkSyncLocalnet";
const RPC_URL = config.L2RpcUrl;
const PRIVATE_KEY = config.firstWalletPrivateKey;

async function main() {
  const provider = new Provider(RPC_URL);
  const mainWallet = new Wallet(PRIVATE_KEY, provider);

  // Load the contract address from vars.json
  const paAddress = getDeployedContractDetailsFromVars(NETWORK, "PensionAccount").address;
  // send 100 ETH to the paAddress
  const balance = await provider.getBalance(paAddress);
  const tx = await mainWallet.sendTransaction({
    to: paAddress,
    value: ethers.utils.parseEther("100"),
  });
  await tx.wait();
  const newBalance = await provider.getBalance(paAddress);
  console.log(`Sent 100 ETH to Pension Account at: ${paAddress}`);
  console.log(`Balance before: ${ethers.utils.formatEther(balance)} ETH`);
  console.log(`Balance after: ${ethers.utils.formatEther(newBalance)} ETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });