// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {Test, Vm} from "forge-std/Test.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "../src/Domin8.sol";

// =================================================================================================
// Mock Contracts for Local Testing
// =================================================================================================

/**
 * @title VRFCoordinatorV2_5Mock
 * @notice This is a mock contract that simulates the behavior of the Chainlink VRF Coordinator.
 * It is designed for local testing within Foundry. It allows us to trigger the
 * `fulfillRandomWords` callback on our consumer contract manually.
 */
contract VRFCoordinatorV2_5Mock {
    uint256 private s_nextRequestId = 1;

    /**
     * @dev Simulates a request for randomness. In a real scenario, this would trigger an off-chain response.
     * Here, it just returns a predictable request ID.
     */
    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest memory /* requestParams */
    ) external returns (uint256 requestId) {
        requestId = s_nextRequestId;
        s_nextRequestId++;
        // In a real coordinator, an event would be emitted here.
    }

    /**
     * @dev This is the core testing function. The test suite calls this function to simulate
     * the oracle calling back the `fulfillRandomWords` function on the consumer contract.
     * @param _requestId The ID of the request to fulfill.
     * @param _consumer The address of the consumer contract (our Domin8 contract).
     * @param _randomWord A specific number to use as the "random" word for predictable testing.
     */
    function fulfill(uint256 _requestId, address _consumer, uint256 _randomWord) external {
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = _randomWord;
        // The mock now calls the publicly exposed test function on the testable contract.
        Domin8Testable(_consumer).testFulfillRandomWords(_requestId, randomWords);
    }
}

// =================================================================================================
// Testable Contract Wrapper
// =================================================================================================

/**
 * @title Domin8Testable
 * @notice This contract inherits from Domin8 and exposes a public function to call the
 * internal `fulfillRandomWords` callback, making it testable.
 */
contract Domin8Testable is Domin8 {
    constructor(
        address _authority,
        address payable _treasury,
        uint16 _houseFeeBasisPoints,
        uint256 _minBet,
        uint64 _waitingPhaseDuration,
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash
    ) Domin8(_authority, _treasury, _houseFeeBasisPoints, _minBet, _waitingPhaseDuration, _vrfCoordinator, _subscriptionId, _keyHash) {}

    /**
     * @dev This is a public wrapper function that allows our mock coordinator to call the
     * internal `fulfillRandomWords` function during tests.
     */
    function testFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) public {
        fulfillRandomWords(requestId, randomWords);
    }
}


// =================================================================================================
// Test Suite
// =================================================================================================

