# Domin8 VRF Deployment Information

## Devnet Deployment

**Date**: September 29, 2025
**Network**: Solana Devnet
**Program ID**: `96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF`

### Authority Wallet
- **Public Key**: `GpY926Rz2YxoorQg26PavLwbuCNnngQ1zZHKNEsFSaYs`
- **Keypair Path**: `~/.config/solana/devnet.json`
- **Network**: Devnet

### Deployment Transaction
- **Latest Signature**: `5KofLReQMM3CXXWnZKQ4iP7UN3axXEfTD36TxuuzKUiiVueD6Cq9ejeD2BKBs8hFAioWJ6V896tPFep875MXX28Y`
- **Explorer**: [View on Solana Explorer](https://explorer.solana.com/tx/5KofLReQMM3CXXWnZKQ4iP7UN3axXEfTD36TxuuzKUiiVueD6Cq9ejeD2BKBs8hFAioWJ6V896tPFep875MXX28Y?cluster=devnet)
- **Previous**: `C1XFhhxfGveenKuEY9KvwyzBSF2SuBLDnp2fHM6gY2iWbVYps7Ltvj7pvq8zDvz7M1SHfW6u5C8zmBQkfkQ8mx1`

### Program Explorer
[View Program on Solana Explorer](https://explorer.solana.com/address/96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF?cluster=devnet)

### Test Results
✅ All tests passing on devnet:
- Initializes the VRF state
- Requests VRF for quick games (round 1)
- Requests VRF for long games (both rounds)
- Marks seeds as used
- Prevents invalid round numbers

### Important Accounts

#### VRF State (Singleton) - ✅ INITIALIZED
- **PDA Seeds**: `["vrf_state"]`
- **PDA Address**: `8BqRVTALxkW5HxiV7DLSJuTqbB4FvfHhPcNU5mEDaRD3`
- **Authority**: `GpY926Rz2YxoorQg26PavLwbuCNnngQ1zZHKNEsFSaYs`
- **Current Nonce**: 5 (VRF requests completed during testing)
- **Account Size**: 48 bytes (8 discriminator + 40 data)
- **Status**: Rent-exempt, ready for production use

### Next Steps

1. **✅ VRF State Initialized on Devnet**
   - VRF state is ready and functional
   - No further initialization needed

2. **Integrate with Convex Backend**
   - Use `@solana/web3.js` to call the program from your backend
   - Authority keypair needed for requesting VRF
   - PDA address for VRF state: `8BqRVTALxkW5HxiV7DLSJuTqbB4FvfHhPcNU5mEDaRD3`

3. **Monitor on Devnet**
   - Test with real game flows
   - Monitor transaction costs
   - Verify randomness quality

### Useful Commands

```bash
# Check program deployment
solana program show 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF --url devnet

# Check VRF state account (INITIALIZED)
solana account 8BqRVTALxkW5HxiV7DLSJuTqbB4FvfHhPcNU5mEDaRD3 --url devnet

# Get more devnet SOL
solana airdrop 2 --url devnet

# Run tests
anchor test --skip-deploy --provider.cluster devnet

# View real-time logs
solana logs 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF --url devnet

# Check authority balance
solana balance --keypair ~/.config/solana/devnet.json --url devnet
```

### Understanding PDAs (Program Derived Addresses)

**PDA = Program Derived Address** - A special type of address in Solana that:

#### What is a PDA?
- An address **derived deterministically** from seeds + program ID
- **Not controlled by a private key** (no one owns it)
- **Only the program can sign** for this address
- **Always the same address** for the same seeds

#### Our VRF State PDA Example:
```
Seeds: ["vrf_state"]
Program ID: 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF
Result: 8BqRVTALxkW5HxiV7DLSJuTqbB4FvfHhPcNU5mEDaRD3
```

#### Why Use PDAs?
1. **Predictable**: Can always calculate the same address
2. **Secure**: Only our program can modify the account
3. **No private keys**: No risk of key theft
4. **Cross-client**: Any app can find the account using the same seeds

#### Game Seed PDAs:
For each game, we create unique PDAs:
```
Seeds: ["game_seed", "game_123", 1]  → Address for game 123, round 1
Seeds: ["game_seed", "game_123", 2]  → Address for game 123, round 2
Seeds: ["game_seed", "game_456", 1]  → Address for game 456, round 1
```

This is like having **deterministic file paths** that anyone can calculate!

### Security Notes

⚠️ **IMPORTANT**:
- The seed phrase for the devnet wallet is saved in your terminal history
- For mainnet deployment, use a secure wallet management solution
- Never commit private keys or seed phrases to git

### Cost Analysis (Devnet)
- Initialize VRF State: ~0.00144 SOL (one-time)
- Request VRF: ~0.00089 SOL per request
- Mark Seed Used: ~0.00001 SOL per operation

### Mainnet Preparation
Before mainnet deployment:
1. Audit the smart contract
2. Set up secure key management
3. Test thoroughly on devnet
4. Prepare monitoring and alerts
5. Document emergency procedures