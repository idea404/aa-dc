# Account Abstraction Examples

This repo contains examples for account abstraction on zkSync. 

### SharedAccountWithRestrictions

The idea is that I as an admin need to create some accounts that have some limitations in terms of what the owners of these accounts should be able to do with them. `SharedAccountWithRestrictions` allows admin to create such account and specify which contracts and which methods of these contracts the owners of the account will be able to call. Admin can add/remove restrictions whenever it is needed.
Additionally `SharedAccountWithRestrictions` allows admin to set more than 1 owner per account. This allows many people to use a single account simultaneously. Let's say I need to provide an account for testing with limited functionality to my entire team, there is no need to create a separate account for everyone and keep each of them funded. `SharedAccountWithRestrictions` allows me to create one account and just set multiple owners. Admin can add/remove owners whenever it is needed.