contract Domin8Test is Test {
    // --- Test Suite State ---
    Domin8Testable private domin8; // Use the testable version of the contract
    VRFCoordinatorV2_5Mock private mockCoordinator;

    // --- Contract Parameters ---
    address private authority;
    address payable private treasury;
    uint16 private constant HOUSE_FEE = 500; // 5%
    uint256 private constant MIN_BET = 0.01 ether;
    uint64 private constant WAITING_DURATION = 30; // 30 seconds
    bytes32 private keyHash = 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;
    uint256 private constant SUBSCRIPTION_ID = 1;

    // --- Test Accounts ---
    address private player1;
    address private player2;
    address private player3;

    /// @dev This function is executed before each test case. It deploys a fresh set of contracts.
    function setUp() public {
        // 1. Setup accounts
        authority = vm.addr(1);
        treasury = payable(vm.addr(2));
        player1 = vm.addr(3);
        player2 = vm.addr(4);
        player3 = vm.addr(5);

        // Give players some ether
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(player3, 10 ether);

        // 2. Deploy the Mock VRF Coordinator
        mockCoordinator = new VRFCoordinatorV2_5Mock();

        // 3. Deploy the TESTABLE Domin8 contract, linking it to the mock coordinator
        domin8 = new Domin8Testable(
            authority,
            treasury,
            HOUSE_FEE,
            MIN_BET,
            WAITING_DURATION,
            address(mockCoordinator),
            SUBSCRIPTION_ID,
            keyHash
        );
    }

    // =================================================================================================
    // Test Cases
    // =================================================================================================

    /// @dev Tests if the contract is initialized with the correct values.
    function test_01_InitialState() public {
        assertEq(domin8.authority(), authority, "Authority should be the deployer");
        assertEq(domin8.treasury(), treasury, "Treasury address is incorrect");
        assertEq(domin8.minBet(), MIN_BET, "Minimum bet is incorrect");
        assertEq(domin8.currentRoundId(), 0, "Initial round ID should be 0");
        assertEq(domin8.betsLocked(), false, "Bets should be unlocked initially");
    }

    /// @dev Tests the successful creation of a new game by the first player.
    function test_02_CreateGameSuccess() public {
        // #sender: player1
        // #value: 0.02 ether
        vm.prank(player1);
        domin8.createGame{value: 0.02 ether}();

        (uint64 roundId, Domin8.GameStatus status, , , uint256 totalPot, , , ) = domin8.gameRounds(0);

        assertEq(uint(status), uint(Domin8.GameStatus.Waiting), "Game status should be 'Waiting'");
        assertEq(totalPot, 0.02 ether, "Total pot should be the first player's bet");
        assertEq(roundId, 0, "Round ID should be 0");
    }

    /// @dev Tests that `createGame` reverts if the bet amount is too small.
    function test_03_Fail_CreateGameBetTooSmall() public {
        // #sender: player1
        // #value: 0.005 ether
        // #expect revert
        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(Domin8.BetTooSmall.selector));
        domin8.createGame{value: 0.005 ether}();
    }

    /// @dev Tests that a second player can successfully place a bet.
    function test_04_PlaceBetSuccess() public {
        // Player 1 creates the game
        // #sender: player1
        // #value: 0.02 ether
        vm.prank(player1);
        domin8.createGame{value: 0.02 ether}();

        // Player 2 places a bet
        // #sender: player2
        // #value: 0.03 ether
        vm.prank(player2);
        domin8.placeBet{value: 0.03 ether}();

        (, , , , uint256 totalPot, , , ) = domin8.gameRounds(0);
        assertEq(totalPot, 0.05 ether, "Total pot should be the sum of both bets");
    }

    /// @dev Tests a complete game flow from creation to payout.
    function test_05_FullGameFlow() public {
        // --- 1. SETUP PHASE ---
        // Player 1 creates the game with 0.1 ETH
        // #sender: player1
        // #value: 0.1 ether
        vm.prank(player1);
        domin8.createGame{value: 0.1 ether}();

        // Player 2 places a bet of 0.3 ETH
        // #sender: player2
        // #value: 0.3 ether
        vm.prank(player2);
        domin8.placeBet{value: 0.3 ether}();

        // Player 3 places a bet of 0.6 ETH
        // #sender: player3
        // #value: 0.6 ether
        vm.prank(player3);
        domin8.placeBet{value: 0.6 ether}();


        (, Domin8.GameStatus statusBeforeClose, , , uint256 totalPotBeforeClose, , , ) = domin8.gameRounds(0);
        assertEq(totalPotBeforeClose, 1 ether, "Total pot should be 1 ETH before closing");
        assertEq(uint(statusBeforeClose), uint(Domin8.GameStatus.Waiting), "Status should be Waiting");

        // --- 2. CLOSE BETTING ---
        // Authority closes the betting window
        // Note: In a real testnet, we'd wait for `WAITING_DURATION`. Foundry tests can warp time.
        vm.warp(block.timestamp + WAITING_DURATION + 1);
        vm.prank(authority);
        domin8.closeBettingWindow();

        (, Domin8.GameStatus statusAfterClose, , , , , , ) = domin8.gameRounds(0);
        assertEq(uint(statusAfterClose), uint(Domin8.GameStatus.AwaitingWinnerRandomness), "Status should be AwaitingWinnerRandomness");
        assertEq(domin8.betsLocked(), true, "Bets should be locked after closing");

        // --- 3. FULFILL RANDOMNESS (MOCKED) ---
        // The test triggers the mock coordinator to send back a predictable random number.
        // totalPot = 0.1 + 0.3 + 0.6 = 1 ether.
        // Bets: P1 (0.1), P2 (0.3), P3 (0.6)
        // predictableRandomWord % totalPot => winner
        // Let's make Player 2 win. Cumulative weight: P1=0.1, P2=0.4, P3=1.0
        // A random word between 0.1 ether and 0.399... ether will make P2 win.
        uint256 predictableRandomWord = 0.25 ether;
        // #sender: authority
        mockCoordinator.fulfill(1, address(domin8), predictableRandomWord);

        (, , , , , , bool randomnessFulfilled, ) = domin8.gameRounds(0);
        assertEq(randomnessFulfilled, true, "Randomness should be fulfilled");
        // --- 4. SELECT WINNER AND PAYOUT ---
        uint256 player2BalanceBefore = player2.balance;
        uint256 treasuryBalanceBefore = treasury.balance;

        // #sender: authority
        vm.prank(authority);
        domin8.selectWinnerAndPayout();

        // --- 5. ASSERT FINAL STATE ---
        uint256 totalPot = 1 ether;
        uint256 houseFee = (totalPot * HOUSE_FEE) / 10000; // 0.05 ETH
        uint256 winnerPayout = totalPot - houseFee; // 0.95 ETH

        assertEq(player2.balance, player2BalanceBefore + winnerPayout, "Player 2 (winner) did not receive correct payout");
        assertEq(treasury.balance, treasuryBalanceBefore + houseFee, "Treasury did not receive correct house fee");

        (, Domin8.GameStatus statusAfterPayout, , , , Domin8.BetEntry memory winner, , ) = domin8.gameRounds(0);
        assertEq(uint(statusAfterPayout), uint(Domin8.GameStatus.Finished), "Final status should be Finished");
        assertEq(winner.wallet, player2, "Winner should be Player 2");

        assertEq(domin8.currentRoundId(), 1, "Round ID should have incremented to 1");
        assertEq(domin8.betsLocked(), false, "Bets should be unlocked for the next round");
    }
}

