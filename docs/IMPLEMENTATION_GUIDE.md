# Domin8 Frontend Implementation Guide

## Overview

This guide shows you how to use the provided hooks and backend functions to build the Domin8 frontend MVP.

---

## 📁 Files Created

### Frontend Hook

- **`src/hooks/useGameContract.ts`** - React hook for smart contract interactions

### Backend (Convex)

- **`convex/lib/solana.ts`** - Solana smart contract integration (SolanaClient class with IDL)
- **`convex/gameManager.ts`** - Main game loop (cron handler)
- **`convex/gameManagerDb.ts`** - Database operations for games
- **`convex/crons.ts`** - Cron job definitions
- **`convex/transactions.ts`** - Transaction cleanup

### Documentation

- **`docs/MAINNET_CRITICAL_TODOS.md`** - Critical features needed before mainnet
- **`docs/IMPLEMENTATION_GUIDE.md`** - This file

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install @privy-io/react-auth
bun install @privy-io/react-auth/solana
bun install @solana/kit
bun install @solana/web3.js
bun install @coral-xyz/anchor
```

### 2. Set Environment Variables

Add to `.env.local`:

```bash
# Solana
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com

# Privy
VITE_PRIVY_APP_ID=your_privy_app_id  # Client-side (exposed to browser)
PRIVY_APP_SECRET=your_privy_secret   # Backend-only (Convex uses this)

# Backend (Convex)
SOLANA_RPC_URL=https://api.devnet.solana.com
GAME_PROGRAM_ID=8BH1JMeZCohtUKcfGGTqpYjpwxMowZBi6HrnAhc6eJFz
BACKEND_WALLET_SECRET=[185,143,171,38,...]  # Your backend wallet keypair
```

### 3. Use the Hook in Your Component

```typescript
import { useGameContract } from '@/hooks/useGameContract';

function GameComponent() {
  const {
    connected,
    publicKey,
    getBalance,
    validateBet,
    canPlaceBet,
    createGame,
    placeBet,
    fetchGameRound,
    fetchCurrentRoundId,
    MIN_BET,
  } = useGameContract();

  const [balance, setBalance] = useState(0);
  const [betAmount, setBetAmount] = useState(MIN_BET);

  // Fetch balance on mount
  useEffect(() => {
    if (connected) {
      getBalance().then(setBalance);
    }
  }, [connected, getBalance]);

  // Handle bet placement
  const handlePlaceBet = async () => {
    try {
      // Validate bet
      const validation = await validateBet(betAmount);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }

      // Place bet
      const signature = await placeBet(betAmount);
      alert(`Bet placed! Tx: ${signature}`);

      // Refresh balance
      const newBalance = await getBalance();
      setBalance(newBalance);

    } catch (error) {
      console.error('Error placing bet:', error);
      alert(error.message);
    }
  };

  return (
    <div>
      <h1>Domin8 Game</h1>

      {!connected ? (
        <p>Please connect your wallet</p>
      ) : (
        <>
          <p>Balance: {balance.toFixed(4)} SOL</p>
          <p>Min Bet: {MIN_BET} SOL</p>

          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(parseFloat(e.target.value))}
            min={MIN_BET}
            step={0.01}
          />

          <button onClick={handlePlaceBet}>
            Place Bet
          </button>
        </>
      )}
    </div>
  );
}
```

---

## 🔧 Important Implementation Notes

### Hook Implementation

The `useGameContract.ts` hook uses **@solana/kit** for transaction building (NOT Anchor Program methods):

```typescript
// Pattern: Manual instruction building with @solana/kit
import {
  createSolanaRpc,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  getTransactionEncoder,
  address,
  pipe,
} from "@solana/kit";

// Create instruction data with discriminator
const instructionData = new Uint8Array(16);
const discriminator = new Uint8Array([82, 23, 26, 58, 40, 4, 106, 159]);
instructionData.set(discriminator, 0);

// Build transaction
const transaction = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayer(address(wallet.address), tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstructions([instruction], tx),
  (tx) => compileTransaction(tx),
  (tx) => new Uint8Array(getTransactionEncoder().encode(tx))
);

// Sign and send with Privy
const receipts = await wallet.signAndSendAllTransactions([
  {
    chain: `solana:${network}`,
    transaction,
  },
]);
```

### Get Instruction Discriminators

```bash
# After building your smart contract
anchor build

# IDL contains discriminators for each instruction
# Look at target/idl/domin8_prgm.json
# Find "instructions" array, each has a discriminator field

# Example for deposit_bet:
# "discriminator": [82, 23, 26, 58, 40, 4, 106, 159]
```

### Hook is Production-Ready

The hook already implements:

1. ✅ Privy wallet integration via `usePrivyWallet()`
2. ✅ Manual instruction building with @solana/kit
3. ✅ Transaction signing with `signAndSendAllTransactions()`
4. ✅ PDA derivation for all accounts
5. ✅ Balance checking and validation

---

## 🔄 Backend Integration (Convex)

### The cron jobs automatically handle:

- ✅ Sync game state from blockchain (every 5s)
- ✅ Close betting window when timeout expires (every 10s)
- ✅ Check VRF fulfillment (every 5s)
- ✅ Monitor stuck games (every hour)
- ✅ Cleanup old records (daily)

### No manual intervention needed!

The backend runs autonomously once deployed.

### Deploy Convex:

```bash
npx convex dev  # Development
npx convex deploy  # Production
```

### Monitor Convex:

Visit https://dashboard.convex.dev to see:

- Cron job execution logs
- Database queries
- Function performance

---

## 📊 Frontend Data Flow

### 1. User Places Bet

```
User clicks "Bet"
  → useGameContract.placeBet()
  → Signs transaction with wallet
  → Transaction sent to Solana
  → Confirmation received
  → UI updated
