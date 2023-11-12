# Account Abstraction Examples

This repo contains examples for account abstraction on zkSync. 

## Examples

### MultiSig Account

This example shows how to create a multi-signature account on zkSync. The account is controlled by 2 keys, and requires both signatures to perform a transaction.

- [MultiSig Account](./contracts/MultiSig/TwoUserMultisig.sol)

### Pension Account 

This example shows how to create a pension account on zkSync. The account is controlled by one key. The account also has a block-lock, which prevents any transactions from being performed until a certain block has passed.

- [Pension Account](./contracts/PensionAccount/PensionAccount.sol)

### Shared Account with Restrictions

This example shows how to create a shared account on zkSync. The account is controlled by any arbitrary number of keys - added or removed by an admin, and requires any of those signatures to perform a transaction. The account also has a permissioned set of contracts and contract methods it can call.

- [Shared Account](./contracts/SharedRestrictedAccount/SharedRestrictedAccount.sol)
