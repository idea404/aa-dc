// This script will:
// 1. fast forward the blockchain by 10 blocks

import { config } from "../deploy/utils";
import * as zks from "zksync-web3";

const RPC_URL = config.L2RpcUrl;

async function advanceBlocks(blockCount: number, provider: zks.Provider) {
  for (let i = 0; i < blockCount; i++) {
    // Use the 'send' method to send the 'evm_mine' request
    await provider.send('evm_mine', []);
  }
}

async function main() {
  // Create a new provider instance
  const provider = new zks.Provider(RPC_URL);
  // Fast forward the blockchain by 10 blocks
  await advanceBlocks(10, provider);
  console.log(`Fast forwarded 10 blocks`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