```

### 2. Backend Syncs State

```
Cron runs (every 5s)
  → convex/solana.syncGameState()
  → Fetches on-chain game data
  → Updates Convex database
  → Frontend queries Convex for fast data
```

### 3. Betting Window Closes

```
Cron runs (every 10s)
  → convex/solana.closeBettingWindow()
  → Checks if endTimestamp reached
  → Sends close_betting_window tx
  → Game status → AwaitingWinnerRandomness
```

### 4. Winner Selected

```
Cron runs (every 5s)
  → convex/solana.checkVrfFulfillment()
  → Checks if ORAO VRF fulfilled
  → If yes → selectWinnerAndPayout()
  → Winner determined
  → Game status → Finished
```

---

## 🎨 UI Components to Build

### 1. Wallet Connection (Privy)

```typescript
import { usePrivy } from '@privy-io/react-auth';

function WalletButton() {
  const { ready, authenticated, login, logout } = usePrivy();

  if (!ready) return <div>Loading...</div>;

  return authenticated ? (
    <button onClick={logout}>Disconnect</button>
  ) : (
    <button onClick={login}>Connect Wallet</button>
  );
}
```

### 2. Game Status Display

```typescript
function GameStatus({ game }) {
  const statusDisplay = {
    waiting: 'Betting open!',
    awaitingWinnerRandomness: 'Selecting winner...',
    finished: 'Game complete!',
  };

  return <div>{statusDisplay[game.status]}</div>;
}
```

### 3. Countdown Timer

```typescript
function BettingTimer({ endTimestamp }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, endTimestamp - now));
    }, 1000);

    return () => clearInterval(interval);
  }, [endTimestamp]);

  return <div>{timeLeft}s remaining</div>;
}
```

### 4. Bet Input with Validation

```typescript
function BetInput({ onBet }) {
  const { validateBet, MIN_BET } = useGameContract();
  const [amount, setAmount] = useState(MIN_BET);
  const [error, setError] = useState('');

  const handleChange = async (value) => {
    setAmount(value);

    const validation = await validateBet(value);
    setError(validation.error || '');
  };

  return (
    <>
      <input
        type="number"
        value={amount}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button
        onClick={() => onBet(amount)}
        disabled={!!error}
      >
        Place Bet
      </button>
    </>
  );
}
```

### 5. Transaction Status

```typescript
function TransactionStatus({ signature, status }) {
  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

  return (
    <div>
      <p>Status: {status}</p>
      <a href={explorerUrl} target="_blank">
        View on Explorer
      </a>
    </div>
  );
}
```

---

## ⚠️ MVP Limitations

For the MVP (devnet), you can skip:

- ❌ Emergency withdraw (needed for mainnet)
- ❌ Winner claim separate from payout (needed for mainnet)
- ❌ Rate limiting (good to have)
- ❌ Advanced error recovery

Just implement:

- ✅ Wallet connection
- ✅ Bet placement
- ✅ Game status display
- ✅ Basic error handling
- ✅ Transaction confirmation

---

## 🧪 Testing Checklist

Before launching MVP:

- [ ] User can connect wallet
- [ ] User can see their balance
- [ ] User can place bet (min 0.01 SOL)
- [ ] Transaction confirmation shows
- [ ] Error messages display properly
- [ ] Betting window countdown works
- [ ] Game status updates automatically
- [ ] Winner announcement displays
- [ ] Multiple users can bet simultaneously
- [ ] Game progresses through all phases

---

## 📚 Additional Resources

- **Smart Contract**: `programs/domin8_prgm/src/`
- **Test Suite**: `tests/devnet.test.ts` (working examples)
- **Architecture**: `CLAUDE.md`
- **Mainnet TODOs**: `docs/MAINNET_CRITICAL_TODOS.md`

---

## 🆘 Common Issues

### "Wallet not connected"

Make sure you're wrapping your app with Privy provider:

```typescript
import { PrivyProvider } from '@privy-io/react-auth';

<PrivyProvider
  appId={import.meta.env.VITE_PRIVY_APP_ID}
  config={{
    loginMethods: ['email', 'wallet', 'google'],
    appearance: {
      theme: 'dark',
      accentColor: '#676FFF',
    },
  }}
>
  <App />
</PrivyProvider>
```

### "Insufficient funds"

Test wallets need SOL. Get devnet SOL from:

```bash
solana airdrop 1 YOUR_WALLET_ADDRESS --url devnet
```

### "Transaction simulation failed"

Check:

- Smart contract is deployed to devnet
- Program ID matches in env vars
- Game is initialized (run `anchor test` first)

---

**Good luck building! 🚀**

For questions, check the test suite (`tests/devnet.test.ts`) for working examples of all instructions.
