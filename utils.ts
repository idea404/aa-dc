import { Contract, utils } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers } from "ethers";

export async function deployContract(deployer: Deployer, contractName: string, args: any[] = [], additionalFactoryDeps: string[] = []): Promise<Contract> {
  const artifact = await deployer.loadArtifact(contractName);
  const deploymentFee = await deployer.estimateDeployFee(artifact, args);
  const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
  console.log(`The ${artifact.contractName} deployment is estimated to cost ${parsedFee} ETH`);
  const contract = await deployer.deploy(artifact, args, undefined, additionalFactoryDeps);
  logBlue(`${artifact.contractName} was deployed to ${contract.address}`);
  return contract;
}

export async function deployAccountAbstraction(deployer: Deployer, factoryContractName: string, accountContractName: string): Promise<Contract> {
  const aaArtifact = await deployer.loadArtifact(accountContractName);
  const bytecodeHash = utils.hashBytecode(aaArtifact.bytecode);
  const aaFactoryContract = await deployContract(deployer, factoryContractName, [bytecodeHash], [aaArtifact.bytecode]);
  logBlue(`${aaFactoryContract.contractName} was deployed to ${aaFactoryContract.address}`);
  const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));
  // using deployer address as account admin
  let tx = await aaFactoryContract.deployAccount(salt, deployer.zkWallet.address);
  await tx.wait();
  const abiCoder = new ethers.utils.AbiCoder();
  const accountAbstractionAddress = utils.create2Address(
    aaFactoryContract.address,
    await aaFactoryContract.aaBytecodeHash(),
    salt,
    abiCoder.encode(["address"], [deployer.zkWallet.address])
  );
  logBlue(`${aaArtifact.contractName} was deployed to ${accountAbstractionAddress}`);
  return new ethers.Contract(accountAbstractionAddress, aaArtifact.abi, deployer.zkWallet);
}

function logBlue(value: string) {
  console.log('\x1b[36m%s\x1b[0m', value);
}