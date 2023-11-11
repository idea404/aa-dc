import fs from "fs";
import path from "path";

const JSON_FILE_PATH = path.join(__dirname, "vars.json");

export function saveContractToVars(network: string, contractName: string, contractAddress: string, varsPath = JSON_FILE_PATH) {
  console.log(`Saving ${contractName} to vars.json`);
  const config = JSON.parse(fs.readFileSync(varsPath, "utf-8"));

  if (!config[network]) {
    config[network] = { deployed: [] };
  }

  const deployedContracts = config[network].deployed;
  const existingContractIndex = deployedContracts.findIndex((contract: { name: string; }) => contract.name === contractName);

  if (existingContractIndex === -1) {
    console.log(`Adding ${contractName} to vars.json`);
    deployedContracts.push({
      name: contractName,
      address: contractAddress,
    });
  } else {
    console.log(`Updating ${contractName} in vars.json`);
    deployedContracts[existingContractIndex].address = contractAddress;
  }

  fs.writeFileSync(varsPath, JSON.stringify(config, null, 2));
}

export function getDeployedContractDetailsFromVars(network: string, contractName: string, varsPath = JSON_FILE_PATH) {
  const config = JSON.parse(fs.readFileSync(varsPath, "utf-8"));
  const deployedContracts = config[network].deployed;
  const existingContract = deployedContracts.find((contract: { name: string; }) => contract.name === contractName);

  if (!existingContract) {
    throw new Error(`Contract ${contractName} not found in vars.json`);
  }

  return existingContract;
}

export const config = {
  L2RpcUrl: "http://127.0.0.1:8011",
  firstWalletPrivateKey: "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110",
  firstWalletAddress: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
  secondWalletPrivateKey: "0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3",
  secondWalletAddress: "0xa61464658AfeAf65CccaaFD3a512b69A83B77618",
};

export function createMockAddress(base: string) {
  const baseHex = base.replace(/[^0-9A-Fa-f]/g, ''); // Remove non-hex characters
  const paddingLength = 40 - baseHex.length; // Calculate padding length
  return '0x' + baseHex + '0'.repeat(paddingLength);
}
