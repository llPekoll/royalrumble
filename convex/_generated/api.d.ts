/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as crons from "../crons.js";
import type * as games_cleanup from "../games/cleanup.js";
import type * as games_constants from "../games/constants.js";
import type * as games_gameHelpers from "../games/gameHelpers.js";
import type * as games_gameLoop from "../games/gameLoop.js";
import type * as games_mutations from "../games/mutations.js";
import type * as games_payouts from "../games/payouts.js";
import type * as games_queries from "../games/queries.js";
import type * as games from "../games.js";
import type * as leaderboard from "../leaderboard.js";
import type * as players from "../players.js";
import type * as solana_operations from "../solana/operations.js";
import type * as solana_processor from "../solana/processor.js";
import type * as solana_verification from "../solana/verification.js";
import type * as solana_wallet from "../solana/wallet.js";
import type * as solana_withdrawals from "../solana/withdrawals.js";
import type * as solana from "../solana.js";
import type * as transactions from "../transactions.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "games/cleanup": typeof games_cleanup;
  "games/constants": typeof games_constants;
  "games/gameHelpers": typeof games_gameHelpers;
  "games/gameLoop": typeof games_gameLoop;
  "games/mutations": typeof games_mutations;
  "games/payouts": typeof games_payouts;
  "games/queries": typeof games_queries;
  games: typeof games;
  leaderboard: typeof leaderboard;
  players: typeof players;
  "solana/operations": typeof solana_operations;
  "solana/processor": typeof solana_processor;
  "solana/verification": typeof solana_verification;
  "solana/wallet": typeof solana_wallet;
  "solana/withdrawals": typeof solana_withdrawals;
  solana: typeof solana;
  transactions: typeof transactions;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
