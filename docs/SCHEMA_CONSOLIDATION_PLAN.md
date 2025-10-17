# Schema Consolidation Plan: gameParticipants → bets

## Overview
Consolidating `gameParticipants` and `bets` tables into a single `bets` table to eliminate redundancy and simplify data model.

## Key Changes

### Table Structure
- **Removed**: `gameParticipants` table
- **Enhanced**: `bets` table now contains all participant and betting data
- **Result**: Single source of truth per game participant/bet

### Bet Types
```typescript
betType: "self" | "spectator" | "bank"
```
- **self**: Player betting on themselves (creates a participant)
- **spectator**: Player betting on another participant  
- **bank**: Bank bot opponent for solo players

### Data Relationships
- **Self bets**: Have position, character, elimination data
- **Spectator bets**: Reference target via `targetBetId`
- **Bank bets**: Similar to self bets but system-generated

## Migration Checklist

### Backend Files to Update

#### `/convex/games.ts`
- [ ] Replace `gameParticipants` queries with `bets` where `betType === "self"`
- [ ] Update participant creation to create bet records
- [ ] Update elimination logic to reference bets table
- [ ] Update winner selection to use bets table

#### `/convex/players.ts` 
- [ ] Update `placeBet` to create unified bet record
- [ ] Remove separate participant creation logic
- [ ] Update spectator betting to reference `targetBetId`

#### `/convex/crons.ts`
- [ ] Update game loop to query bets table
- [ ] Update settlement logic for new structure

#### `/convex/solana.ts`
- [ ] Update blockchain sync to write to bets table
- [ ] Update payout calculations for new fields

### Frontend Files to Update

#### `/src/hooks/useGameState.ts`
- [ ] Update queries to fetch from bets table
- [ ] Filter by `betType === "self"` for participants
- [ ] Update spectator bet queries

#### `/src/components/GameArena.tsx`
- [ ] Update participant rendering from bets data
- [ ] Update position/size calculations

#### `/src/components/BettingPanel.tsx`
- [ ] Update bet placement for new structure
- [ ] Handle targetBetId for spectator bets

#### `/src/game/scenes/GameScene.ts`
- [ ] Update sprite creation from bets data
- [ ] Update elimination animations

## Query Replacements

### Before
```typescript
// Get game participants
const participants = await ctx.db
  .query("gameParticipants")
  .withIndex("by_game", q => q.eq("gameId", gameId))
  .collect();

// Get bets for a participant
const bets = await ctx.db
  .query("bets")
  .withIndex("by_target", q => q.eq("targetParticipantId", participantId))
  .collect();
```

### After
```typescript
// Get game participants (self bets only)
const participants = await ctx.db
  .query("bets")
  .withIndex("by_game_type", q => 
    q.eq("gameId", gameId).eq("betType", "self")
  )
  .collect();

// Get spectator bets for a participant
const spectatorBets = await ctx.db
  .query("bets")
  .withIndex("by_target", q => q.eq("targetBetId", participantBetId))
  .filter(q => q.eq(q.field("betType"), "spectator"))
  .collect();
```

## Benefits

1. **Eliminates Redundancy**: No duplicate storage of gameId, playerId, walletAddress
2. **Simpler Queries**: No need to join participants with bets
3. **Better Performance**: Fewer database operations
4. **Cleaner Model**: Participant-centric view matches game logic
5. **Blockchain Alignment**: Mirrors Solana program's BetEntry structure

## Data Integrity Rules

### Self Bets
- MUST have: position, size, spawnIndex, characterId
- CAN have: eliminated, eliminatedAt, eliminatedBy, finalPosition

### Spectator Bets  
- MUST have: targetBetId (pointing to a self bet)
- MUST NOT have: position, size, characterId, elimination data

### Bank Bets
- Similar to self bets
- System-generated with 55% win chance
- Only created for solo players

## Migration Steps

1. **Deploy new schema** with consolidated bets table
2. **Run migration script** to copy gameParticipants → bets
3. **Update all queries** in backend and frontend
4. **Test thoroughly** with demo and real games
5. **Remove gameParticipants** table from schema

## Validation

After migration, ensure:
- [ ] All self bets have position data
- [ ] All spectator bets have valid targetBetId
- [ ] No orphaned references
- [ ] Game rendering works correctly
- [ ] Settlement calculations are accurate
- [ ] Blockchain sync continues working