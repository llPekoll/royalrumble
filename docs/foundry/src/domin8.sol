// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// UPDATED IMPORTS for VRF v2.5
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title Domin8
 * @author Gemini
 * @notice A Solidity implementation of the Domin8 betting game, migrated from an Anchor program.
 * This contract manages game rounds, player bets, winner selection, and payouts using Chainlink VRF.
 * It is designed to be controlled by a backend service ("crank") for game progression.
 */
contract Domin8 is VRFConsumerBaseV2Plus {
    // =================================================================================================
    // State Structs
    // =================================================================================================

    /**
     * @notice Represents an individual bet placed by a player.
     */
    struct BetEntry {
        address wallet;
        uint64 betAmount;
        uint64 timestamp;
    }

    /**
     * @notice Configuration for the duration of different game phases.
     */
    struct GameDurationConfig {
        uint64 waitingPhaseDuration;
    }

    /**
     * @notice Represents the state of a single game round.
     */
    struct GameRound {
        uint64 roundId;
        GameStatus status;
        uint64 startTimestamp;
        uint64 endTimestamp; // When the betting window closes
        BetEntry[] bets;
        uint256 totalPot;
        address winner;
        bool randomnessFulfilled;
        bytes32 vrfRequestId;
    }

    /**
     * @notice Enum representing the possible statuses of a game round.
     */
    enum GameStatus {
        Idle,
        Waiting,
        AwaitingWinnerRandomness,
        Finished
    }

    // =================================================================================================
    // State Variables
    // =================================================================================================

    address public authority;
    address payable public treasury;
    uint16 public houseFeeBasisPoints; // e.g., 500 for 5%
    uint256 public minBet;
    GameDurationConfig public gameDurationConfig;
    bool public betsLocked;

    uint64 public currentRoundId;
    mapping(uint64 => GameRound) public gameRounds;

    // --- Chainlink VRF State ---
    // UPDATED: s_subscriptionId is now uint256
    uint256 private immutable s_subscriptionId;
    bytes32 private immutable s_keyHash; // Gas lane
    uint32 private s_callbackGasLimit = 100000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    mapping(uint256 => uint64) public s_vrfRequestIdToRoundId;
    mapping(uint64 => uint256) public s_roundToRandomWord;

    // =================================================================================================
    // Events
    // =================================================================================================

    event GameInitialized(uint64 indexed roundId, uint64 startTimestamp, uint64 endTimestamp);
    event BetPlaced(
        uint64 indexed roundId,
        address indexed player,
        uint256 amount,
        uint256 betCount,
        uint256 totalPot,
        uint64 endTimestamp,
        bool isFirstBet
    );
    event GameLocked(uint64 indexed roundId, uint256 finalBetCount, uint256 totalPot, bytes32 vrfRequestId);
    event WinnerSelected(
        uint64 indexed roundId,
        address indexed winner,
        uint256 totalPot,
        uint256 houseFee,
        uint256 winnerPayout
    );
    event GameReset(uint64 oldRoundId, uint64 newRoundId);
    event RandomnessRequested(uint256 indexed requestId, uint64 indexed roundId);
    event RandomnessFulfilled(uint256 indexed requestId, uint64 indexed roundId);

    // =================================================================================================
    // Errors
    // =================================================================================================

    error Unauthorized();
    error InvalidGameStatus();
    error BettingWindowClosed();
    error BettingWindowStillOpen();
    error BetsLocked();
    error BetTooSmall();
    error NoPlayers();
    error RandomnessNotFulfilled();
    error ArithmeticOverflow();
    error TransferFailed();

    // =================================================================================================
    // Modifiers
    // =================================================================================================

    /**
     * @notice Restricts a function to be callable only by the contract authority.
     */
    modifier onlyAuthority() {
        if (msg.sender != authority) {
            revert Unauthorized();
        }
        _;
    }

    // =================================================================================================
    // Constructor
    // =================================================================================================

    /**
     * @notice Initializes the contract with its core configuration and Chainlink VRF parameters.
     * @param _authority The address authorized to control game progression.
     * @param _treasury The address where house fees will be sent.
     * @param _houseFeeBasisPoints The house's cut of the pot, in basis points.
     * @param _minBet The minimum bet amount in wei.
     * @param _waitingPhaseDuration The duration of the betting window in seconds.
     * @param _vrfCoordinator The address of the Chainlink VRF Coordinator contract.
     * @param _subscriptionId The ID of the Chainlink VRF subscription.
     * @param _keyHash The gas lane key hash for the desired gas price.
     */
    constructor(
        address _authority,
        address payable _treasury,
        uint16 _houseFeeBasisPoints,
        uint256 _minBet,
        uint64 _waitingPhaseDuration,
        address _vrfCoordinator,
        uint256 _subscriptionId, // UPDATED to uint256
        bytes32 _keyHash
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) { // UPDATED to VRFConsumerBaseV2Plus
        authority = _authority;
        treasury = _treasury;
        houseFeeBasisPoints = _houseFeeBasisPoints;
        minBet = _minBet;
        gameDurationConfig = GameDurationConfig({ waitingPhaseDuration: _waitingPhaseDuration });
        s_subscriptionId = _subscriptionId;
        s_keyHash = _keyHash;
        currentRoundId = 0;
        betsLocked = false;
    }

    // =================================================================================================
    // Public and External Functions
    // =================================================================================================

    /**
     * @notice Creates a new game round with the first bet and requests randomness from Chainlink VRF.
     * @dev This function is payable and expects a value equal to the bet amount.
     */
    function createGame() external payable {
        if (betsLocked) revert BetsLocked();
        if (msg.value < minBet) revert BetTooSmall();

        uint64 roundId = currentRoundId;
        GameRound storage newGame = gameRounds[roundId];

        newGame.roundId = roundId;
        newGame.status = GameStatus.Waiting;
        newGame.startTimestamp = uint64(block.timestamp);
        newGame.endTimestamp = newGame.startTimestamp + gameDurationConfig.waitingPhaseDuration;
        newGame.totalPot = msg.value;

        // Add the first bet
        newGame.bets.push(BetEntry({ wallet: msg.sender, betAmount: uint64(msg.value), timestamp: uint64(block.timestamp) }));

        // UPDATED to VRF v2.5 request format
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: s_callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        
        // Note: The vrfRequestId in GameRound is bytes32, but requestRandomWords returns uint256.
        // For v2.5 this is acceptable as the requestId is treated as a number.
        // We store it as bytes32 for consistency with previous interfaces if needed, but this requires casting.
        // For simplicity and direct compatibility, we will assume requestId can be handled as uint256 throughout.
        s_vrfRequestIdToRoundId[requestId] = roundId;

        emit RandomnessRequested(requestId, roundId);

        emit BetPlaced(
            roundId,
            msg.sender,
            msg.value,
            1,
            newGame.totalPot,
            newGame.endTimestamp,
            true
        );
    }

    /**
     * @notice Places a bet in the current, active game round.
     * @dev This function is payable and expects a value equal to the bet amount.
     */
    function placeBet() external payable {
        if (betsLocked) revert BetsLocked();
        if (msg.value < minBet) revert BetTooSmall();

        GameRound storage game = gameRounds[currentRoundId];

        if (game.status != GameStatus.Waiting) revert InvalidGameStatus();
        if (block.timestamp >= game.endTimestamp) revert BettingWindowClosed();

        game.totalPot += msg.value;
        game.bets.push(BetEntry({ wallet: msg.sender, betAmount: uint64(msg.value), timestamp: uint64(block.timestamp) }));

        emit BetPlaced(
            currentRoundId,
            msg.sender,
            msg.value,
            game.bets.length,
            game.totalPot,
            game.endTimestamp,
            false
        );
    }

    /**
     * @notice Closes the betting window for the current round. Called by the crank.
     */
    function closeBettingWindow() external onlyAuthority {
        GameRound storage game = gameRounds[currentRoundId];
        if (game.status != GameStatus.Waiting) revert InvalidGameStatus();
        if (block.timestamp < game.endTimestamp) revert BettingWindowStillOpen();
        if (game.bets.length < 2) revert NoPlayers();

        betsLocked = true;
        game.status = GameStatus.AwaitingWinnerRandomness;

        emit GameLocked(currentRoundId, game.bets.length, game.totalPot, game.vrfRequestId);
    }

    /**
     * @notice Selects a winner using fulfilled VRF randomness and distributes the payout. Called by the crank.
     */
    function selectWinnerAndPayout() external onlyAuthority {
        uint64 roundId = currentRoundId;
        GameRound storage game = gameRounds[roundId];

        if (game.status != GameStatus.AwaitingWinnerRandomness) revert InvalidGameStatus();
        if (!game.randomnessFulfilled) revert RandomnessNotFulfilled();
        if (game.bets.length == 0) revert NoPlayers();

        uint256 randomness = s_roundToRandomWord[roundId];

        // 1. Select Winner
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < game.bets.length; i++) {
            totalWeight += game.bets[i].betAmount;
        }

        uint256 selection = randomness % totalWeight;
        uint256 cumulative = 0;
        address winnerAddress;

        for (uint256 i = 0; i < game.bets.length; i++) {
            cumulative += game.bets[i].betAmount;
            if (selection < cumulative) {
                winnerAddress = game.bets[i].wallet;
                break;
            }
        }
        // Fallback in case of rounding issues
        if (winnerAddress == address(0)) {
            winnerAddress = game.bets[game.bets.length - 1].wallet;
        }
        game.winner = winnerAddress;

        // 2. Calculate Payouts
        uint256 houseFee = (game.totalPot * houseFeeBasisPoints) / 10000;
        uint256 winnerPayout = game.totalPot - houseFee;

        // 3. Distribute Funds
        (bool successTreasury, ) = treasury.call{value: houseFee}("");
        if (!successTreasury) revert TransferFailed();

        (bool successWinner, ) = payable(winnerAddress).call{value: winnerPayout}("");
        if (!successWinner) revert TransferFailed();

        game.status = GameStatus.Finished;
        emit WinnerSelected(roundId, winnerAddress, game.totalPot, houseFee, winnerPayout);

        // 4. Reset for next game
        currentRoundId++;
        betsLocked = false;
        emit GameReset(roundId, currentRoundId);
    }

    // =================================================================================================
    // Internal and Callback Functions
    // =================================================================================================

    /**
     * @notice Callback function for Chainlink VRF to deliver randomness.
     * @dev This function is called by the VRF Coordinator, not by users.
     * @param _requestId The ID of the VRF request.
     * @param _randomWords An array of random words delivered by the oracle.
     */
    function fulfillRandomWords(uint256 _requestId, uint256[] calldata _randomWords) internal override { // UPDATED to calldata
        uint64 roundId = s_vrfRequestIdToRoundId[_requestId];
        GameRound storage game = gameRounds[roundId];
        
        // Store the random word and mark the randomness as fulfilled
        s_roundToRandomWord[roundId] = _randomWords[0];
        game.randomnessFulfilled = true;
        
        emit RandomnessFulfilled(_requestId, roundId);
    }
}

