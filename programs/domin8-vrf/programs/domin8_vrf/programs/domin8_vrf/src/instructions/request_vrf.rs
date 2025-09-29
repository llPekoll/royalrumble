use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use crate::state::{VrfState, GameSeed};
use crate::errors::VrfError;

#[derive(Accounts)]
#[instruction(game_id: String, round: u8)]
pub struct RequestVrf<'info> {
    #[account(
        mut,
        seeds = [b"vrf_state"],
        bump,
        has_one = authority @ VrfError::Unauthorized
    )]
    pub vrf_state: Account<'info, VrfState>,

    #[account(
        init,
        payer = authority,
        space = 8 + GameSeed::SIZE,
        seeds = [b"game_seed", game_id.as_bytes(), &[round]],
        bump
    )]
    pub game_seed: Account<'info, GameSeed>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: We're reading the RecentBlockhashes sysvar for entropy
    #[account(address = anchor_lang::solana_program::sysvar::recent_blockhashes::ID)]
    pub recent_blockhashes: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RequestVrf>,
    game_id: String,
    round: u8,
) -> Result<()> {
    // Validate round number
    require!(round == 1 || round == 2, VrfError::InvalidRound);

    // Validate game_id length
    require!(
        game_id.len() <= GameSeed::MAX_GAME_ID_LENGTH,
        VrfError::GameIdTooLong
    );

    let vrf_state = &mut ctx.accounts.vrf_state;
    let game_seed = &mut ctx.accounts.game_seed;

    // Generate randomness using multiple entropy sources
    let clock = Clock::get()?;
    let recent_blockhashes = ctx.accounts.recent_blockhashes.data.borrow();

    // Create seed from multiple sources for better randomness
    let seed_components = [
        game_id.as_bytes(),
        &round.to_le_bytes(),
        &clock.unix_timestamp.to_le_bytes(),
        &clock.slot.to_le_bytes(),
        &vrf_state.nonce.to_le_bytes(),
        &recent_blockhashes[..32], // Use first 32 bytes of recent blockhashes
    ];

    // Concatenate all components
    let mut seed_input = Vec::new();
    for component in seed_components.iter() {
        seed_input.extend_from_slice(component);
    }

    // Generate hash for randomness
    let hash = keccak::hash(&seed_input);

    // Store game seed on-chain
    game_seed.game_id = game_id.clone();
    game_seed.round = round;
    game_seed.random_seed = hash.to_bytes();
    game_seed.timestamp = clock.unix_timestamp;
    game_seed.used = false;

    // Increment nonce for next request
    vrf_state.nonce = vrf_state.nonce.wrapping_add(1);

    msg!(
        "VRF generated for game: {}, round: {}, seed: {:?}",
        game_id,
        round,
        hash.to_bytes()
    );

    Ok(())
}