use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::rent::Rent;
use anchor_lang::solana_program::sysvar::Sysvar;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::invoke;

use crate::state::*;
use crate::errors::*;

pub mod initialize_game_first_time;
pub mod initialize_game;
pub mod place_entry_bet;
pub mod place_spectator_bet;
pub mod set_top_four;
pub mod set_winner;
pub mod claim_entry_winnings;
pub mod claim_spectator_winnings;
pub mod collect_house_fees;
pub mod cancel_and_refund;
pub mod emergency_withdraw;

pub use initialize_game_first_time::*;
pub use initialize_game::*;
pub use place_entry_bet::*;
pub use place_spectator_bet::*;
pub use set_top_four::*;
pub use set_winner::*;
pub use claim_entry_winnings::*;
pub use claim_spectator_winnings::*;
pub use collect_house_fees::*;
pub use cancel_and_refund::*;
pub use emergency_withdraw::*;

// Helper function to check rent exemption
pub fn check_rent_exemption(account_info: &AccountInfo, amount_to_transfer: u64) -> Result<()> {
    let rent = Rent::get()?;
    let min_rent = rent.minimum_balance(account_info.data_len());
    let current_balance = account_info.lamports();

    require!(
        current_balance >= min_rent.checked_add(amount_to_transfer).ok_or(GameError::ArithmeticOverflow)?,
        GameError::InsufficientFunds
    );

    Ok(())
}

// Helper function to transfer lamports safely
pub fn transfer_lamports(
    from: &AccountInfo,
    to: &AccountInfo,
    amount: u64,
) -> Result<()> {
    check_rent_exemption(from, amount)?;
    
    **from.try_borrow_mut_lamports()? = from.lamports()
        .checked_sub(amount)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    **to.try_borrow_mut_lamports()? = to.lamports()
        .checked_add(amount)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    Ok(())
}