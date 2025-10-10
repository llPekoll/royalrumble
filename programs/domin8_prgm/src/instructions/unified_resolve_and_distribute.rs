use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameStatus, PlayerEntry};
use crate::errors::Domin8Error;
use crate::constants::{GAME_ROUND_SEED, GAME_CONFIG_SEED};

#[derive(Accounts)]
pub struct UnifiedResolveAndDistribute<'info> {
    #[account(
        mut,
        seeds = [GAME_ROUND_SEED],
        bump
    )]
    pub game_round: Account<'info, GameRound>,
    
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,
    
    /// The crank authority
    #[account(
        mut,
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,
    
    /// VRF Request Account containing fulfilled randomness
    /// CHECK: This account was created by ORAO VRF program
    pub vrf_request: AccountInfo<'info>,
    
    /// Treasury account for receiving house fees
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ Domin8Error::InvalidTreasury
    )]
    pub treasury: SystemAccount<'info>,
    
    /// Winner's account (to be determined from VRF)
    /// CHECK: Winner will be validated against game participants
    #[account(mut)]
    pub winner_account: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

/// UNIFIED INSTRUCTION: Resolve winner using ORAO VRF and immediately distribute winnings
/// This replaces the old resolve_winner + distribute_winnings flow
pub fn unified_resolve_and_distribute(ctx: Context<UnifiedResolveAndDistribute>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    require!(
        game_round.status == GameStatus::AwaitingWinnerRandomness,
        Domin8Error::InvalidGameStatus
    );
    
    require!(
        ctx.accounts.vrf_request.key() == game_round.vrf_request_pubkey,
        Domin8Error::InvalidVrfAccount
    );
    
    // 1. READ RANDOMNESS FROM ORAO VRF
    let randomness = read_orao_randomness(&ctx.accounts.vrf_request)?;
    msg!("Retrieved ORAO VRF randomness: {}", randomness);
    
    // 2. SELECT WINNER USING VERIFIED RANDOMNESS
    require!(
        game_round.players.len() >= 2,
        Domin8Error::InvalidGameStatus
    );
    
    let player_refs: Vec<&PlayerEntry> = game_round.players.iter().collect();
    let winner_wallet = select_weighted_winner(&player_refs, randomness)?;
    
    // Validate winner account matches the selected winner
    require!(
        ctx.accounts.winner_account.key() == winner_wallet,
        Domin8Error::InvalidWinnerAccount
    );
    
    game_round.winner = winner_wallet;
    msg!("Winner selected: {}", winner_wallet);
    
    // 3. CALCULATE AND DISTRIBUTE WINNINGS IMMEDIATELY
    let total_pot = game_round.initial_pot;
    let house_fee = (total_pot as u128 * ctx.accounts.config.house_fee_basis_points as u128 / 10000) as u64;
    let winner_payout = total_pot.saturating_sub(house_fee);
    
    msg!("Distributing: {} to winner, {} to house", winner_payout, house_fee);
    
    // Transfer to winner
    if winner_payout > 0 {
        **ctx.accounts.crank.to_account_info().try_borrow_mut_lamports()? -= winner_payout;
        **ctx.accounts.winner_account.try_borrow_mut_lamports()? += winner_payout;
    }
    
    // Transfer house fee to treasury
    if house_fee > 0 {
        **ctx.accounts.crank.to_account_info().try_borrow_mut_lamports()? -= house_fee;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += house_fee;
    }
    
    // 4. RESET GAME STATE FOR NEXT ROUND
    game_round.status = GameStatus::Idle;
    game_round.randomness_fulfilled = true;
    game_round.round_id += 1; // Increment for next game
    game_round.players.clear();
    game_round.initial_pot = 0;
    game_round.start_timestamp = 0;
    
    msg!("Game {} completed and reset - ready for round {}", game_round.round_id - 1, game_round.round_id);
    
    Ok(())
}

fn read_orao_randomness(vrf_account: &AccountInfo) -> Result<u64> {
    // Read fulfilled randomness from ORAO VRF account
    let data = vrf_account.data.borrow();
    
    // ORAO VRF account structure - randomness is at offset 8+32 = 40
    require!(data.len() >= 40 + 8, Domin8Error::InvalidVrfAccount);
    
    // Check if randomness is fulfilled (flag at offset 8+32+8 = 48)
    let fulfilled = data[48] != 0;
    require!(fulfilled, Domin8Error::RandomnessNotFulfilled);
    
    // Read 8-byte randomness value
    let randomness_bytes: [u8; 8] = data[40..48].try_into()
        .map_err(|_| Domin8Error::InvalidVrfAccount)?;
    
    Ok(u64::from_le_bytes(randomness_bytes))
}

/// Select winner weighted by bet amounts
fn select_weighted_winner(players: &[&PlayerEntry], randomness: u64) -> Result<Pubkey> {
    if players.is_empty() {
        return Err(Domin8Error::NoPlayers.into());
    }
    
    // Calculate total weight
    let total_weight: u64 = players.iter().map(|p| p.bet_amount).sum();
    
    if total_weight == 0 {
        return Err(Domin8Error::InvalidBetAmount.into());
    }
    
    // Use randomness to select a position in the weight range
    let selection = randomness % total_weight;
    
    // Find winner based on cumulative weights
    let mut cumulative = 0u64;
    for player in players {
        cumulative = cumulative.saturating_add(player.bet_amount);
        if selection < cumulative {
            return Ok(player.wallet);
        }
    }
    
    // Fallback to last player (should never reach here)
    Ok(players.last().unwrap().wallet)
}