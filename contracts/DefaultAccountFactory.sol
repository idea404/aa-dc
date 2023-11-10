// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

contract DefaultAccountFactory {
    bytes32 public pensionAccountBytecodeHash;

    constructor(bytes32 _pensionAccountBytecodeHash) {
        pensionAccountBytecodeHash = _pensionAccountBytecodeHash;
    }

    function deployPensionAccount(
        bytes32 salt
    ) external returns (address pensionAccountAddress) {
        (bool success, bytes memory returnData) = SystemContractsCaller
            .systemCallWithReturndata(
                uint32(gasleft()),
                address(DEPLOYER_SYSTEM_CONTRACT),
                uint128(0),
                abi.encodeCall(
                    DEPLOYER_SYSTEM_CONTRACT.create2Account,
                    (
                        salt,
                        pensionAccountBytecodeHash,
                        abi.encode(),
                        IContractDeployer.AccountAbstractionVersion.Version1
                    )
                )
            );
        require(success, "Deployment failed");

        (pensionAccountAddress) = abi.decode(returnData, (address));
    }
}
