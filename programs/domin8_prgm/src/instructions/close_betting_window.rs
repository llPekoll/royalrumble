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
pub fn close_betting_window(ctx: Context<CloseBettingWindow>) -> Result<()> {
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

    // TODO:why we ask for thatt?
    let bet_count = game_round.bet_count as usize;
    msg!(
        "Closing betting window: game {} with {} bets",
        game_round.round_id,
        bet_count
    );
    msg!("Bets locked - no new bets allowed during resolution");

    // Handle single bet game (refund scenario)
    // TODO: it's not single bet it's singel player close the game directly
    if bet_count == 1 {
        // Single bet - immediate finish
        // Player marked as "winner" so they can claim their full bet back via claim_winnings
        game_round.status = GameStatus::Finished;
        game_round.winning_bet_index = 0;
        // Winner will be set to Pubkey::default() to indicate "refund" (no actual winner)
        game_round.winner = Pubkey::default();

        let refund_amount = game_round.bet_amounts[0];
        msg!(
            "Single bet game - marking for refund: {} lamports",
            refund_amount
        );
        msg!("Player can claim refund via claim_winnings instruction");

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

        msg!("Single bet game - immediate finish, ready for refund claims");
        msg!("Bets unlocked - ready for next round");
        return Ok(());
    }

    // Validate minimum bets for competitive games
    require!(bet_count >= 2, Domin8Error::InvalidGameStatus);

    // Multi-bet game (2+ bets) - VRF was already requested at game creation
    // Just transition to AwaitingWinnerRandomness status
    // No upper limit - unlimited bets supported via dynamic reallocation

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
