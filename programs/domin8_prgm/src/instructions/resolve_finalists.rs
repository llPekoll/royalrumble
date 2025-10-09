use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameStatus, PlayerEntry};
use crate::constants::*;
use crate::errors::Domin8Error;

#[derive(Accounts)]
pub struct ResolveFinalists<'info> {
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

pub fn resolve_finalists(
    ctx: Context<ResolveFinalists>,
) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    // Validate game state - must be AwaitingFinalistRandomness
    require!(
        game_round.status == GameStatus::AwaitingFinalistRandomness,
        Domin8Error::InvalidGameStatus
    );

    // Validate we have enough players for a large game
    require!(
        game_round.players.len() >= 8,
        Domin8Error::InvalidGameStatus
    );

    // Check that commit slot has elapsed
    let clock = Clock::get()?;
    require!(
        clock.slot >= game_round.randomness_commit_slot,
        Domin8Error::CommitSlotNotElapsed
    );

    // Generate randomness using the commit-reveal pattern
    // In a full Switchboard implementation, we would use VrfAccountData::parse() here
    let randomness = generate_verified_randomness(
        &ctx.accounts.vrf_account,
        &ctx.accounts.recent_blockhashes,
        game_round.randomness_commit_slot,
        clock.slot,
    )?;

    msg!("Generated randomness for finalist selection: {}", randomness);

    // Select 4 finalists using weighted random selection based on bet amounts
    // Convert Vec<PlayerEntry> to Vec<&PlayerEntry> for the function
    let player_refs: Vec<&PlayerEntry> = game_round.players.iter().collect();
    let finalists = select_weighted_finalists(&player_refs, randomness)?;
    
    // Validate we have exactly 4 finalists
    require!(finalists.len() == 4, Domin8Error::InvalidGameStatus);

    // Store finalists
    game_round.finalists = finalists.clone();
    
    // Transition to spectator betting phase
    game_round.status = GameStatus::SpectatorBetting;

    msg!("Selected {} finalists: {:?}", finalists.len(), finalists);
    msg!("Game status updated to SpectatorBetting");
    
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

/// Select 4 finalists using weighted random selection based on bet amounts
fn select_weighted_finalists(
    players: &[&PlayerEntry], 
    randomness: u64
) -> Result<Vec<Pubkey>> {
    require!(players.len() >= 4, Domin8Error::InvalidGameStatus);
    
    // Calculate total pot for weight distribution
    let total_pot: u64 = players.iter()
        .map(|p| p.total_bet)
        .try_fold(0u64, |acc, bet| acc.checked_add(bet.into()))
        .ok_or(Domin8Error::MathOverflow)?;
    
    require!(total_pot > 0, Domin8Error::InvalidGameStatus);
    
    let mut selected_finalists = Vec::new();
    let mut remaining_players: Vec<&PlayerEntry> = players.iter().copied().collect();
    let mut current_randomness = randomness;
    
    // Select 4 finalists with weighted probability
    for i in 0..4 {
        if remaining_players.is_empty() {
            break;
        }
        
        // Calculate total remaining pot
        let remaining_pot: u64 = remaining_players.iter()
            .map(|p| p.total_bet)
            .try_fold(0u64, |acc, bet| acc.checked_add(bet.into()))
            .ok_or(Domin8Error::MathOverflow)?;
        
        // Use current randomness to select from remaining players
        let selection_point = current_randomness % remaining_pot;
        let mut cumulative_weight = 0u64;
        let mut selected_index = 0;
        
        for (idx, player) in remaining_players.iter().enumerate() {
            cumulative_weight = cumulative_weight
                .checked_add(player.total_bet.into())
                .ok_or(Domin8Error::MathOverflow)?;
            
            if selection_point < cumulative_weight {
                selected_index = idx;
                break;
            }
        }
        
        // Add selected player to finalists
        let selected_player = remaining_players.remove(selected_index);
        selected_finalists.push(selected_player.wallet);
        
        // Update randomness for next selection
        current_randomness = current_randomness
            .wrapping_mul(6364136223846793005u64)
            .wrapping_add(1442695040888963407u64);
        
        msg!("Selected finalist {}: {} (bet: {} lamports)", 
             i + 1, selected_player.wallet, selected_player.total_bet);
    }
    
    Ok(selected_finalists)
}