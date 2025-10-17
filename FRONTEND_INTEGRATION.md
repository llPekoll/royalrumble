# Frontend Integration Guide - Betting Countdown & Game Status

## 🎉 What's New

- ✅ **Countdown Timer**: Shows time remaining until betting closes
- ✅ **Game Status Indicator**: Visual feedback for game state
- ✅ **Auto-Progress**: Backend cron automatically closes betting when time expires
- ✅ **Lock Indicator**: Shows when game is locked during resolution

---

## 📦 Components Created

### 1. `BettingCountdown.tsx`
Real-time countdown showing when betting closes.

**Features:**
- ⏱️ Live countdown timer (MM:SS format)
- 📊 Visual progress bar
- 🎨 Color-coded urgency (green → yellow → red)
- 🔒 Lock indicator
- 👥 Player count display

### 2. `GameStatus.tsx`
Status badge showing current game phase.

**States:**
- 🟢 **Betting Open**: Green, pulsing
- ⏰ **Betting Closed**: Yellow (when time expired)
- 🔒 **Game Locked**: Orange (during VRF)
- 🎲 **Drawing Winner**: Blue, pulsing
- 🏆 **Game Complete**: Purple
- ⏳ **Waiting for Players**: Gray

---

## 🔧 Hook Updates

### `useGameState.ts`

**New Fields:**
```typescript
// GameState interface
interface GameState {
  endTimestamp: number;  // ⭐ When betting closes (Unix timestamp)
  // ... existing fields
}

// GameConfig interface
interface GameConfig {
  gameLocked: boolean;   // ⭐ Is game locked?
  // ... existing fields
}
```

---

## 🎨 Usage Examples

### Basic Integration

```tsx
import { BettingCountdown } from './components/BettingCountdown';
import { GameStatus } from './components/GameStatus';

function GamePage() {
  return (
    <div>
      {/* Status Badge */}
      <GameStatus />

      {/* Countdown Timer */}
      <BettingCountdown />

      {/* Your bet button, etc */}
    </div>
  );
}
```

### Bet Button with Time Check

```tsx
import { useGameState } from './hooks/useGameState';

function BetButton({ amount, onBet }) {
  const { gameState, gameConfig } = useGameState();

  const now = Math.floor(Date.now() / 1000);
  const timeExpired = gameState?.endTimestamp
    ? now > gameState.endTimestamp
    : false;

  const isDisabled =
    gameConfig?.gameLocked ||      // Locked during resolution
    timeExpired ||                 // Time expired
    !gameState?.status === "Waiting";  // Not accepting bets

  const getButtonText = () => {
    if (gameConfig?.gameLocked) return "🔒 Game Locked";
    if (timeExpired) return "⏰ Betting Closed";
    return `Bet ${amount} SOL`;
  };

  return (
    <button
      onClick={onBet}
      disabled={isDisabled}
      className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
    >
      {getButtonText()}
    </button>
  );
}
```

### Full Game UI Example

```tsx
function GameLobby() {
  const { gameState, gameConfig, vaultBalance } = useGameState();

  return (
    <div className="game-lobby">
      {/* Header with Status */}
      <div className="header">
        <h1>Domin8 Battle Royale</h1>
        <GameStatus />
      </div>

      {/* Countdown (only shows during Waiting phase) */}
      <BettingCountdown />

      {/* Game Stats */}
      <div className="stats">
        <div className="stat">
          <label>Total Pot</label>
          <value>{gameState?.initialPot || 0} SOL</value>
        </div>
        <div className="stat">
          <label>Players</label>
          <value>{gameState?.bets.length || 0}</value>
        </div>
        <div className="stat">
          <label>Round</label>
          <value>#{gameState?.roundId || 0}</value>
        </div>
      </div>

      {/* Bet Interface */}
      <BetButton amount={0.1} onBet={handleBet} />

      {/* Player List */}
      <PlayerList bets={gameState?.bets || []} />
    </div>
  );
}
```

---

## 🤖 Backend (Convex) Updates

### Cron Job
The cron now uses `end_timestamp` from the smart contract:

**File**: `convex/gameManager.ts`

```typescript
// OLD: Calculate end time
const waitingEndTime = gameRound.startTimestamp * 1000 + waitingDuration * 1000;

// ⭐ NEW: Read from smart contract
const waitingEndTime = gameRound.endTimestamp * 1000;
```

