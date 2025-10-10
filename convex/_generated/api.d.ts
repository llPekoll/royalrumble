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
import type * as bets from "../bets.js";
import type * as characters from "../characters.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as gameManager from "../gameManager.js";
import type * as gameParticipants from "../gameParticipants.js";
import type * as games from "../games.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_solana from "../lib/solana.js";
import type * as lib_types from "../lib/types.js";
import type * as maps from "../maps.js";
import type * as mockSmartContract from "../mockSmartContract.js";
import type * as monitoring from "../monitoring.js";
import type * as players from "../players.js";
import type * as privy from "../privy.js";
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
  bets: typeof bets;
  characters: typeof characters;
  cleanup: typeof cleanup;
  crons: typeof crons;
  gameManager: typeof gameManager;
  gameParticipants: typeof gameParticipants;
  games: typeof games;
  leaderboard: typeof leaderboard;
  "lib/solana": typeof lib_solana;
  "lib/types": typeof lib_types;
  maps: typeof maps;
  mockSmartContract: typeof mockSmartContract;
  monitoring: typeof monitoring;
  players: typeof players;
  privy: typeof privy;
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
