// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

contract PensionAccountFactory {
    bytes32 public pensionAccountBytecodeHash;

    constructor(bytes32 _pensionAccountBytecodeHash) {
        pensionAccountBytecodeHash = _pensionAccountBytecodeHash;
    }

    function deployPensionAccount(
        bytes32 salt,
        address owner,
        address dex,
        address doge,
        address pepe,
        address shib,
        address btc
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
                        abi.encode(owner, dex, doge, pepe, shib, btc),
                        IContractDeployer.AccountAbstractionVersion.Version1
                    )
                )
            );
        require(success, "Deployment failed");

        (pensionAccountAddress) = abi.decode(returnData, (address));
    }
}