**Benefits:**
- ✅ Trustless - Smart contract is source of truth
- ✅ Transparent - Anyone can verify on-chain
- ✅ No manipulation - Backend can't extend time

---

## 🎯 User Experience Flow

### 1. No Active Game
```
┌─────────────────────┐
│ ⏳ Waiting for      │
│    Players          │
│                     │
│ Be the first!       │
└─────────────────────┘
```

### 2. Betting Open (25s remaining)
```
┌─────────────────────┐
│ 🟢 Betting Open     │
│    5 players        │
├─────────────────────┤
│   00:25             │
│ ████████████░░  85% │
│ 5 players joined    │
└─────────────────────┘
[Bet 0.1 SOL]
```

### 3. Betting Closing Soon (8s remaining)
```
┌─────────────────────┐
│ 🟢 Betting Open     │
│    8 players        │
├─────────────────────┤
│   00:08  ⚠️         │
│ ████░░░░░░░░  25%   │
│ 8 players joined    │
└─────────────────────┘
[Bet 0.1 SOL] ← Hurry!
```

### 4. Time Expired
```
┌─────────────────────┐
│ ⏰ Betting Closed   │
│    Starting soon    │
├─────────────────────┤
│ ⏰ Betting Closed   │
│ ░░░░░░░░░░░░  0%    │
│ 10 players joined   │
└─────────────────────┘
[⏰ Betting Closed]  ← Disabled
```

### 5. Game Locked (VRF)
```
┌─────────────────────┐
│ 🔒 Game Locked      │
│    Drawing Winner   │
├─────────────────────┤
│ 🎲 VRF in progress  │
└─────────────────────┘
[🔒 Game Locked]  ← Disabled
```

### 6. Winner Announced
```
┌─────────────────────┐
│ 🏆 Game Complete    │
│    Winner selected! │
└─────────────────────┘
Winner: 0x1234...5678
Prize: 0.95 SOL
```

---

## 🎨 Styling Recommendations

### Countdown Timer
```css
.countdown {
  font-family: 'Courier New', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
}

.countdown.urgent {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

### Status Badge
```css
.status-badge {
  transition: all 0.3s ease;
}

.status-badge.pulsing {
  animation: statusPulse 2s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

---

## 📱 Mobile Responsiveness

Both components are mobile-friendly:
- Responsive text sizes
- Touch-friendly spacing
- Clear visual hierarchy
- Optimized for small screens

---

## 🔍 Debugging

### Check if data is loading
```typescript
const { gameState, loading, error } = useGameState();

console.log('Loading:', loading);
console.log('Error:', error);
console.log('Game State:', gameState);
console.log('End Timestamp:', gameState?.endTimestamp);
console.log('Game Locked:', gameConfig?.gameLocked);
```

### Verify smart contract connection
```typescript
// Check if program is deployed
console.log('Program ID:', PROGRAM_ID);
console.log('RPC URL:', RPC_URL);

// Check timestamps
const now = Math.floor(Date.now() / 1000);
console.log('Current Time:', now);
console.log('End Time:', gameState?.endTimestamp);
console.log('Time Remaining:', gameState?.endTimestamp - now);
```

---

## ✅ Testing Checklist

- [ ] Countdown displays correctly
- [ ] Timer updates every second
- [ ] Colors change based on urgency
- [ ] Progress bar animates smoothly
- [ ] Status badge shows correct state
- [ ] Bet button disables when time expires
- [ ] Bet button disables when game locked
- [ ] Lock indicator appears during VRF
- [ ] Components handle null/undefined gracefully
- [ ] Mobile responsive on small screens

---

## 🚀 Next Steps

1. **Import components** in your main game page
2. **Test the flow** with a real bet
3. **Customize styling** to match your design
4. **Add sound effects** for countdown urgency
5. **Add animations** for state transitions

---

## 💡 Tips

- Poll interval is **3 seconds** - adjust if needed
- Timestamps are in **Unix seconds**, not milliseconds
- Smart contract is **source of truth** for time
- Backend cron checks every **5 seconds**
- Always check `gameLocked` before allowing bets

---

**Ready to integrate!** 🎮⚡

Your smart contract now enforces betting windows trustlessly, and your frontend displays it beautifully!
