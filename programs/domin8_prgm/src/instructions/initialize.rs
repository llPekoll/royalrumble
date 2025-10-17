use anchor_lang::prelude::*;
use crate::state::{GameConfig, GameCounter, GameDurationConfig};
use crate::constants::*;
use crate::events::GameInitialized;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = GameConfig::LEN,
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    #[account(
        init,
        payer = authority,
        space = GameCounter::LEN,
        seeds = [GAME_COUNTER_SEED],
        bump
    )]
    pub counter: Account<'info, GameCounter>,

    /// CHECK: This is the vault PDA that will hold game funds
    #[account(
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(
    ctx: Context<Initialize>,
    treasury: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let counter = &mut ctx.accounts.counter;

    // Initialize game configuration
    config.authority = ctx.accounts.authority.key();
    config.treasury = treasury;
    config.house_fee_basis_points = HOUSE_FEE_BASIS_POINTS;
    config.min_bet_lamports = MIN_BET_LAMPORTS;

    // Set default durations for small games
    config.small_game_duration_config = GameDurationConfig {
        waiting_phase_duration: DEFAULT_SMALL_GAME_WAITING_DURATION,
    };

    // Initialize game control flags
    config.game_locked = false;  // Start unlocked

    // Initialize counter at 0
    counter.current_round_id = 0;

    msg!("Domin8 game initialized with authority: {}", ctx.accounts.authority.key());
    msg!("Game counter initialized at round 0");

    // Emit initialization event
    emit!(GameInitialized {
        round_id: 0,
        start_timestamp: 0,
        end_timestamp: 0,
    });

    Ok(())
}