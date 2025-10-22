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
import type * as eventListener from "../eventListener.js";
import type * as gameActions from "../gameActions.js";
import type * as gameManager from "../gameManager.js";
import type * as gameManagerDb from "../gameManagerDb.js";
import type * as gameRecovery from "../gameRecovery.js";
import type * as lib_gamePhases from "../lib/gamePhases.js";
import type * as lib_solana from "../lib/solana.js";
import type * as lib_types from "../lib/types.js";
import type * as maps from "../maps.js";
import type * as players from "../players.js";
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
  crons: typeof crons;
  eventListener: typeof eventListener;
  gameActions: typeof gameActions;
  gameManager: typeof gameManager;
  gameManagerDb: typeof gameManagerDb;
  gameRecovery: typeof gameRecovery;
  "lib/gamePhases": typeof lib_gamePhases;
  "lib/solana": typeof lib_solana;
  "lib/types": typeof lib_types;
  maps: typeof maps;
  players: typeof players;
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
