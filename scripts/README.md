# Domin8 Initialization Scripts

This directory contains scripts to initialize the Domin8 game program on Solana.

## Scripts

### 1. TypeScript Version (`initialize-game.ts`)
Full-featured TypeScript script with type safety and better error handling.

**Usage:**
```bash
npm run script:initialize
# or
npx ts-node scripts/initialize-game.ts
# or (if using Bun)
bun run scripts/initialize-game.ts
```

### 2. JavaScript Version (`initialize-game.js`)
Simplified JavaScript version that runs directly with Node.js.

**Usage:**
```bash
npm run script:initialize:js
# or
node scripts/initialize-game.js
```

## What the Scripts Do

1. **Setup Environment**: Configures Anchor provider and connects to the Solana cluster
2. **Create Treasury**: Generates a new treasury keypair and funds it with 1 SOL
3. **Derive PDAs**: Calculates Program Derived Addresses for:
   - Game Configuration (`game_config`)
   - Game Round (`game_round`) 
   - Vault (`vault`)
4. **Check Existing State**: Verifies if the game is already initialized
5. **Initialize Game**: Calls the `initialize` instruction with the treasury public key
6. **Display Results**: Shows the initialized configuration and game state

## Prerequisites

1. **Anchor Environment**: Make sure you have Anchor CLI installed and configured
2. **Solana Wallet**: Ensure your Solana wallet is funded with SOL for transaction fees
3. **Local Validator**: For testing, run a local Solana validator:
   ```bash
   solana-test-validator
   ```
4. **Program Deployed**: The Domin8 program should be built and deployed:
   ```bash
   anchor build
   anchor deploy
   ```

## Configuration

The scripts use the Anchor environment configuration from:
- `Anchor.toml` - for program ID and cluster settings
- Your local Solana CLI config - for keypair and RPC endpoint

Default settings:
- **Cluster**: Uses the cluster specified in your Anchor.toml
- **Authority**: Uses your local Solana wallet as the program authority
- **Treasury**: Generates a new random keypair (you may want to change this for production)

## Production Considerations

For production deployment, you should:

1. **Use a Specific Treasury**: Instead of generating a random treasury keypair, use a predetermined one:
   ```typescript
   // Replace this line:
   const treasury = Keypair.generate();
   
   // With something like:
   const treasury = Keypair.fromSecretKey(
     bs58.decode("your-treasury-private-key-here")
   );
   ```

2. **Secure Key Management**: Store private keys securely, not in the code
3. **Verify Program ID**: Ensure the correct program ID is deployed and configured
4. **Test on Devnet**: Always test thoroughly on devnet before mainnet deployment

## Troubleshooting

### Common Issues:

1. **"Account already initialized"**: The game has already been initialized. Use a fresh cluster or check the existing configuration.

2. **"Insufficient funds"**: Make sure your authority wallet has enough SOL for transaction fees.

3. **"Program not found"**: Ensure the program is built and deployed:
   ```bash
   anchor build
   anchor deploy
   ```

4. **"Connection refused"**: Make sure your Solana validator is running and the RPC endpoint is correct.

### Debug Commands:

```bash
# Check your Solana configuration
solana config get

# Check wallet balance
solana balance

# Check program account info
solana account [PROGRAM_ID]

# View transaction logs
solana logs [TRANSACTION_SIGNATURE]
```

## Example Output

When successful, you should see output like:

```
🚀 Starting Domin8 Game Initialization...

📋 Configuration:
Program ID: CsCFNMvVnp8Mm1ijHJd7HvKHDB8TPQ9eKv2dptMpiXfK
RPC Endpoint: http://127.0.0.1:8899
Authority: 7xKXtg2CW87d97TXJSDaJbp5iGNv6gRj5gYrx7mKqQMj

Treasury: 3xKXtg2CW87d97TXJSDaJbp5iGNv6gRj5gYrx7mKqMQ
💰 Funding treasury account...
✅ Treasury funded with 1 SOL

🔑 Program Derived Addresses (PDAs):
Config PDA: 8xKXtg2CW87d97TXJSDaJbp5iGNv6gRj5gYrx7mKqMP
Game Round PDA: 9xKXtg2CW87d97TXJSDaJbp5iGNv6gRj5gYrx7mKqMX
Vault PDA: AxKXtg2CW87d97TXJSDaJbp5iGNv6gRj5gYrx7mKqMY

✅ No existing configuration found, proceeding with initialization...

🎮 Calling initialize instruction...
✅ Transaction successful! Signature: 5xKXtg2CW87d97TXJSDaJbp5iGNv6gRj5gYrx7mKqMZ

📊 Game Configuration Initialized:
Authority: 7xKXtg2CW87d97TXJSDaJbp5iGNv6gRj5gYrx7mKqQMj
Treasury: 3xKXtg2CW87d97TXJSDaJbp5iGNv6gRj5gYrx7mKqMQ
House Fee: 250 basis points (2.5%)
Min Bet: 0.1 SOL
Small Game Waiting Duration: 30 seconds

🎯 Initial Game Round State:
Round ID: 0
Status: idle
Players: 0
Initial Pot: 0 SOL
VRF Request: 11111111111111111111111111111111
Randomness Fulfilled: false

🎉 Game initialization completed successfully!
The game is now ready for players to join and place bets.

✨ Script completed successfully!
```