import { utils, Wallet, Provider } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { config, getDeployedContractDetailsFromVars, createMockAddress, saveContractToVars } from "./utils";
import { ethers } from "ethers";

const KEY = config.firstWalletPrivateKey;
const OWNER_KEY = config.secondWalletPrivateKey;

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(KEY, provider);
  const walletOwner = new Wallet(OWNER_KEY, provider);
  const factoryAddress = getDeployedContractDetailsFromVars(hre.network.name, "PensionAccountFactory").address;
  const paFactoryArtifact = await hre.artifacts.readArtifact("PensionAccountFactory");
  
  const paFactory = new ethers.Contract(factoryAddress, paFactoryArtifact.abi, wallet);

  // Contract constructor args
  const dex = createMockAddress("decentralizedex"); // "0xdex0000000000000000000000000000000000000"
  const doge = createMockAddress("dogecoin"); // "0xdoge000000000000000000000000000000000000"
  const pepe = createMockAddress("pepecoin"); // "0xpepe000000000000000000000000000000000000"
  const shib = createMockAddress("shibainucoin"); // "0xshib0000000000000000000000000000000000000"
  const btc = createMockAddress("bitcoin"); // "0xbtc00000000000000000000000000000000000000"

  // For the simplicity of the tutorial, we will use zero hash as salt
  const salt = ethers.constants.HashZero;

  // deploy account with dex and token addresses
  const tx = await paFactory.deployPensionAccount(salt, walletOwner.address, dex, doge, pepe, shib, btc, { gasLimit: 10000000 });
  await tx.wait();

  // Getting the address of the deployed contract account
  const abiCoder = new ethers.utils.AbiCoder();
  let contractAddress = utils.create2Address(
    factoryAddress,
    await paFactory.pensionAccountBytecodeHash(),
    salt,
    abiCoder.encode(["address", "address", "address", "address", "address", "address"], [walletOwner.address, dex, doge, pepe, shib, btc])
  );
  saveContractToVars(hre.network.name, "PensionAccount", contractAddress);
}
