use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{GameConfig, GameRound, WinningsClaim, GameStatus};
use crate::constants::{VAULT_SEED, GAME_CONFIG_SEED, GAME_ROUND_SEED};
use crate::utils::PayoutCalculator;
use crate::errors::Domin8Error;

#[derive(Accounts)]
pub struct DistributeWinnings<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [GAME_ROUND_SEED],
        bump,
        constraint = game_round.status == GameStatus::Finished @ Domin8Error::InvalidGameStatus
    )]
    pub game_round: Account<'info, GameRound>,

    #[account(
        init,
        payer = crank,
        space = WinningsClaim::LEN,
        seeds = [b"winnings", game_round.round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub winnings_claim: Account<'info, WinningsClaim>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        address = game_config.treasury @ Domin8Error::Unauthorized
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        mut,
        address = game_round.winner @ Domin8Error::NoWinnerSet
    )]
    pub winner: SystemAccount<'info>,

    #[account(
        mut,
        address = game_config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn distribute_winnings_and_reset(
    ctx: Context<DistributeWinnings>,
) -> Result<()> {
    let game_config = &ctx.accounts.game_config;
    let game_round = &mut ctx.accounts.game_round;
    let winnings_claim = &mut ctx.accounts.winnings_claim;
    let vault = &ctx.accounts.vault;
    let treasury = &ctx.accounts.treasury;

    // Ensure game is finished and winner is determined
    require!(
        game_round.status == GameStatus::Finished,
        Domin8Error::InvalidGameStatus
    );
    require!(
        game_round.winner != Pubkey::default(),
        Domin8Error::NoWinnerSet
    );

    // Calculate all winnings entries (small games MVP)
    let (winner_winnings, house_fee) = PayoutCalculator::create_winnings_entries(
        game_round,
        game_config.house_fee_basis_points,
    )?;

    // Verify vault has sufficient funds for all payouts
    let total_payouts: u64 = winner_winnings.iter().map(|e| e.amount).sum::<u64>()
        + house_fee;

    require!(
        vault.lamports() >= total_payouts,
        Domin8Error::InsufficientFunds
    );

    // Initialize winnings claim account
    winnings_claim.round_id = game_round.round_id;
    winnings_claim.house_fee_collected = false;
    winnings_claim.game_reset = false;
    winnings_claim.winner_winnings = winner_winnings;
    winnings_claim.spectator_winnings = vec![]; // Empty for small games MVP
    winnings_claim.total_winner_amount = winnings_claim.winner_winnings.iter().map(|e| e.amount).sum();
    winnings_claim.total_spectator_amount = 0; // Zero for small games MVP
    winnings_claim.house_fee_amount = house_fee;

    // Transfer house fee to treasury if there is one
    if house_fee > 0 {
        let vault_bump = ctx.bumps.vault;
        let seeds = &[VAULT_SEED, &[vault_bump]];
        let signer_seeds = &[&seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: vault.to_account_info(),
                    to: treasury.to_account_info(),
                },
                signer_seeds,
            ),
            house_fee,
        )?;

        winnings_claim.house_fee_collected = true;
        msg!("House fee transferred: {} lamports", house_fee);
    }

    // Transfer total winner amount to the winner (game_round.winner)
    if winnings_claim.total_winner_amount > 0 {
        let vault_bump = ctx.bumps.vault;
        let seeds = &[VAULT_SEED, &[vault_bump]];
        let signer_seeds = &[&seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: vault.to_account_info(),
                    to: ctx.accounts.winner.to_account_info(),
                },
                signer_seeds,
            ),
            winnings_claim.total_winner_amount,
        )?;

        // Mark all winner winnings as claimed since we paid directly
        for entry in &mut winnings_claim.winner_winnings {
            entry.claimed = true;
        }

        msg!(
            "Total winner amount {} lamports transferred to winner {}",
            winnings_claim.total_winner_amount,
            ctx.accounts.winner.key()
        );
    }


    // Reset game state for next round (small games MVP)
    game_round.round_id = game_round.round_id.saturating_add(1);
    game_round.status = GameStatus::Idle;
    game_round.start_timestamp = 0;
    game_round.players.clear();
    // game_round.finalists.clear(); // Removed for small games MVP
    // game_round.spectator_bets.clear(); // Removed for small games MVP
    game_round.initial_pot = 0;
    // game_round.spectator_pot = 0; // Removed for small games MVP
    game_round.winner = Pubkey::default();
    // game_round.finalist_randomness_account = Pubkey::default(); // Removed for small games MVP
    game_round.winner_randomness_account = Pubkey::default();
    game_round.randomness_commit_slot = 0;

    winnings_claim.game_reset = true;

    msg!(
        "Game round {} completed. Winnings distributed: {} winner entries, 0 spectator entries, {} house fee",
        winnings_claim.round_id,
        winnings_claim.winner_winnings.len(),
        house_fee
    );

    msg!("Game reset to round {}", game_round.round_id);

    Ok(())
}