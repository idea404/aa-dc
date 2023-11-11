// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract TestContract {
    function testFunction1(address caller) public pure returns (address) {
        return caller;
    }

    function testFunction2() public pure returns (bool) {   
        return true;
    }

    function testFunction3() public pure returns (bool) {   
        return true;
    }
}
