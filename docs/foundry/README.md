## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

Before deploying, fill the constructor params (in script/Deploy.s.sol) :
* _authority The address authorized to control game progression.
* _treasury The address where house fees will be sent.
* _houseFeeBasisPoints The house's cut of the pot, in basis points.
* _minBet The minimum bet amount in wei.
* _waitingPhaseDuration The duration of the betting window in seconds.
* _vrfCoordinator The address of the Chainlink VRF Coordinator contract.
* _subscriptionId The ID of the Chainlink VRF subscription.
* _keyHash The gas lane key hash for the desired gas price.

Then, run this command: 

```shell
$ forge script script/Deploy.s.sol --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
