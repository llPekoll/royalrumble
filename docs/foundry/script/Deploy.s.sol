// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Domin8} from "../src/domin8.sol";

// FIXME: ADD A PROXY DEPLOYMENT SCRIPT HERE

contract DeployDomin8 is Script {
    Domin8 public domin8;


    /** Domin8 constructor params
    * _authority The address authorized to control game progression.
    * _treasury The address where house fees will be sent.
    * _houseFeeBasisPoints The house's cut of the pot, in basis points.
    * _minBet The minimum bet amount in wei.
    * _waitingPhaseDuration The duration of the betting window in seconds.
    * _vrfCoordinator The address of the Chainlink VRF Coordinator contract.
    * _subscriptionId The ID of the Chainlink VRF subscription.
    * _keyHash The gas lane key hash for the desired gas price.
    */

    address public constant VRF_COORDINATOR =
        0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE; // Base Sepolia VRF Coordinator
    address public constant AUTHORITY =
        address(0x893806663C6673b96f61914E17e002E4F303b62f); // Replace with your authority address
    address payable public constant TREASURY =
        payable(0x893806663C6673b96f61914E17e002E4F303b62f); // Replace with your treasury address
    uint16 public constant HOUSE_FEE_BASIS_POINTS = 500; // 5%
    uint256 public constant MIN_BET = 10000000000000000; // 0.01 ETH
    uint64 public constant WAITING_PHASE_DURATION = 30; // 30 seconds
    uint256 public constant SUBSCRIPTION_ID = 8369097389651250853091038804433237964774285691251465610172074079640543109405; // Replace with your subscription ID, created on https://vrf.chain.link/base-sepolia/new
    bytes32 public constant KEY_HASH =
        0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899; // https://vrf.chain.link/polygon-amoy

    function run() public {
        vm.startBroadcast();

        domin8 = new Domin8(
            AUTHORITY,
            TREASURY,
            HOUSE_FEE_BASIS_POINTS,
            MIN_BET,
            WAITING_PHASE_DURATION,
            VRF_COORDINATOR,
            SUBSCRIPTION_ID,
            KEY_HASH
        );
        console.log("Domin8 deployed at:", address(domin8));
        vm.stopBroadcast();
    }
}
