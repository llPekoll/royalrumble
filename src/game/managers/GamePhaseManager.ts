import { Scene } from 'phaser';
import { PlayerManager } from './PlayerManager';
import { AnimationManager } from './AnimationManager';

export class GamePhaseManager {
    private scene: Scene;
    private playerManager: PlayerManager;
    private animationManager: AnimationManager;

    constructor(scene: Scene, playerManager: PlayerManager, animationManager: AnimationManager) {
        this.scene = scene;
        this.playerManager = playerManager;
        this.animationManager = animationManager;
    }

    handleGamePhase(gameState: any) {
        if (!gameState) return;

        // Reset used angles when starting a new game
        if (gameState.status === 'waiting' && this.playerManager.getPlayers().size === 0) {
            this.playerManager.resetUsedAngles();
        }

        // Update players based on game phase
        switch (gameState.status) {
            case 'waiting':
                this.handleWaitingPhase(gameState.participants || []);
                break;
            case 'arena':
                this.handleArenaPhase();
                break;
            case 'betting':
                this.handleBettingPhase(gameState.participants?.filter((p: any) => !p.eliminated) || []);
                break;
            case 'battle':
                this.handleBattlePhase();
                break;
            case 'results':
                this.handleResultsPhase(gameState);
                break;
        }
    }

    private handleWaitingPhase(participants: any[]) {
        this.playerManager.updatePlayersInWaiting(participants);
    }

    private handleArenaPhase() {
        this.playerManager.movePlayersToCenter();

        // Schedule explosions 6 seconds before the arena phase ends
        // Arena phase is 10 seconds, so trigger at 4 seconds (4000ms)
        this.scene.time.delayedCall(4000, () => {
            this.animationManager.createExplosionsSequence();
        });
    }

    private handleBettingPhase(survivors: any[]) {
        this.playerManager.showTop4Players(survivors);
    }

    private handleBattlePhase() {
        this.playerManager.showBattlePhase();
    }

    private handleResultsPhase(gameState: any) {
        const winnerPlayer = this.playerManager.showResults(gameState);
        
        if (winnerPlayer) {
            const winner = gameState.participants?.find((p: any) => p._id === gameState.winnerId);
            if (winner) {
                // Add celebration after the winner is positioned
                this.scene.time.delayedCall(1000, () => {
                    this.animationManager.addWinnerCelebration(winnerPlayer, winner);
                });
            }
        }
    }
}