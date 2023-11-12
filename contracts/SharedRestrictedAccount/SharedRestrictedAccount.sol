// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

contract SharedRestrictedAccount is IAccount, IERC1271, IERC721Receiver {
    using TransactionHelper for Transaction;

    address private admin;
    address[] private owners;
    address[] private allowedCallAddresses;
    mapping(address => bytes4[]) public callAddressAllowedMethodSelectors;

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this function"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    modifier onlyAdmin() {
        require(
            msg.sender == admin,
            "Forbidden"
        );
        // Continue execution if called from the admin.
        _;
    }

    constructor(address _admin) {
        admin = _admin;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function addOwner(address owner) external onlyAdmin {
        owners.push(owner);
    }

    function deleteOwners() external onlyAdmin {
        delete owners;
    }

    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function addAllowedCallAddress(address allowedCallAddress, bytes4[] memory allowedMethodSelectors) external onlyAdmin {
        allowedCallAddresses.push(allowedCallAddress);
        callAddressAllowedMethodSelectors[allowedCallAddress] = allowedMethodSelectors;
    }

    function clearAllowedCallAddresses() external onlyAdmin {
        for (uint i = 0; i < allowedCallAddresses.length; i++) {
            delete callAddressAllowedMethodSelectors[allowedCallAddresses[i]];
        }
        delete allowedCallAddresses;
    }

    function getAllowedCallAddresses() public view returns (address[] memory) {
        return allowedCallAddresses;
    }

    function isAllowedCallAddress(address addr) private view returns (bool) {
        for (uint i = 0; i < allowedCallAddresses.length; i++) {
            if (allowedCallAddresses[i] == addr) {
                return true;
            }
        }
        return false;
    }

    function isAllowedCallAddressMethodSelector(address addr, bytes4 methodSelector) private view returns (bool) {
        if (!isAllowedCallAddress(addr)) {
            return false;
        }
        // empty array of method selectors means every method is allowed
        if (callAddressAllowedMethodSelectors[addr].length == 0) {
            return true;
        }
        for (uint i = 0; i < callAddressAllowedMethodSelectors[addr].length; i++) {
            if (callAddressAllowedMethodSelectors[addr][i] == methodSelector) {
                return true;
            }
        }
        return false;
    }

    function validateTransaction(
        bytes32,
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) external payable override onlyBootloader returns (bytes4 magic) {
        return _validateTransaction(_suggestedSignedHash, _transaction);
    }

    function _validateTransaction(
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) internal returns (bytes4) {
        // Incrementing the nonce of the account.
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            address(NONCE_HOLDER_SYSTEM_CONTRACT),
            0,
            abi.encodeCall(INonceHolder.incrementMinNonceIfEquals, (_transaction.nonce))
        );

        bytes32 txHash;
        // While the suggested signed hash is usually provided, it is generally
        // not recommended to rely on it to be present, since in the future
        // there may be tx types with no suggested signed hash.
        if (_suggestedSignedHash == bytes32(0)) {
            txHash = _transaction.encodeHash();
        } else {
            txHash = _suggestedSignedHash;
        }

        // The fact there is enough balance for the account
        // should be checked explicitly to prevent user paying for fee for a
        // transaction that wouldn't be included on Ethereum.
        uint256 totalRequiredBalance = _transaction.totalRequiredBalance();
        require(totalRequiredBalance <= address(this).balance, "Not enough balance for fee + value");

        if (isValidSignature(txHash, _transaction.signature) != EIP1271_SUCCESS_RETURN_VALUE) {
            return bytes4(0);
        }

        address to = address(uint160(_transaction.to));
        bytes4 methodSelector = bytes4(_transaction.data[0:4]);
        if (!isAllowedCallAddressMethodSelector(to, methodSelector)) {
            return bytes4(0);
        }

        return ACCOUNT_VALIDATION_SUCCESS_MAGIC;
    }

    function executeTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _executeTransaction(_transaction);
    }

    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        uint128 value = Utils.safeCastToU128(_transaction.value);
        bytes memory data = _transaction.data;

        if (to == address(DEPLOYER_SYSTEM_CONTRACT)) {
            uint32 gas = Utils.safeCastToU32(gasleft());

            // Note, that the deployer contract can only be called
            // with a "systemCall" flag.
            SystemContractsCaller.systemCallWithPropagatedRevert(gas, to, value, data);
        } else {
            bool success;
            assembly {
                success := call(gas(), to, value, add(data, 0x20), mload(data), 0, 0)
            }
            require(success);
        }
    }

    function executeTransactionFromOutside(Transaction calldata)
        external
        payable
    {
        revert("executeTransactionFromOutside is not implemented");
    }

    function isValidSignature(bytes32 _hash, bytes memory _signature)
        public
        view
        override
        returns (bytes4)
    {
        if(!checkValidECDSASignatureFormat(_signature)) {
            return bytes4(0);
        }

        (address recoveredAddr, ECDSA.RecoverError error) = ECDSA.tryRecover(_hash, _signature);
        if (error != ECDSA.RecoverError.NoError) {
            return bytes4(0);
        }

        // check if signer is one of the owners
        for (uint i = 0; i < owners.length; i++) {
            if (owners[i] == recoveredAddr) {
                return EIP1271_SUCCESS_RETURN_VALUE;
            }
        }
        return bytes4(0);
    }

    // This function verifies that the ECDSA signature is both in correct format and non-malleable
    function checkValidECDSASignatureFormat(bytes memory _signature) internal pure returns (bool) {
        if(_signature.length != 65) {
            return false;
        }

        uint8 v;
		bytes32 r;
		bytes32 s;
		// Signature loading code
		// we jump 32 (0x20) as the first slot of bytes contains the length
		// we jump 65 (0x41) per signature
		// for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
		assembly {
			r := mload(add(_signature, 0x20))
			s := mload(add(_signature, 0x40))
			v := and(mload(add(_signature, 0x41)), 0xff)
		}
		if(v != 27 && v != 28) {
            return false;
        }

		// EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (301): 0 < s < secp256k1n ÷ 2 + 1, and for v in (302): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        if(uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return false;
        }

        return true;
    }

    function payForTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        bool success = _transaction.payToTheBootloader();
        require(success, "Failed to pay the fee to the operator");
    }

    function prepareForPaymaster(
        bytes32, // _txHash
        bytes32, // _suggestedSignedHash
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _transaction.processPaymasterInput();
    }

    fallback() external {
        // fallback of default account shouldn't be called by bootloader under no circumstances
        assert(msg.sender != BOOTLOADER_FORMAL_ADDRESS);

        // If the contract is called directly, behave like an EOA
    }

    receive() external payable {
        // If the contract is called directly, behave like an EOA.
        // Note, that is okay if the bootloader sends funds with no calldata as it may be used for refunds/operator payments
    }
}
