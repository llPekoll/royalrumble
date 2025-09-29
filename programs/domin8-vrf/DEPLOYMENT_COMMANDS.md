# Complete CLI Commands for VRF Deployment

## Step-by-Step Commands Used for Devnet Deployment

These are all the exact commands used to deploy the VRF program to devnet.
You can follow these same steps for mainnet deployment.

### 1. Check Solana CLI Installation
```bash
# Check if Solana CLI is installed
which solana
# Output: /Users/peko/.local/share/solana/install/active_release/bin/solana

# Check Solana version
solana --version
# Output: solana-cli 2.2.21

# Check if Anchor is installed
which anchor
# Output: /Users/peko/.cargo/bin/anchor

# Check Anchor version
anchor --version
# Output: anchor-cli 0.31.1
```

### 2. Create Anchor Project (Already Done)
```bash
# Navigate to programs directory
mkdir -p programs
cd programs

# Initialize Anchor project
anchor init domin8_vrf --no-git

# Move to correct location
mv domin8_vrf domin8-vrf

# Navigate to project
cd domin8-vrf/programs/domin8_vrf

# Replace yarn with bun
rm -rf node_modules yarn.lock
bun install
```

### 3. Build the Program
```bash
# Build the Anchor program
anchor build
```

### 4. Configure Solana for Target Network

#### For DEVNET:
```bash
# Switch to devnet
solana config set --url devnet

# Create a new wallet for devnet
solana-keygen new --outfile ~/.config/solana/devnet.json --no-bip39-passphrase

# Set the wallet as default
solana config set --keypair ~/.config/solana/devnet.json

# Check configuration
solana config get
```

#### For MAINNET (⚠️ USE SECURE WALLET):
```bash
# Switch to mainnet
solana config set --url mainnet-beta

# For mainnet, use a hardware wallet or secure key management!
# Example with filesystem wallet (NOT RECOMMENDED for production):
solana-keygen new --outfile ~/.config/solana/mainnet.json

# Set the wallet as default
solana config set --keypair ~/.config/solana/mainnet.json

# Check configuration
solana config get
```

### 5. Fund the Wallet

#### For DEVNET:
```bash
# Request airdrop (free testnet SOL)
solana airdrop 2

# Check balance
solana balance
```

#### For MAINNET:
```bash
# You need to purchase/transfer real SOL to your wallet address
# Get your wallet address:
solana address

# Check balance
solana balance
```

### 6. Update Anchor.toml Configuration

#### For DEVNET:
Edit `Anchor.toml`:
```toml
[provider]
cluster = "devnet"
wallet = "~/.config/solana/devnet.json"

[programs.devnet]
domin8_vrf = "96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF"
```

#### For MAINNET:
Edit `Anchor.toml`:
```toml
[provider]
cluster = "mainnet"
wallet = "~/.config/solana/mainnet.json"  # Or your secure wallet path

[programs.mainnet]
domin8_vrf = "96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF"
```

### 7. Deploy the Program

#### Deploy Command (Same for devnet/mainnet):
```bash
# Deploy the program
anchor deploy

# If you need to specify the provider explicitly:
anchor deploy --provider.cluster devnet
# OR for mainnet:
anchor deploy --provider.cluster mainnet
```

### 8. Run Tests

#### Test on Deployed Program:
```bash
# Run tests without redeploying
anchor test --skip-deploy

# Run tests with specific cluster
anchor test --skip-deploy --provider.cluster devnet
# OR for mainnet (be careful - costs real SOL!):
anchor test --skip-deploy --provider.cluster mainnet
```

### 9. Verify Deployment

```bash
# Show program information
solana program show 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF --url devnet
# For mainnet:
solana program show 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF --url mainnet-beta

# View live logs (useful for debugging)
solana logs 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF --url devnet
# For mainnet:
solana logs 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF --url mainnet-beta
```

## Complete Mainnet Deployment Script

Save this as `deploy-mainnet.sh`:

```bash
#!/bin/bash

echo "⚠️ MAINNET DEPLOYMENT - This will use real SOL!"
echo "Make sure you have:"
echo "1. A secure wallet set up"
echo "2. Sufficient SOL for deployment (at least 3 SOL recommended)"
echo "3. Tested thoroughly on devnet"
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# Switch to mainnet
echo "Switching to mainnet..."
solana config set --url mainnet-beta

# Set your mainnet wallet (adjust path as needed)
echo "Setting mainnet wallet..."
solana config set --keypair ~/.config/solana/mainnet.json

# Check balance
echo "Checking balance..."
solana balance

# Confirm balance is sufficient
read -p "Is your balance sufficient? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# Build program
echo "Building program..."
anchor build

# Deploy
echo "Deploying to mainnet..."
anchor deploy --provider.cluster mainnet

echo "Deployment complete!"
echo "Program ID: 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF"
echo "View on Explorer: https://explorer.solana.com/address/96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF"
```

## Important Security Notes for Mainnet

### ⚠️ CRITICAL for Mainnet:

1. **Use Hardware Wallet or Secure Key Management**
   ```bash
   # For Ledger hardware wallet:
   solana config set --keypair usb://ledger
   ```

2. **Never Share Private Keys**
   - Don't commit keypair files to git
   - Use encrypted storage for keypair files
   - Consider using multi-sig for program authority

3. **Test Thoroughly on Devnet First**
   ```bash
   # Always test on devnet before mainnet
   anchor test --provider.cluster devnet
   ```

4. **Monitor Costs**
   - Deployment costs ~2-3 SOL
   - Each VRF request costs ~0.00089 SOL
   - Keep extra SOL for rent exemption

5. **Backup Your Keys**
   ```bash
   # Save your seed phrase securely (NOT in plain text!)
   solana-keygen pubkey ~/.config/solana/mainnet.json
   ```

## Post-Deployment Commands

### Initialize VRF State (One-time)
```bash
# You'll need to create a script or use the tests to initialize
# This must be done once after deployment
```

### Monitor the Program
```bash
# Watch real-time logs
solana logs 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF --url mainnet-beta

# Check program authority
solana program show 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF --url mainnet-beta

# Transfer program authority (if needed)
solana program set-upgrade-authority 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF \
  --new-upgrade-authority <NEW_AUTHORITY_PUBKEY> \
  --url mainnet-beta
```

## Rollback Plan

If something goes wrong:
```bash
# You can upgrade the program with fixes
anchor upgrade <path-to-new-program.so> --program-id 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF

# Or close the program and recover rent (irreversible!)
solana program close 96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF \
  --bypass-warning \
  --url mainnet-beta
```

---

## Summary of Key Differences: Devnet vs Mainnet

| Aspect | Devnet | Mainnet |
|--------|--------|---------|
| Network URL | `https://api.devnet.solana.com` | `https://api.mainnet-beta.solana.com` |
| Cluster Config | `devnet` | `mainnet` or `mainnet-beta` |
| SOL Source | Free via `solana airdrop` | Purchase with real money |
| Wallet Security | Can use simple file wallet | MUST use secure wallet |
| Testing Cost | Free | Costs real money |
| Explorer URL | `?cluster=devnet` | No cluster param needed |
| Risk Level | No risk, test freely | Real money at risk |

---

## Estimated Mainnet Costs

- **Program Deployment**: ~2-3 SOL
- **Initialize VRF State**: ~0.00144 SOL
- **Per VRF Request**: ~0.00089 SOL
- **Rent Exemption**: ~0.5 SOL (stays in program account)
- **Recommended Total**: 5 SOL for safe deployment

---

Save this file for your mainnet deployment reference!