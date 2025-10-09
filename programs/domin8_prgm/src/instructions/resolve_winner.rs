use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameStatus, PlayerEntry};
use crate::constants::*;
use crate::errors::Domin8Error;

#[derive(Accounts)]
pub struct ResolveWinner<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,
    
    #[account(
        mut,
        seeds = [GAME_ROUND_SEED],
        bump
    )]
    pub game_round: Account<'info, GameRound>,
    
    /// The crank authority that can resolve randomness
    #[account(
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,

    /// Switchboard VRF account containing the randomness (optional for testing)
    /// CHECK: This will be properly validated when full Switchboard integration is complete
    pub vrf_account: Option<AccountInfo<'info>>,

    /// Recent blockhashes for entropy (fallback randomness source)
    /// CHECK: Solana sysvar for recent blockhashes
    #[account(address = anchor_lang::solana_program::sysvar::recent_blockhashes::ID)]
    pub recent_blockhashes: AccountInfo<'info>,
}

pub fn resolve_winner(
    ctx: Context<ResolveWinner>,
) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    // Validate game state - must be AwaitingWinnerRandomness
    require!(
        game_round.status == GameStatus::AwaitingWinnerRandomness,
        Domin8Error::InvalidGameStatus
    );

    // Check that commit slot has elapsed
    let clock = Clock::get()?;
    require!(
        clock.slot >= game_round.randomness_commit_slot,
        Domin8Error::CommitSlotNotElapsed
    );

    // Generate randomness using the commit-reveal pattern
    let randomness = generate_verified_randomness(
        &ctx.accounts.vrf_account,
        &ctx.accounts.recent_blockhashes,
        game_round.randomness_commit_slot,
        clock.slot,
    )?;

    msg!("Generated randomness for winner selection: {}", randomness);

    // Small games MVP: select winner from all players
    require!(
        game_round.players.len() >= 2,
        Domin8Error::InvalidGameStatus
    );
    
    // Convert Vec<PlayerEntry> to Vec<&PlayerEntry> for the function
    let player_refs: Vec<&PlayerEntry> = game_round.players.iter().collect();
    let winner = select_weighted_winner(&player_refs, randomness)?;

    // Store the winner
    game_round.winner = winner;
    
    // Transition to finished state
    game_round.status = GameStatus::Finished;

    msg!("Winner selected: {}", winner);
    msg!("Game status updated to Finished");
    
    Ok(())
}

/// Generate verified randomness using commit-reveal pattern
/// In production, this would use Switchboard VRF verification
fn generate_verified_randomness(
    _vrf_account: &Option<AccountInfo>,
    recent_blockhashes: &AccountInfo,
    commit_slot: u64,
    current_slot: u64,
) -> Result<u64> {
    // For simplified VRF implementation, we use a combination of:
    // 1. The commit slot (committed in advance)
    // 2. The current slot (must be later than commit slot)
    // 3. Recent blockhashes for additional entropy
    
    // In a real Switchboard implementation, we would:
    // let vrf_data = VrfAccountData::new(vrf_account)?;
    // let randomness = vrf_data.get_value()?;
    
    // For now, create deterministic but unpredictable randomness
    use anchor_lang::solana_program::keccak;
    
    let mut seed = Vec::new();
    seed.extend_from_slice(&commit_slot.to_le_bytes());
    seed.extend_from_slice(&current_slot.to_le_bytes());
    
    // Use recent blockhash for additional entropy
    let recent_blockhash_data = recent_blockhashes.data.borrow();
    if recent_blockhash_data.len() >= 32 {
        seed.extend_from_slice(&recent_blockhash_data[0..32]);
    }
    
    let hash = keccak::hash(&seed);
    let randomness = u64::from_le_bytes([
        hash.0[0], hash.0[1], hash.0[2], hash.0[3],
        hash.0[4], hash.0[5], hash.0[6], hash.0[7],
    ]);
    
    msg!("Generated randomness from commit_slot: {}, current_slot: {}", 
         commit_slot, current_slot);
    
    Ok(randomness)
}

// Removed for small games MVP:
// /// Select winner from finalists (large game scenario)
// fn select_winner_from_finalists(
//     game_round: &GameRound,
//     randomness: u64,
// ) -> Result<Pubkey> {
//     // For finalist selection, we need to consider their original bet weights
//     let finalist_players: Vec<&PlayerEntry> = game_round.players
//         .iter()
//         .filter(|p| game_round.finalists.contains(&p.wallet))
//         .collect();
//     
//     require!(!finalist_players.is_empty(), Domin8Error::InvalidGameStatus);
//     
//     select_weighted_winner(&finalist_players, randomness)
// }

/// Select winner using weighted random selection based on bet amounts
fn select_weighted_winner(
    players: &[&PlayerEntry], 
    randomness: u64
) -> Result<Pubkey> {
    require!(!players.is_empty(), Domin8Error::InvalidGameStatus);
    
    // If only one player, they're the winner
    if players.len() == 1 {
        return Ok(players[0].wallet);
    }
    
    // Calculate total pot for weight distribution
    let total_pot: u64 = players.iter()
        .map(|p| p.total_bet)
        .try_fold(0u64, |acc, bet| acc.checked_add(bet.into()))
        .ok_or(Domin8Error::MathOverflow)?;
    
    require!(total_pot > 0, Domin8Error::InvalidGameStatus);
    
    // Use randomness to select winner
    let selection_point = randomness % total_pot;
    let mut cumulative_weight = 0u64;
    
    for player in players {
        cumulative_weight = cumulative_weight
            .checked_add(player.total_bet.into())
            .ok_or(Domin8Error::MathOverflow)?;
        
        if selection_point < cumulative_weight {
            msg!("Selected winner: {} (bet: {} lamports, selection_point: {}, cumulative: {})", 
                 player.wallet, player.total_bet, selection_point, cumulative_weight);
            return Ok(player.wallet);
        }
    }
    
    // Fallback to last player (shouldn't happen with correct math)
    Ok(players[players.len() - 1].wallet)
}