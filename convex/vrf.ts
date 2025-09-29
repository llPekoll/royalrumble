import { query, action } from "./_generated/server";
import { v } from "convex/values";
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  TransactionInstruction,
  SystemProgram
} from "@solana/web3.js";

// Polyfill Buffer for Convex environment
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = {
    from: (data: any) => {
      if (data instanceof Uint8Array) {
        return data;
      }
      if (Array.isArray(data)) {
        return new Uint8Array(data);
      }
      if (typeof data === 'string') {
        return new TextEncoder().encode(data);
      }
      return new Uint8Array(data);
    }
  } as any;
}

// VRF Program Configuration
const VRF_PROGRAM_ID = new PublicKey("96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF");
const VRF_STATE_PDA = new PublicKey("8BqRVTALxkW5HxiV7DLSJuTqbB4FvfHhPcNU5mEDaRD3");

// VRF Program IDL (Interface Definition)
const VRF_IDL = {
  "version": "0.1.0",
  "name": "domin8_vrf",
  "address": "96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "vrfState", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "requestVrf",
      "accounts": [
        { "name": "vrfState", "isMut": true, "isSigner": false },
        { "name": "gameSeed", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "recentBlockhashes", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "gameId", "type": "string" },
        { "name": "round", "type": "u8" }
      ]
    },
    {
      "name": "markSeedUsed",
      "accounts": [
        { "name": "gameSeed", "isMut": true, "isSigner": false },
        { "name": "vrfState", "isMut": false, "isSigner": false },
        { "name": "authority", "isMut": false, "isSigner": true }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "VrfState",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "nonce", "type": "u64" }
        ]
      }
    },
    {
      "name": "GameSeed",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "gameId", "type": "string" },
          { "name": "round", "type": "u8" },
          { "name": "randomSeed", "type": { "array": ["u8", 32] } },
          { "name": "timestamp", "type": "i64" },
          { "name": "used", "type": "bool" }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "VrfState",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "nonce", "type": "u64" }
        ]
      }
    },
    {
      "name": "GameSeed",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "gameId", "type": "string" },
          { "name": "round", "type": "u8" },
          { "name": "randomSeed", "type": { "array": ["u8", 32] } },
          { "name": "timestamp", "type": "i64" },
          { "name": "used", "type": "bool" }
        ]
      }
    }
  ]
};

// Helper function to get Helius connection
function getConnection(): Connection {
  const heliusApiKey = process.env.HELIUS_API_KEY;
  if (!heliusApiKey) {
    throw new Error("HELIUS_API_KEY environment variable not set");
  }

  const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  return new Connection(rpcUrl, 'confirmed');
}

// Helper function to get authority keypair
function getAuthorityKeypair(): Keypair {
  const vrfAuthorityKey = process.env.VRF_AUTHORITY_KEYPAIR;
  if (!vrfAuthorityKey) {
    throw new Error("VRF_AUTHORITY_KEYPAIR environment variable not set");
  }

  try {
    // Assuming the keypair is stored as base58 string or JSON array
    let keyData: number[];

    // We only support JSON array format in Convex
    if (vrfAuthorityKey.startsWith('[')) {
      // JSON array format: [1,2,3,...]
      keyData = JSON.parse(vrfAuthorityKey);
    } else {
      throw new Error("VRF authority keypair must be in JSON array format [1,2,3,...]");
    }

    return Keypair.fromSecretKey(Uint8Array.from(keyData));
  } catch (error) {
    throw new Error(`Failed to parse VRF authority keypair: ${error}`);
  }
}

// Helper function to concatenate Uint8Arrays (replaces Buffer.concat)
function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return new Uint8Array(bytes);
}

// Helper function to create little-endian 32-bit integer
function createLittleEndianU32(value: number): Uint8Array {
  const arr = new Uint8Array(4);
  arr[0] = value & 0xff;
  arr[1] = (value >> 8) & 0xff;
  arr[2] = (value >> 16) & 0xff;
  arr[3] = (value >> 24) & 0xff;
  return arr;
}

