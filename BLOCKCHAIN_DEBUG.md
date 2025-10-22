# Blockchain Debug Panel

## Overview

A comprehensive debugging tool that shows real-time blockchain state in a dialog overlay. Essential for development to quickly identify issues with smart contract integration.

## Features

### 🎯 Real-Time State Monitoring
- Auto-refreshes every 5 seconds
- Manual refresh button available
- Shows loading states during fetches

### 📊 Information Displayed

#### Connection Info
- ✅ Connection status (Connected/Disconnected)
- 🌐 RPC endpoint being used
- 🔑 Program ID (with copy button)

#### Game Status
- **Current Round ID**: Which game round we're on
- **Game Round PDA**: The on-chain address of the game account
- **Game Exists**: Whether there's an active game (⚠️ critical for debugging bet errors)

#### Game Config (if initialized)
- Authority wallet
- Treasury wallet
- Minimum bet amount
- House fee percentage
- Bets locked status (shows if betting is currently blocked)
- Waiting phase duration

#### Active Game Round (if exists)
- Round ID
- Current status (Idle/Waiting/AwaitingWinnerRandomness/Finished)
- Start and end timestamps
- Total pot size
- Number of bets placed
- Winner (if determined)
- VRF request public key
- Randomness fulfillment status

#### Vault
- Vault PDA address
- Current balance in SOL

### 🛠️ Troubleshooting Helpers

**When No Active Game Exists:**
Shows a yellow warning box with:
- Clear explanation that a game needs to be created
- Copy-paste command to create a game
- Visual alert icon

## Usage

### Opening the Debug Panel

Click the purple **`?`** icon in the top-right corner of your screen.

### Understanding Common Issues

**Error #6035 or #3012**: "No active game"
- Check "Game Exists" field - should say "Yes"
- If it says "No", you need to run the create-game script
- Copy the command from the yellow warning box

**Error #3003**: "Account did not deserialize"
- Program on devnet doesn't match your local code
- Need to redeploy: `anchor deploy --provider.cluster devnet`

**Bets Not Working:**
- Check "Bets Locked" - should be "No" (green checkmark)
- Check game status - should be "Waiting"
- Check "End Time" - current time must be before end time

### Copying Addresses

Click the 📋 button next to any address to copy it to clipboard. Useful for:
- Checking accounts in Solana Explorer
- Using in scripts
- Sharing with team members

## Auto-Refresh

The panel automatically refreshes every 5 seconds to show the latest state. You can see:
- When a game transitions between statuses
- When bets are placed (bet count increases)
- When the pot grows
- When randomness is fulfilled

## Development Workflow

1. **Check Connection**: Ensure you're connected to the right network
2. **Verify Program ID**: Match it with your deployed program
3. **Check Game Exists**: If "No", create a game first
4. **Monitor Game Status**: Watch status transitions
5. **Debug Bets**: See bet count increase in real-time

## Related Files

- **Hook**: `src/hooks/useBlockchainDebug.ts`
- **Component**: `src/components/BlockchainDebugDialog.tsx`
- **Integration**: `src/App.tsx`

## Tips

- Keep the panel open while testing bet flows
- Use manual refresh (🔄) when you make state changes
- Copy PDAs to verify in Solana Explorer (`https://explorer.solana.com/address/YOUR_ADDRESS?cluster=devnet`)
- Yellow warnings are actionable - they tell you exactly what to do

## Production

This debug panel should be **removed or hidden** in production. Consider:
- Env variable check: `import.meta.env.MODE === 'development'`
- Remove the component entirely from App.tsx
- Or hide behind a secret key combination

Example:
```typescript
{import.meta.env.MODE === 'development' && <BlockchainDebugDialog />}
```
