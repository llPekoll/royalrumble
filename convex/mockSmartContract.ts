import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Mock Smart Contract for Domin8 Game
 *
 * This file simulates all 11 smart contract instructions without actually
 * deploying to Solana. Use this for development and testing.
 *
 * Instructions mocked:
 * 1. initialize_game_first_time
 * 2. initialize_game
 * 3. place_entry_bet
 * 4. place_spectator_bet
 * 5. set_top_four
 * 6. set_winner
 * 7. claim_entry_winnings
 * 8. claim_spectator_winnings
 * 9. collect_house_fees
 * 10. cancel_and_refund
 * 11. emergency_withdraw
 */

// Constants
const MIN_BET = 0.01; // 0.01 SOL in SOL (not lamports for mock)
const TIME_LOCK_SECONDS = 5;
const EMERGENCY_TIMEOUT_HOURS = 24;

// Game status enum
type GameStatus = "EntryPhase" | "SelectingTopFour" | "SpectatorPhase" | "SelectingWinner" | "Settled" | "Cancelled";
type GameMode = "Unknown" | "Short" | "Long";

// Mock Game State (simulates on-chain Game PDA)
interface MockGameState {
  gameId: number;
  status: GameStatus;
  gameMode: GameMode;

  // Pools
  entryPool: number;
  spectatorPool: number;

  // Entry phase bets (max 64)
  entryBets: number[];
  entryPlayers: string[];
  entryBetCount: number;

  // Spectator phase bets (max 64)
  spectatorBets: number[];
  spectatorPlayers: string[];
  spectatorTargets: number[];
  spectatorBetCount: number;

  // Winners
  topFour: number[];
  winner: number;

  // Timing
  entryPhaseStart: number;
  entryPhaseDuration: number;
  spectatorPhaseStart: number;
  spectatorPhaseDuration: number;

  // Flags
  houseCollected: boolean;
  entryWinningsClaimed: boolean;

  // Refund tracking
  entryRefunded: boolean[];
  spectatorRefunded: boolean[];

  // Other
  lastGameEnd: number;
  vrfSeedTopFour: string | null;
  vrfSeedWinner: string | null;
  houseWallet: string;
}

// In-memory mock game state (simulates blockchain PDA)
let mockGameState: MockGameState | null = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function initializeEmptyGameState(houseWallet: string): MockGameState {
  return {
    gameId: 0,
    status: "EntryPhase",
    gameMode: "Unknown",
    entryPool: 0,
    spectatorPool: 0,
    entryBets: [],
    entryPlayers: [],
    entryBetCount: 0,
    spectatorBets: [],
    spectatorPlayers: [],
    spectatorTargets: [],
    spectatorBetCount: 0,
    topFour: [-1, -1, -1, -1],
    winner: -1,
    entryPhaseStart: 0,
    entryPhaseDuration: 0,
    spectatorPhaseStart: 0,
    spectatorPhaseDuration: 0,
    houseCollected: false,
    entryWinningsClaimed: false,
    entryRefunded: [],
    spectatorRefunded: [],
    lastGameEnd: 0,
    vrfSeedTopFour: null,
    vrfSeedWinner: null,
    houseWallet,
  };
}

// ============================================================================
// 1. INITIALIZE GAME FIRST TIME (one-time setup)
// ============================================================================

export const mockInitializeGameFirstTime = mutation({
  args: {
    houseWallet: v.string(),
  },
  handler: async (_ctx, _args) => {
    if (mockGameState !== null) {
      throw new Error("Game already initialized");
    }

    mockGameState = initializeEmptyGameState(_args.houseWallet);

    return {
      success: true,
      message: "Mock game PDA initialized (first time)",
      gameId: mockGameState.gameId,
    };
  },
});

// ============================================================================
// 2. INITIALIZE GAME (reset for new round)
// ============================================================================

