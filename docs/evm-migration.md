# **Domin8 Game: Solana to EVM Migration \- Technical Documentation**

## **1\. Project Overview**

This document outlines the complete technical process of migrating the Domin8 betting game from a Solana (Anchor) smart contract and corresponding Convex backend to an EVM-compatible architecture, targeting the Base blockchain.

The primary objectives of this migration were:

* **Translate the on-chain logic** from Rust (Anchor) to Solidity.  
* **Replace Solana-specific services** (like ORAO VRF) with EVM-native alternatives (Chainlink VRF).  
* **Re-engineer the Convex backend** to communicate with an EVM blockchain instead of Solana.  
* **Maintain the core application logic** and the dual-system of a polling "crank" service and a real-time event listener.

## **2\. Phase 1: Smart Contract Migration (Anchor to Solidity)**

The first step was to translate the on-chain program from Rust/Anchor to Solidity. This involved not just a language change, but also adapting to the architectural differences between the two blockchain ecosystems.

### **Key Architectural Changes**

* **State Management**:  
  * **Before (Solana)**: State was stored in separate accounts derived from Program Derived Addresses (PDAs), such as GameRound, GameConfig, etc.  
  * **After (EVM)**: State is stored directly within the single Domin8.sol smart contract's storage. We now use structs (GameRound, GameConfig) and mappings (mapping(uint64 \=\> GameRound)) to organize this data.  
* **Randomness (VRF)**:  
  * **Before (Solana)**: The system relied on the ORAO VRF for on-chain randomness.  
  * **After (EVM)**: We integrated **Chainlink VRF v2**, the industry standard for verifiable randomness on EVM chains. The contract inherits from VRFConsumerBaseV2 and implements the fulfillRandomWords callback function to securely receive the random number.  
* **Payments**:  
  * **Before (Solana)**: Payments were handled in SOL (lamports).  
  * **After (EVM)**: The contract is now payable and handles all financial transactions in ETH (wei).

### **Final Solidity Contract: Domin8.sol**

The final product of this phase is a single, comprehensive smart contract that encapsulates all on-chain game logic.

**Core Components:**

* **State**: GameRound struct, gameRounds mapping, and configuration variables.  
* **Functions**:  
  * createGame(): Initializes a new round on the first bet and requests randomness from Chainlink.  
  * placeBet(): Allows subsequent players to join the current round.  
  * closeBettingWindow(): A function restricted to the "crank" (authority) to lock the game.  
  * selectWinnerAndPayout(): Uses the fulfilled randomness to select a winner, calculate payouts, and distribute the ETH.  
* **Events**: Emits events like BetPlaced and WinnerSelected for off-chain services to easily track activity.

## **3\. Phase 2: Convex Backend Adaptation**

With the new smart contract designed, the Convex backend was re-engineered to communicate with it. This involved replacing the entire Solana communication layer.

### **3.1. Core Infrastructure: EVM Client & Types**

* **convex/lib/evm.ts**: The SolanaClient was replaced with a new EvmClient. This class uses the **ethers.js** library to connect to an EVM RPC, manage the authority wallet, and create an interface for interacting with the deployed Domin8.sol contract.  
* **convex/lib/types.ts**: All Solana-specific data types were updated to match their Solidity counterparts (e.g., PublicKey became string for 0x... addresses, and large numbers like uint256 are handled as strings to prevent precision loss).  
* **convex/lib/Domin8.json & VRFCoordinatorV2.json**: These are placeholders for the **ABIs** (Application Binary Interfaces) of our contract and the Chainlink coordinator. The ABIs are essential JSON files that tell ethers.js how to format calls to the smart contracts.

### **3.2. Database Schema Update**

* **convex/schema.ts**: The database schema was updated to align with the new EVM data structures. Key changes include:  
  * walletAddress fields now store EVM addresses.  
  * totalPot and amount fields are now v.string() to handle uint256.  
  * Solana-specific fields like vrfRequestPubkey were replaced with vrfRequestId (bytes32).  
  * txSignature was renamed to txHash.

### **3.3. "Crank" Service Migration**

* **convex/gameManager.ts**: The core polling service was rewritten. Instead of calling the SolanaClient, it now uses the EvmClient to:  
  1. Fetch the current gameRound state from the Domin8.sol contract.  
  2. Check the game's status and timing conditions.  
  3. Call the appropriate contract functions (closeBettingWindow or selectWinnerAndPayout) to progress the game.  
  4. Log the transactions it sends.  
* **convex/gameManagerDb.ts**: This file was updated with a new syncGameRecord function. This function is now the primary method for the polling service to synchronize the on-chain state with the Convex database, creating a new game record if one doesn't exist for the current roundId.

### **3.4. Real-Time Event Listener Implementation**

* **convex/eventListener.ts**: This new file is the real-time counterpart to the polling gameManager. It is designed to be run by a frequent cron job (e.g., every 5-10 seconds). Its process is:  
  1. Get the latest block number from the EVM node.  
  2. Scan the range of blocks since its last run for any events emitted by our Domin8.sol contract.  
  3. When an event is found (e.g., BetPlaced), it decodes the event data.  
  4. It then calls an internal mutation in Convex to immediately update the database.  
* **convex/bets.ts**: This file was updated to include the internal mutations (createOrUpdateBetFromEvent, settleBetsFromEvent) that are called by the event listener. This ensures that as soon as a player's bet is confirmed on-chain, a corresponding record is created in our database without waiting for the next polling cycle.

## **4\. Final Architecture & Next Steps**

The migration is complete. The final backend architecture utilizes a dual-update system:

1. **Polling Crank (gameManager)**: Guarantees game progression by periodically checking the on-chain state and sending transactions.  
2. **Real-Time Listener (eventListener)**: Provides a responsive user experience by updating the database almost instantly when on-chain events occur.

### **Your Next Steps:**

1. **Compile & Deploy**: Compile the Domin8.sol contract to get its ABI and bytecode. Deploy it to the Base network.  
2. **Update ABIs**: Replace the placeholder .json files in convex/lib/ with the real ABIs.  
3. **Set Environment Variables**: In your Convex project settings, define the following environment variables:  
   * EVM\_RPC\_ENDPOINT: The RPC URL for the Base network.  
   * CRANK\_AUTHORITY\_PRIVATE\_KEY: The private key for the wallet that will act as the crank.  
   * DOMIN8\_CONTRACT\_ADDRESS: The address of your deployed contract.  
4. **Frontend Integration**: Update your frontend application to connect to the Base network (using a library like ethers.js or wagmi) and interact with the new smart contract.