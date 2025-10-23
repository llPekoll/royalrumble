use crate::constants::{GAME_CONFIG_SEED, GAME_COUNTER_SEED, GAME_ROUND_SEED};
use crate::errors::Domin8Error;
use crate::events::GameLocked;
use crate::state::{GameConfig, GameCounter, GameRound, GameStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseBettingWindow<'info> {
    #[account(
        seeds = [GAME_COUNTER_SEED],
        bump
    )]
    pub counter: Account<'info, GameCounter>,

    #[account(
        mut,
        seeds = [GAME_ROUND_SEED, counter.current_round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game_round: Account<'info, GameRound>,

    #[account(
        mut,
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    /// CHECK: This is the vault PDA that holds game funds
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// The crank authority
    #[account(
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Close betting window and transition game to winner selection phase
///
/// Requires remaining_accounts: All BetEntry PDAs for the game (to count unique players)
pub fn close_betting_window<'info>(ctx: Context<'_, '_, '_, 'info, CloseBettingWindow<'info>>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let game_round = &mut ctx.accounts.game_round;
    let clock = Clock::get()?;

    // Validate game state
    require!(
        game_round.status == GameStatus::Waiting,
        Domin8Error::InvalidGameStatus
    );

    // ⭐ Validate betting window has closed (prevents early progression)
    require!(
        clock.unix_timestamp >= game_round.end_timestamp,
        Domin8Error::BettingWindowStillOpen
    );

    // ⭐ Lock bets to prevent new bets during resolution
    config.bets_locked = true;

    let bet_count = game_round.bet_count as usize;
    msg!(
        "Closing betting window: game {} with {} bets",
        game_round.round_id,
        bet_count
    );
    msg!("Bets locked - no new bets allowed during resolution");

    // ⭐ CRITICAL: Count unique players (not just bet count!)
    // A single player could place multiple bets - we need at least 2 different wallets
    require!(
        ctx.remaining_accounts.len() >= bet_count,
        Domin8Error::InvalidBetEntry
    );

    // Extract unique player wallets from BetEntry accounts
    use crate::state::BetEntry;
    let mut unique_wallets: Vec<Pubkey> = Vec::new();

    for account_info in ctx.remaining_accounts[..bet_count].iter() {
        let bet_entry_data = account_info.try_borrow_data()?;
        let bet_entry = BetEntry::try_deserialize(&mut &bet_entry_data[..])?;

        if !unique_wallets.contains(&bet_entry.wallet) {
            unique_wallets.push(bet_entry.wallet);
        }
    }

    let unique_player_count = unique_wallets.len();
    msg!("Unique players: {} (from {} total bets)", unique_player_count, bet_count);

    // ⭐ Handle single player game (refund scenario)
    // This happens when only ONE unique wallet placed all the bets
    if unique_player_count == 1 {
        // Single player - immediate finish (no competition)
        // Player marked as "winner" so they can claim their full pot back via claim_winner_prize
        game_round.status = GameStatus::Finished;
        game_round.winning_bet_index = 0;
        game_round.winner = unique_wallets[0]; // Set to the actual player wallet for claim

        let total_refund = game_round.total_pot;
        msg!(
            "Single player game - marking for refund: {} lamports (from {} bets)",
            total_refund,
            bet_count
        );
        msg!("Player {} can claim full refund via claim_winner_prize", unique_wallets[0]);

        // ⭐ Rotate force field for next game (same logic as select_winner_and_payout)
        let clock = Clock::get()?;
        let mut new_force = [0u8; 32];

        // Use hashv directly with multiple slices (no concat needed)
        use anchor_lang::solana_program::keccak::hashv;
        let hash = hashv(&[
            &game_round.round_id.to_le_bytes(),
            &clock.unix_timestamp.to_le_bytes(),
            &clock.slot.to_le_bytes(),
            &config.force,
        ]);
        new_force.copy_from_slice(&hash.0);
        config.force = new_force;

        msg!("New VRF force for next game: {:?}", &new_force[0..16]);

        // ⭐ IMPORTANT: Unlock bets immediately for single-bet refunds (no winner selection needed)
        config.bets_locked = false;

        msg!("Single player game - immediate finish, ready for refund claim");
        msg!("Bets unlocked - ready for next round");
        return Ok(());
    }

    // Validate minimum unique players for competitive games (need at least 2 different wallets)
    require!(unique_player_count >= 2, Domin8Error::InvalidGameStatus);

    // Multi-player game (2+ unique players) - VRF was already requested at game creation
    // Just transition to AwaitingWinnerRandomness status
    // Multiple bets per player allowed - winner selected based on total bet amounts

    // Verify VRF was requested during game creation
    require!(
        game_round.vrf_request_pubkey != Pubkey::default(),
        Domin8Error::InvalidVrfAccount
    );

    // Update game state to AwaitingWinnerRandomness
    game_round.status = GameStatus::AwaitingWinnerRandomness;

    msg!(
        "Game {} now awaiting winner randomness - VRF already requested at game creation",
        game_round.round_id
    );
    msg!("VRF Request: {}", game_round.vrf_request_pubkey);

    // ⭐ Emit game locked event
    emit!(GameLocked {
        round_id: game_round.round_id,
        final_bet_count: game_round.bet_count as u8,
        total_pot: game_round.total_pot,
        vrf_request_pubkey: game_round.vrf_request_pubkey,
    });

    Ok(())
}