export const mockInitializeGame = mutation({
  args: {},
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized. Call mockInitializeGameFirstTime first");
    }

    const now = Date.now();
    const timeLockEnd = mockGameState.lastGameEnd + (TIME_LOCK_SECONDS * 1000);

    if (now < timeLockEnd) {
      throw new Error(`Time lock not met. Wait ${Math.ceil((timeLockEnd - now) / 1000)}s`);
    }

    // Increment game ID
    const newGameId = mockGameState.gameId + 1;
    const houseWallet = mockGameState.houseWallet;

    // Reset entire state
    mockGameState = initializeEmptyGameState(houseWallet);
    mockGameState.gameId = newGameId;
    mockGameState.entryPhaseStart = now;

    return {
      success: true,
      message: `Game ${newGameId} initialized`,
      gameId: newGameId,
    };
  },
});

// ============================================================================
// 3. PLACE ENTRY BET
// ============================================================================

export const mockPlaceEntryBet = mutation({
  args: {
    playerWallet: v.string(),
    amount: v.number(), // SOL amount
  },
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    if (mockGameState.status !== "EntryPhase") {
      throw new Error("Not in entry phase");
    }

    if (_args.amount < MIN_BET) {
      throw new Error(`Bet too small. Minimum ${MIN_BET} SOL`);
    }

    if (mockGameState.entryBetCount >= 64) {
      throw new Error("Entry bets full (max 64)");
    }

    // Record the bet
    mockGameState.entryBets.push(_args.amount);
    mockGameState.entryPlayers.push(_args.playerWallet);
    mockGameState.entryRefunded.push(false);
    mockGameState.entryPool += _args.amount;
    mockGameState.entryBetCount++;

    return {
      success: true,
      message: `Entry bet placed: ${_args.amount} SOL`,
      betIndex: mockGameState.entryBetCount - 1,
      totalPool: mockGameState.entryPool,
    };
  },
});

// ============================================================================
// 4. PLACE SPECTATOR BET
// ============================================================================

export const mockPlaceSpectatorBet = mutation({
  args: {
    playerWallet: v.string(),
    amount: v.number(),
    targetIndex: v.number(), // Which top_four they're betting on (0-3)
  },
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    if (mockGameState.status !== "SpectatorPhase") {
      throw new Error("Not in spectator phase");
    }

    if (_args.targetIndex < 0 || _args.targetIndex > 3) {
      throw new Error("Invalid target index (must be 0-3)");
    }

    if (mockGameState.spectatorBetCount >= 64) {
      throw new Error("Spectator bets full (max 64)");
    }

    // Check player is not in top 4
    const playerEntryIndex = mockGameState.entryPlayers.indexOf(_args.playerWallet);
    if (playerEntryIndex !== -1 && mockGameState.topFour.includes(playerEntryIndex)) {
      throw new Error("Cannot bet on yourself (you're in top 4)");
    }

    // Record the bet
    mockGameState.spectatorBets.push(_args.amount);
    mockGameState.spectatorPlayers.push(_args.playerWallet);
    mockGameState.spectatorTargets.push(_args.targetIndex);
    mockGameState.spectatorRefunded.push(false);
    mockGameState.spectatorPool += _args.amount;
    mockGameState.spectatorBetCount++;

    return {
      success: true,
      message: `Spectator bet placed: ${_args.amount} SOL on position ${_args.targetIndex}`,
      betIndex: mockGameState.spectatorBetCount - 1,
      totalPool: mockGameState.spectatorPool,
    };
  },
});

// ============================================================================
// 5. SET TOP FOUR
// ============================================================================

export const mockSetTopFour = mutation({
  args: {
    topFourPositions: v.array(v.number()), // [index1, index2, index3, index4]
  },
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    if (mockGameState.status !== "EntryPhase" && mockGameState.status !== "SelectingTopFour") {
      throw new Error("Cannot set top four in current phase");
    }

    if (_args.topFourPositions.length !== 4) {
      throw new Error("Must provide exactly 4 positions");
    }

    // Validate all positions
    for (const pos of _args.topFourPositions) {
      if (pos < 0 || pos >= mockGameState.entryBetCount) {
        throw new Error(`Invalid position ${pos}`);
      }
    }

    // Set top four
    mockGameState.topFour = _args.topFourPositions;
    mockGameState.status = "SpectatorPhase";
    mockGameState.spectatorPhaseStart = Date.now();
    mockGameState.gameMode = "Long";

    return {
      success: true,
      message: "Top four set",
      topFour: _args.topFourPositions,
    };
  },
});

