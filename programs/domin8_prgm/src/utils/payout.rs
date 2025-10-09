use anchor_lang::prelude::*;
use crate::state::{GameRound, WinningsEntry};
// Removed SpectatorBet import for small games MVP
use crate::errors::Domin8Error;

/// Payout calculation utilities
pub struct PayoutCalculator;

impl PayoutCalculator {
    /// Calculate house fee from total pot
    pub fn calculate_house_fee(total_pot: u64, house_fee_basis_points: u16) -> u64 {
        (total_pot as u128)
            .saturating_mul(house_fee_basis_points as u128)
            .checked_div(10_000)
            .unwrap_or(0) as u64
    }

    /// Calculate net pot after house fee deduction
    pub fn calculate_net_pot(total_pot: u64, house_fee_basis_points: u16) -> u64 {
        let house_fee = Self::calculate_house_fee(total_pot, house_fee_basis_points);
        total_pot.saturating_sub(house_fee)
    }

    /// Calculate winner payout for small games (winner takes all minus house fee)
    pub fn calculate_small_game_winner_payout(
        game_round: &GameRound,
        house_fee_basis_points: u16,
    ) -> Result<u64> {
        // For small games MVP: all games are small games
        require!(game_round.is_small_game(), Domin8Error::InvalidGameType);
        require!(game_round.winner != Pubkey::default(), Domin8Error::NoWinnerSet);

        let total_pot = game_round.total_pot();
        let net_pot = Self::calculate_net_pot(total_pot, house_fee_basis_points);
        
        Ok(net_pot)
    }

    // Removed for small games MVP:
    // /// Calculate winner and spectator payouts for large games
    // pub fn calculate_large_game_payouts(
    //     game_round: &GameRound,
    //     house_fee_basis_points: u16,
    // ) -> Result<(u64, Vec<WinningsEntry>)> {
    //     require!(game_round.is_large_game(), Domin8Error::InvalidGameType);
    //     require!(game_round.winner != Pubkey::default(), Domin8Error::NoWinnerSet);
    //     require!(!game_round.finalists.is_empty(), Domin8Error::NoFinalistsSet);
    //
    //     // In large games:
    //     // - Winner gets 60% of net pot from initial pot
    //     // - Winning spectators split 40% of net pot plus all spectator pot
    //     
    //     let initial_net_pot = {
    //         let initial_house_fee = Self::calculate_house_fee(game_round.initial_pot, house_fee_basis_points);
    //         game_round.initial_pot.saturating_sub(initial_house_fee)
    //     };
    //
    //     let winner_payout = (initial_net_pot as u128)
    //         .saturating_mul(60)
    //         .checked_div(100)
    //         .unwrap_or(0) as u64;
    //
    //     // Remaining goes to spectators: 40% of initial net pot + all spectator pot
    //     let remaining_initial = initial_net_pot.saturating_sub(winner_payout);
    //     let total_spectator_pool = remaining_initial.saturating_add(game_round.spectator_pot);
    //
    //     // Calculate spectator payouts (pro-rata based on bet amount)
    //     let spectator_payouts = Self::calculate_spectator_payouts(
    //         &game_round.spectator_bets,
    //         &game_round.winner,
    //         total_spectator_pool,
    //     )?;
    //
    //     Ok((winner_payout, spectator_payouts))
    // }