// Calculate Game Seed PDA
function getGameSeedPDA(gameId: string, round: number): PublicKey {
  const encoder = new TextEncoder();
  const [pda] = PublicKey.findProgramAddressSync(
    [
      encoder.encode("game_seed"),
      encoder.encode(gameId),
      new Uint8Array([round])
    ],
    VRF_PROGRAM_ID
  );
  return pda;
}

// Request VRF for a game
export const requestVRF = action({
  args: {
    gameId: v.string(),
    round: v.number(), // 1 or 2
  },
  handler: async (ctx, args) => {
    try {
      console.log(`🎲 Requesting VRF for game: ${args.gameId}, round: ${args.round}`);

      const connection = getConnection();
      const authority = getAuthorityKeypair();

      // Calculate PDAs
      const gameSeedPDA = getGameSeedPDA(args.gameId, args.round);

      console.log(`📍 Game Seed PDA: ${gameSeedPDA.toString()}`);

      // Check if this game seed already exists
      try {
        const existingAccount = await connection.getAccountInfo(gameSeedPDA);
        if (existingAccount) {
          console.log(`⚠️ Game seed already exists for ${args.gameId} round ${args.round}`);
          return {
            success: false,
            error: "Game seed already exists for this game and round",
            pda: gameSeedPDA.toString()
          };
        }
      } catch (error) {
        // Account doesn't exist, which is what we want
      }

      // Create a NodeWallet-like interface for the backend
      // We'll bypass Anchor's wallet interface since we're in a backend environment
      const dummyWallet = {
        publicKey: authority.publicKey,
        signTransaction: async <T extends Transaction>(tx: T): Promise<T> => {
          tx.sign(authority);
          return tx;
        },
        signAllTransactions: async <T extends Transaction>(txs: T[]): Promise<T[]> => {
          txs.forEach(tx => tx.sign(authority));
          return txs;
        }
      };

      // Create instruction data manually
      const encoder = new TextEncoder();

      // Correct discriminator for 'request_vrf' instruction from IDL
      const discriminator = new Uint8Array([5, 87, 79, 152, 164, 176, 190, 226]);

      // Encode the instruction data with correct Borsh serialization
      // For strings in Borsh: 4-byte length (little-endian) followed by UTF-8 bytes
      const gameIdBytes = encoder.encode(args.gameId);
      const instructionData = concatUint8Arrays(
        discriminator,
        createLittleEndianU32(gameIdBytes.length),
        gameIdBytes,
        new Uint8Array([args.round])
      );

      // Create the instruction manually

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: VRF_STATE_PDA, isSigner: false, isWritable: true },
          { pubkey: gameSeedPDA, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey("SysvarRecentB1ockHashes11111111111111111111"), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: VRF_PROGRAM_ID,
        data: Buffer.from(instructionData)
      });

      // Create and send transaction
      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authority.publicKey;
      transaction.sign(authority);

      const signature = await connection.sendRawTransaction(transaction.serialize());
      console.log(`📝 Transaction sent: ${signature}`);

      // Wait for confirmation using polling (no WebSocket)
      console.log('⏳ Waiting for transaction confirmation...');
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (attempts < maxAttempts) {
        try {
          const status = await connection.getSignatureStatus(signature);
          if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
            if (status.value.err) {
              console.error("❌ VRF transaction failed:", status.value.err);
              return {
                success: false,
                error: "Transaction failed on blockchain",
                signature,
                details: status.value.err
              };
            }
            break;
          }
        } catch (error) {
          console.log(`Attempt ${attempts + 1}: Still waiting...`);
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }

      if (attempts >= maxAttempts) {
        return {
          success: false,
          error: "Transaction confirmation timeout",
          signature
        };
      }


      console.log(`✅ VRF request confirmed: ${signature}`);

      return {
        success: true,
        signature,
        gameSeedPDA: gameSeedPDA.toString(),
        message: `VRF requested for game ${args.gameId} round ${args.round}`
      };

    } catch (error) {
      console.error("❌ Error requesting VRF:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  },
});

// Fetch VRF result for a game
export const getVRFResult = query({
  args: {
    gameId: v.string(),
    round: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const connection = getConnection();
      const gameSeedPDA = getGameSeedPDA(args.gameId, args.round);

      console.log(`🔍 Querying VRF result for game ${args.gameId} round ${args.round}`);
      console.log(`📍 Game Seed PDA: ${gameSeedPDA.toString()}`);

      const accountInfo = await connection.getAccountInfo(gameSeedPDA);

      if (!accountInfo) {
        return {
          exists: false,
          message: `No VRF result found for game ${args.gameId} round ${args.round}`
        };
      }

      // Parse the account data (simplified - in production you'd use anchor to parse)
      const data = accountInfo.data;

      // Skip 8-byte discriminator
      let offset = 8;

      // Read game_id (4 bytes length + string)
      const gameIdLength = data.readUInt32LE(offset);
      offset += 4;
      const gameId = data.subarray(offset, offset + gameIdLength).toString('utf8');
      offset += gameIdLength;

      // Read round (1 byte)
      const round = data[offset];
      offset += 1;

      // Read random_seed (32 bytes)
      const randomSeed = Array.from(data.subarray(offset, offset + 32));
      offset += 32;

      // Read timestamp (8 bytes)
      const timestamp = data.readBigInt64LE(offset);
      offset += 8;

      // Read used (1 byte)
      const used = data[offset] === 1;

      return {
        exists: true,
        gameId,
        round,
        randomSeed,
        timestamp: Number(timestamp),
        used,
        pda: gameSeedPDA.toString()
      };

    } catch (error) {
      console.error("Error fetching VRF result:", error);
      return {
        exists: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  },
});

// Helper function to convert random seed to winner index
export const selectWinnerFromSeed = query({
  args: {
    randomSeed: v.array(v.number()),
    participantWeights: v.array(v.number()), // Bet amounts as weights
  },
  handler: async (ctx, args) => {
    try {
      // Convert seed bytes to a big number
      let seedValue = 0n;
      for (let i = 0; i < Math.min(8, args.randomSeed.length); i++) {
        seedValue = seedValue * 256n + BigInt(args.randomSeed[i]);
      }

      // Calculate total weight
      const totalWeight = args.participantWeights.reduce((sum, weight) => sum + weight, 0);

      if (totalWeight === 0) {
        return {
          success: false,
          error: "No participants with non-zero weights"
        };
      }

      // Use seed to select winner based on weights
      const randomValue = Number(seedValue % BigInt(totalWeight));

      let currentWeight = 0;
      for (let i = 0; i < args.participantWeights.length; i++) {
        currentWeight += args.participantWeights[i];
        if (randomValue < currentWeight) {
          return {
            success: true,
            winnerIndex: i,
            randomValue,
            totalWeight,
            seedValue: seedValue.toString()
          };
        }
      }

      // Fallback (should never reach here)
      return {
        success: true,
        winnerIndex: args.participantWeights.length - 1,
        randomValue,
        totalWeight,
        seedValue: seedValue.toString()
      };

    } catch (error) {
      console.error("Error selecting winner from seed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  },
});

// Check VRF system status
export const getVRFStatus = query({
  args: {},
  handler: async (ctx) => {
    try {
      const connection = getConnection();

      // Check VRF state account
      const vrfStateInfo = await connection.getAccountInfo(VRF_STATE_PDA);

      if (!vrfStateInfo) {
        return {
          initialized: false,
          message: "VRF state not initialized"
        };
      }

      // Parse VRF state (simplified)
      const data = vrfStateInfo.data;
      const authority = new PublicKey(data.subarray(8, 40)); // Skip discriminator, read pubkey
      const nonce = data.readBigUInt64LE(40); // Read nonce

      return {
        initialized: true,
        authority: authority.toString(),
        nonce: Number(nonce),
        programId: VRF_PROGRAM_ID.toString(),
        stateAddress: VRF_STATE_PDA.toString()
      };

    } catch (error) {
      console.error("Error checking VRF status:", error);
      return {
        initialized: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  },
});