// ============================================================================
// 6. SET WINNER
// ============================================================================

export const mockSetWinner = mutation({
  args: {
    winnerPosition: v.number(),
  },
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    if (mockGameState.status !== "SelectingWinner") {
      throw new Error("Not in selecting winner phase");
    }

    if (_args.winnerPosition < 0 || _args.winnerPosition >= mockGameState.entryBetCount) {
      throw new Error("Invalid winner position");
    }

    // For long games, winner must be in top four
    if (mockGameState.gameMode === "Long") {
      if (!mockGameState.topFour.includes(_args.winnerPosition)) {
        throw new Error("Winner must be in top four for long games");
      }
    }

    // Set winner
    mockGameState.winner = _args.winnerPosition;
    mockGameState.status = "Settled";
    mockGameState.lastGameEnd = Date.now();

    const winnerWallet = mockGameState.entryPlayers[_args.winnerPosition];

    return {
      success: true,
      message: `Winner set: position ${_args.winnerPosition}`,
      winnerWallet,
      winnerBet: mockGameState.entryBets[_args.winnerPosition],
    };
  },
});

// ============================================================================
// 7. CLAIM ENTRY WINNINGS
// ============================================================================

export const mockClaimEntryWinnings = mutation({
  args: {
    playerWallet: v.string(),
  },
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    if (mockGameState.status !== "Settled") {
      throw new Error("Game not settled yet");
    }

    if (mockGameState.entryWinningsClaimed) {
      throw new Error("Entry winnings already claimed");
    }

    const winnerWallet = mockGameState.entryPlayers[mockGameState.winner];
    if (_args.playerWallet !== winnerWallet) {
      throw new Error("Only the winner can claim entry winnings");
    }

    // Calculate winnings (95% of entry pool)
    const winnings = mockGameState.entryPool * 0.95;

    mockGameState.entryWinningsClaimed = true;

    return {
      success: true,
      message: `Entry winnings claimed: ${winnings} SOL`,
      amount: winnings,
    };
  },
});

// ============================================================================
// 8. CLAIM SPECTATOR WINNINGS
// ============================================================================

export const mockClaimSpectatorWinnings = mutation({
  args: {
    playerWallet: v.string(),
  },
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    if (mockGameState.status !== "Settled") {
      throw new Error("Game not settled yet");
    }

    if (mockGameState.gameMode !== "Long") {
      throw new Error("No spectator pool in short games");
    }

    // Find which top_four won
    const winnerTopFourIndex = mockGameState.topFour.indexOf(mockGameState.winner);
    if (winnerTopFourIndex === -1) {
      throw new Error("Winner not in top four");
    }

    // Calculate total bets on the winner
    let totalWinningBets = 0;
    let playerBets = 0;
    const playerBetIndices: number[] = [];

    for (let i = 0; i < mockGameState.spectatorBetCount; i++) {
      if (mockGameState.spectatorTargets[i] === winnerTopFourIndex) {
        totalWinningBets += mockGameState.spectatorBets[i];

        if (mockGameState.spectatorPlayers[i] === _args.playerWallet && !mockGameState.spectatorRefunded[i]) {
          playerBets += mockGameState.spectatorBets[i];
          playerBetIndices.push(i);
        }
      }
    }

    if (playerBets === 0) {
      throw new Error("No winning spectator bets found for this player");
    }

    // Calculate proportional share
    const spectatorPoolPayout = mockGameState.spectatorPool * 0.95;
    const playerShare = (playerBets / totalWinningBets) * spectatorPoolPayout;

    // Mark as refunded (to prevent double claims)
    for (const index of playerBetIndices) {
      mockGameState.spectatorRefunded[index] = true;
    }

    return {
      success: true,
      message: `Spectator winnings claimed: ${playerShare} SOL`,
      amount: playerShare,
      playerBets,
      totalWinningBets,
    };
  },
});