    // /// Calculate pro-rata spectator payouts for winning bets
    // fn calculate_spectator_payouts(
    //     spectator_bets: &[SpectatorBet],
    //     winner: &Pubkey,
    //     total_payout_pool: u64,
    // ) -> Result<Vec<WinningsEntry>> {
    //     // Find all bets on the winner
    //     let winning_bets: Vec<&SpectatorBet> = spectator_bets
    //         .iter()
    //         .filter(|bet| bet.target_finalist == *winner)
    //         .collect();
    //
    //     if winning_bets.is_empty() {
    //         return Ok(vec![]);
    //     }
    //
    //     // Calculate total amount bet on winner
    //     let total_winning_bet_amount: u64 = winning_bets
    //         .iter()
    //         .map(|bet| bet.amount)
    //         .sum();
    //
    //     if total_winning_bet_amount == 0 {
    //         return Ok(vec![]);
    //     }
    //
    //     // Calculate pro-rata payouts
    //     let mut payouts = Vec::new();
    //     for bet in winning_bets {
    //         let payout_ratio = (bet.amount as u128)
    //             .checked_div(total_winning_bet_amount as u128)
    //             .unwrap_or(0);
    //         
    //         let payout_amount = (total_payout_pool as u128)
    //             .saturating_mul(payout_ratio)
    //             .checked_div(1)
    //             .unwrap_or(0) as u64;
    //
    //         if payout_amount > 0 {
    //             payouts.push(WinningsEntry {
    //                 wallet: bet.bettor,
    //                 amount: payout_amount,
    //                 claimed: false,
    //             });
    //         }
    //     }
    //
    //     Ok(payouts)
    // }

    /// Calculate single player refund (full amount minus minimal processing fee)
    pub fn calculate_single_player_refund(
        game_round: &GameRound,
    ) -> Result<u64> {
        require!(game_round.players.len() == 1, Domin8Error::InvalidGameType);
        
        // Return full amount to single player (no house fee for refunds)
        Ok(game_round.initial_pot)
    }

    /// Validate that calculated payouts don't exceed available funds (for small games MVP)
    pub fn validate_payout_amounts(
        winner_payout: u64,
        house_fee: u64,
        total_pot: u64,
    ) -> Result<()> {
        let total_distribution = winner_payout
            .saturating_add(house_fee);

        require!(
            total_distribution <= total_pot,
            Domin8Error::PayoutExceedsAvailableFunds
        );

        Ok(())
    }

    /// Create winnings entries for all participants based on game type (small games MVP)
    pub fn create_winnings_entries(
        game_round: &GameRound,
        house_fee_basis_points: u16,
    ) -> Result<(Vec<WinningsEntry>, u64)> {
        let total_pot = game_round.total_pot();
        let house_fee = Self::calculate_house_fee(total_pot, house_fee_basis_points);

        match game_round.players.len() {
            // Single player refund case
            1 => {
                let refund_amount = Self::calculate_single_player_refund(game_round)?;
                let winner_entries = vec![WinningsEntry {
                    wallet: game_round.players[0].wallet,
                    amount: refund_amount,
                    claimed: false,
                }];
                Ok((winner_entries, 0)) // No house fee for refunds
            },
            // Small game (2+ players) - all games in MVP
            _ => {
                let winner_payout = Self::calculate_small_game_winner_payout(game_round, house_fee_basis_points)?;
                let winner_entries = vec![WinningsEntry {
                    wallet: game_round.winner,
                    amount: winner_payout,
                    claimed: false,
                }];
                
                // Validate total payouts
                Self::validate_payout_amounts(winner_payout, house_fee, total_pot)?;
                
                Ok((winner_entries, house_fee))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_house_fee_calculation() {
        // Test 5% fee (500 basis points)
        assert_eq!(PayoutCalculator::calculate_house_fee(1000, 500), 50);
        assert_eq!(PayoutCalculator::calculate_house_fee(10_000_000, 500), 500_000); // 0.005 SOL from 0.1 SOL
        
        // Test edge cases
        assert_eq!(PayoutCalculator::calculate_house_fee(0, 500), 0);
        assert_eq!(PayoutCalculator::calculate_house_fee(1, 500), 0); // Rounds down
    }

    #[test]
    fn test_net_pot_calculation() {
        assert_eq!(PayoutCalculator::calculate_net_pot(1000, 500), 950);
        assert_eq!(PayoutCalculator::calculate_net_pot(10_000_000, 500), 9_500_000);
    }
}