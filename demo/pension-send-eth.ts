// This script will: 
// 1. Attempt to send ETH from the pension contract to another address.

import { ethers } from "ethers";
import { Provider, Wallet, utils, types } from "zksync-web3";
import { getDeployedContractDetailsFromVars, config } from "../deploy/utils";

const NETWORK = "zkSyncLocalnet";
const RPC_URL = config.L2RpcUrl;
const PRIVATE_KEY = config.firstWalletPrivateKey;

// Temporary wallet for testing - that is accepting one private key - and signs the transaction with it.
export class PensionWallet extends Wallet {
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
    // @ts-ignore
    return (0, utils.serialize)(transaction);
  }
}

async function main() {
  const provider = new Provider(RPC_URL);
  const mainWallet = new Wallet(PRIVATE_KEY, provider);

  // Load the contract address from vars.json
  const paAddress = getDeployedContractDetailsFromVars(NETWORK, "PensionAccount").address;
  // construct the wallet class for the pension account
  const paWallet = new PensionWallet(paAddress, config.secondWalletPrivateKey, provider);
  // send 10 ETH from the paAddress to the mainWallet
  const balance = await provider.getBalance(mainWallet.address);
  const tx = await paWallet.transfer({
    to: mainWallet.address,
    amount: ethers.utils.parseUnits("10", 18),
    overrides: { type: 113 },
  });
  await tx.wait();
  const newBalance = await provider.getBalance(mainWallet.address);
  console.log(`Sent 10 ETH from Pension Account to Main Wallet`);
  console.log(`Main Wallet balance before: ${ethers.utils.formatEther(balance)} ETH`);
  console.log(`Main Wallet balance after: ${ethers.utils.formatEther(newBalance)} ETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });