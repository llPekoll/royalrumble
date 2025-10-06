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
import type * as crons from "../crons.js";
import type * as gameParticipants from "../gameParticipants.js";
import type * as games from "../games.js";
import type * as leaderboard from "../leaderboard.js";
import type * as maps from "../maps.js";
import type * as mockSmartContract from "../mockSmartContract.js";
import type * as players from "../players.js";
import type * as privy from "../privy.js";
import type * as solana from "../solana.js";
import type * as transactions from "../transactions.js";
import type * as vrf from "../vrf.js";

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
  crons: typeof crons;
  gameParticipants: typeof gameParticipants;
  games: typeof games;
  leaderboard: typeof leaderboard;
  maps: typeof maps;
  mockSmartContract: typeof mockSmartContract;
  players: typeof players;
  privy: typeof privy;
  solana: typeof solana;
  transactions: typeof transactions;
  vrf: typeof vrf;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
