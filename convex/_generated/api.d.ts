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
import type * as characters from "../characters.js";
import type * as crons from "../crons.js";
import type * as gameManager from "../gameManager.js";
import type * as gameManagerDb from "../gameManagerDb.js";
import type * as gameParticipants_stub from "../gameParticipants_stub.js";
import type * as leaderboard_stub from "../leaderboard_stub.js";
import type * as lib_solana from "../lib/solana.js";
import type * as lib_types from "../lib/types.js";
import type * as maps from "../maps.js";
import type * as players from "../players.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  characters: typeof characters;
  crons: typeof crons;
  gameManager: typeof gameManager;
  gameManagerDb: typeof gameManagerDb;
  gameParticipants_stub: typeof gameParticipants_stub;
  leaderboard_stub: typeof leaderboard_stub;
  "lib/solana": typeof lib_solana;
  "lib/types": typeof lib_types;
  maps: typeof maps;
  players: typeof players;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
