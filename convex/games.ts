// Re-export all game-related functions from split modules

// Export constants
export { PHASE_DURATIONS, BOT_NAMES } from "./games/constants";

// Export queries
export { 
  getCurrentGame, 
  getGame, 
  getRecentGames, 
  getPlayerGames 
} from "./games/queries";

// Export player-facing mutations
export { 
  joinGame, 
  placeSpectatorBet 
} from "./games/mutations";

// Export internal mutations and game loop
export { 
  createNewGame, 
  advanceGamePhase, 
  cleanupOldGames, 
  gameLoop 
} from "./games/gameLoop";

// Export helper functions for use in other modules
export { 
  addBots, 
  eliminateToFinalists, 
  determineWinner 
} from "./games/gameHelpers";

// Export payout function for use in other modules
export { processPayouts } from "./games/payouts";
