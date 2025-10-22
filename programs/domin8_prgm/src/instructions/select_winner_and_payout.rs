use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameCounter, GameStatus, BetEntry};
use crate::errors::Domin8Error;
use crate::constants::{GAME_ROUND_SEED, GAME_CONFIG_SEED, GAME_COUNTER_SEED, VAULT_SEED};
use crate::events::{WinnerSelected, GameReset};
use orao_solana_vrf::state::RandomnessAccountData;

#[derive(Accounts)]
pub struct SelectWinnerAndPayout<'info> {
    #[account(
        mut,
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
    
    /// The vault PDA that holds game funds
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: SystemAccount<'info>,
    
    /// The crank authority
    #[account(
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
    
    pub system_program: Program<'info, System>,
}

/// Select winner using VRF randomness and distribute payouts
pub fn select_winner_and_payout<'info>(ctx: Context<'_, '_, '_, 'info, SelectWinnerAndPayout<'info>>) -> Result<()> {
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
        game_round.bet_count >= 2,
        Domin8Error::InvalidGameStatus
    );

    // Select winning bet index using only bet amounts
    let winning_bet_index = select_weighted_winner_index(
        &game_round.bet_amounts,
        game_round.bet_count as usize,
        randomness
    )?;

    game_round.winning_bet_index = winning_bet_index as u32;

    // Get winner wallet from remaining_accounts (player wallet accounts passed from backend)
    require!(
        ctx.remaining_accounts.len() >= game_round.bet_count as usize,
        Domin8Error::InvalidBetEntry
    );

    let winner_wallet_account = &ctx.remaining_accounts[winning_bet_index];
    let winner_wallet = winner_wallet_account.key();
    game_round.winner = winner_wallet;

    msg!("Winner selected: Bet #{} - Wallet: {}", winning_bet_index, winner_wallet);

    // 3. CALCULATE WINNINGS
    let total_pot = game_round.total_pot;
    let house_fee = (total_pot as u128)
        .checked_mul(ctx.accounts.config.house_fee_basis_points as u128)
        .ok_or(Domin8Error::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(Domin8Error::ArithmeticOverflow)? as u64;
    let winner_payout = total_pot.saturating_sub(house_fee);
    
    msg!("Distributing: {} to winner, {} to house", winner_payout, house_fee);

    // 4. DISTRIBUTE WINNINGS
    // Use system program transfer with PDA signing
    let vault_bump = ctx.bumps.vault;
    let signer_seeds: &[&[&[u8]]] = &[&[
        VAULT_SEED,
        &[vault_bump],
    ]];

    // Transfer winner payout using invoke_signed
    if winner_payout > 0 {
        let vault_lamports = ctx.accounts.vault.lamports();
        require!(
            vault_lamports >= winner_payout,
            Domin8Error::InsufficientFunds
        );

        // Use invoke_signed for PDA signing
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.vault.key(),
            &winner_wallet,
            winner_payout,
        );

        anchor_lang::solana_program::program::invoke_signed(
            &transfer_ix,
            &[
                ctx.accounts.vault.to_account_info(),
                winner_wallet_account.clone(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        msg!("Transferred {} lamports to winner {}", winner_payout, winner_wallet);
    }

    // Transfer house fee to treasury
    if house_fee > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
                signer_seeds,
            ),
            house_fee,
        )?;
    }
    
    // 5. MARK GAME AS FINISHED
    game_round.status = GameStatus::Finished;
    msg!("Game status updated to Finished");

    // 6. EMIT WINNER SELECTED EVENT
    emit!(WinnerSelected {
        round_id: game_round.round_id,
        winner: winner_wallet,
        winning_bet_index: winning_bet_index as u32,
        total_pot,
        house_fee,
        winner_payout,
    });

    // 7. INCREMENT COUNTER FOR NEXT GAME
    let counter = &mut ctx.accounts.counter;
    let new_round_id = counter.current_round_id
        .checked_add(1)
        .ok_or(Domin8Error::ArithmeticOverflow)?;
    counter.current_round_id = new_round_id;

    // 8. ROTATE FORCE FIELD FOR NEXT GAME (prevents VRF account collisions)
    let config = &mut ctx.accounts.config;
    let clock = Clock::get()?;
    let mut new_force = [0u8; 32];
    let seed_data = [
        &randomness.to_le_bytes()[..],
        &clock.slot.to_le_bytes()[..],
        &clock.unix_timestamp.to_le_bytes()[..],
    ].concat();

    // Hash to get new force
    use anchor_lang::solana_program::keccak::hashv;
    let hash = hashv(&[&seed_data]);
    new_force.copy_from_slice(&hash.0);
    config.force = new_force;

    msg!("New VRF force for next game: {:?}", &new_force[0..16]);

    // 9. UNLOCK BETS FOR NEXT GAME
    config.bets_locked = false;

    msg!("✓ Game {} completed successfully", game_round.round_id);
    msg!("✓ Winner: {} - Prize: {} lamports", winner_wallet, winner_payout);
    msg!("✓ House fee: {} lamports", house_fee);
    msg!("✓ Counter incremented to {}", new_round_id);
    msg!("✓ Bets unlocked for next round");

    // GameRound account remains for historical record
    // Use cleanup_old_game instruction to close it after 1 week

    Ok(())
}

fn read_orao_randomness(vrf_account: &AccountInfo) -> Result<u64> {
    // Use ORAO SDK to properly deserialize the VRF account
    let mut data = &vrf_account.try_borrow_data()?[..];
    let vrf_state = RandomnessAccountData::try_deserialize(&mut data)
        .map_err(|_| Domin8Error::InvalidVrfAccount)?;

    // Get fulfilled randomness (returns [u8; 64])
    let rnd64 = vrf_state
        .fulfilled_randomness()
        .ok_or(Domin8Error::RandomnessNotFulfilled)?;

    // Use first 8 bytes as u64
    let randomness = u64::from_le_bytes(rnd64[0..8].try_into().unwrap());

    Ok(randomness)
}

/// Select winner index weighted by bet amounts
/// Returns winning_bet_index
fn select_weighted_winner_index(
    bet_amounts: &[u64; 64],
    bet_count: usize,
    randomness: u64
) -> Result<usize> {
    if bet_count == 0 {
        return Err(Domin8Error::NoPlayers.into());
    }

    // Calculate total weight from active bets only
    let total_weight: u64 = bet_amounts[..bet_count].iter().sum();

    if total_weight == 0 {
        return Err(Domin8Error::InvalidBetAmount.into());
    }

    // Use randomness to select a position in the weight range
    let selection = randomness % total_weight;

    // Find winner based on cumulative weights
    let mut cumulative = 0u64;
    for index in 0..bet_count {
        cumulative = cumulative.saturating_add(bet_amounts[index]);
        if selection < cumulative {
            return Ok(index);
        }
    }

    // Fallback to last bet (should never reach here)
    Ok(bet_count - 1)
}