// ============================================================================
// 9. COLLECT HOUSE FEES
// ============================================================================

export const mockCollectHouseFees = mutation({
  args: {},
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    if (mockGameState.status !== "Settled") {
      throw new Error("Game not settled yet");
    }

    if (mockGameState.houseCollected) {
      throw new Error("House fees already collected");
    }

    // Calculate 5% of both pools
    const totalPool = mockGameState.entryPool + mockGameState.spectatorPool;
    const houseFees = totalPool * 0.05;

    mockGameState.houseCollected = true;

    return {
      success: true,
      message: `House fees collected: ${houseFees} SOL`,
      amount: houseFees,
      houseWallet: mockGameState.houseWallet,
    };
  },
});

// ============================================================================
// 10. CANCEL AND REFUND
// ============================================================================

export const mockCancelAndRefund = mutation({
  args: {
    playerWallet: v.string(),
  },
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    if (mockGameState.status !== "Cancelled") {
      throw new Error("Game not cancelled");
    }

    let totalRefund = 0;

    // Refund entry bets
    for (let i = 0; i < mockGameState.entryBetCount; i++) {
      if (mockGameState.entryPlayers[i] === _args.playerWallet && !mockGameState.entryRefunded[i]) {
        totalRefund += mockGameState.entryBets[i];
        mockGameState.entryRefunded[i] = true;
      }
    }

    // Refund spectator bets
    for (let i = 0; i < mockGameState.spectatorBetCount; i++) {
      if (mockGameState.spectatorPlayers[i] === args.playerWallet && !mockGameState.spectatorRefunded[i]) {
        totalRefund += mockGameState.spectatorBets[i];
        mockGameState.spectatorRefunded[i] = true;
      }
    }

    if (totalRefund === 0) {
      throw new Error("No bets to refund for this player");
    }

    return {
      success: true,
      message: `Refund processed: ${totalRefund} SOL`,
      amount: totalRefund,
    };
  },
});

// ============================================================================
// 11. EMERGENCY WITHDRAW
// ============================================================================

export const mockEmergencyWithdraw = mutation({
  args: {},
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }

    const now = Date.now();
    const gameAge = now - mockGameState.entryPhaseStart;
    const emergencyTimeoutMs = EMERGENCY_TIMEOUT_HOURS * 60 * 60 * 1000;

    if (gameAge < emergencyTimeoutMs) {
      throw new Error(`Emergency timeout not met. Game must be stuck for ${EMERGENCY_TIMEOUT_HOURS} hours`);
    }

    const totalFunds = mockGameState.entryPool + mockGameState.spectatorPool;

    // Reset game state
    const houseWallet = mockGameState.houseWallet;
    mockGameState = initializeEmptyGameState(houseWallet);

    return {
      success: true,
      message: `Emergency withdrawal: ${totalFunds} SOL`,
      amount: totalFunds,
    };
  },
});

// ============================================================================
// UTILITY QUERIES
// ============================================================================

export const getMockGameState = query({
  args: {},
  handler: async (ctx) => {
    if (!mockGameState) {
      return null;
    }
    return mockGameState;
  },
});

export const mockSetGameStatus = mutation({
  args: {
    status: v.union(
      v.literal("EntryPhase"),
      v.literal("SelectingTopFour"),
      v.literal("SpectatorPhase"),
      v.literal("SelectingWinner"),
      v.literal("Settled"),
      v.literal("Cancelled")
    ),
  },
  handler: async (_ctx, _args) => {
    if (!mockGameState) {
      throw new Error("Game not initialized");
    }
    mockGameState.status = _args.status;
    return { success: true, newStatus: _args.status };
  },
});

export const mockResetGame = mutation({
  args: {},
  handler: async (ctx) => {
    mockGameState = null;
    return { success: true, message: "Mock game state reset" };
  },
});
