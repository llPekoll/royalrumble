use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::rent::Rent;
use anchor_lang::solana_program::sysvar::Sysvar;

pub mod state;
pub mod errors;
pub mod instructions;

use state::*;
use errors::*;
use instructions::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod betting_game {
    use super::*;

    pub fn initialize_game_first_time(
        ctx: Context<InitializeGameFirstTime>,
        house_wallet: Pubkey,
    ) -> Result<()> {
        instructions::initialize_game_first_time(ctx, house_wallet)
    }

    pub fn initialize_game(ctx: Context<InitializeGame>) -> Result<()> {
        instructions::initialize_game(ctx)
    }

    pub fn place_entry_bet(ctx: Context<PlaceEntryBet>, amount: u64) -> Result<()> {
        instructions::place_entry_bet(ctx, amount)
    }

    pub fn place_spectator_bet(
        ctx: Context<PlaceSpectatorBet>,
        amount: u64,
        target: i8,
    ) -> Result<()> {
        instructions::place_spectator_bet(ctx, amount, target)
    }

    pub fn set_top_four(
        ctx: Context<SetTopFour>,
        top_four_positions: [i8; 4],
    ) -> Result<()> {
        instructions::set_top_four(ctx, top_four_positions)
    }

    pub fn set_winner(ctx: Context<SetWinner>, winner_position: i8) -> Result<()> {
        instructions::set_winner(ctx, winner_position)
    }

    pub fn claim_entry_winnings(ctx: Context<ClaimEntryWinnings>) -> Result<()> {
        instructions::claim_entry_winnings(ctx)
    }

    pub fn claim_spectator_winnings(ctx: Context<ClaimSpectatorWinnings>) -> Result<()> {
        instructions::claim_spectator_winnings(ctx)
    }

    pub fn collect_house_fees(ctx: Context<CollectHouseFees>) -> Result<()> {
        instructions::collect_house_fees(ctx)
    }

    pub fn cancel_and_refund(ctx: Context<CancelAndRefund>, player: Pubkey) -> Result<()> {
        instructions::cancel_and_refund(ctx, player)
    }

    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        instructions::emergency_withdraw(ctx)
    }
}