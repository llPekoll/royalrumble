use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct InitializeGameFirstTime<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + std::mem::size_of::<Game>(),
        seeds = [b"game"],
        bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn initialize_game_first_time(
    ctx: Context<InitializeGameFirstTime>,
    house_wallet: Pubkey,
) -> Result<()> {
    let mut game = ctx.accounts.game.load_init()?;
    
    // Initialize with default values
    game.game_id = 0;
    game.status = GameStatus::EntryPhase;
    game.game_mode = GameMode::Unknown;
    game.entry_pool = 0;
    game.spectator_pool = 0;
    game.entry_bet_count = 0;
    game.spectator_bet_count = 0;
    game.house_collected = false;
    game.entry_winnings_claimed = false;
    game.last_game_end = 0;
    game.vrf_seed_top_four = None;
    game.vrf_seed_winner = None;
    game.house_wallet = house_wallet;
    game.bump = ctx.bumps.game;
    
    // Initialize arrays to default values
    for i in 0..64 {
        game.entry_bets[i] = 0;
        game.entry_players[i] = Pubkey::default();
        game.spectator_bets[i] = 0;
        game.spectator_players[i] = Pubkey::default();
        game.spectator_targets[i] = -1;
        game.entry_refunded[i] = false;
        game.spectator_refunded[i] = false;
    }
    
    for i in 0..4 {
        game.top_four[i] = -1;
    }
    
    game.winner = -1;
    game.entry_phase_start = 0;
    game.entry_phase_duration = 0;
    game.spectator_phase_start = 0;
    game.spectator_phase_duration = 0;
    
    msg!("Game initialized for the first time with house wallet: {}", house_wallet);
    
    Ok(())
}