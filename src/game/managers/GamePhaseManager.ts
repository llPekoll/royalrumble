import { Scene } from 'phaser';
import { PlayerManager } from './PlayerManager';
import { AnimationManager } from './AnimationManager';

export class GamePhaseManager {
  private scene: Scene;
  private playerManager: PlayerManager;
  private animationManager: AnimationManager;
  private currentPhase: string = '';
  private isSmallGame: boolean = false;

  constructor(scene: Scene, playerManager: PlayerManager, animationManager: AnimationManager) {
    this.scene = scene;
    this.playerManager = playerManager;
    this.animationManager = animationManager;
  }

  handleGamePhase(gameState: any) {
    if (!gameState) return;

    const participants = gameState.participants || [];
    this.isSmallGame = gameState.isSmallGame || participants.length < 8;

    // Check if phase changed
    const phaseChanged = this.currentPhase !== gameState.status;
    this.currentPhase = gameState.status;

    // Update participants based on game phase
    switch (gameState.status) {
      case 'waiting':
        this.handleWaitingPhase(participants, gameState.map);
        break;
      case 'selection':
        this.handleSelectionPhase();
        break;
      case 'arena':
        this.handleArenaPhase(phaseChanged);
        break;
      case 'elimination':
        this.handleEliminationPhase(phaseChanged);
        break;
      case 'betting':
        this.handleBettingPhase(gameState.survivorIds || [], phaseChanged);
        break;
      case 'battle':
        this.handleBattlePhase(phaseChanged);
        break;
      case 'results':
        this.handleResultsPhase(gameState, phaseChanged);
        break;
      case 'completed':
        this.handleCompletedPhase();
        break;
    }
  }

  private handleWaitingPhase(participants: any[], mapData: any) {
    // Clear previous game participants if this is a fresh game
    if (participants.length === 0) {
      this.playerManager.clearParticipants();
    }

    this.playerManager.updateParticipantsInWaiting(participants, mapData);
  }

  private handleSelectionPhase() {
    // Selection phase only occurs in large games
    // Show confirmation UI for character selection
    // This is mainly handled by React UI, but we can add visual effects here

    // Highlight all participants to show they're in selection mode
    this.playerManager.getParticipants().forEach(participant => {
      if (!participant.isBot) {
        // Add subtle glow to human participants
        this.scene.tweens.add({
          targets: participant.container,
          alpha: { from: 1, to: 0.8 },
          duration: 800,
          yoyo: true,
          repeat: -1
        });
      }
    });
  }

  private handleArenaPhase(phaseChanged: boolean) {
    if (phaseChanged) {
      // Stop selection phase effects
      this.scene.tweens.killTweensOf(this.playerManager.getParticipants());

      // Move all participants toward center
      this.playerManager.moveParticipantsToCenter();

      if (this.isSmallGame) {
        // Small games: no elimination, prepare for direct results
        // Schedule winner determination near end of arena phase
        this.scene.time.delayedCall(1000, () => {
          this.animationManager.createCenterExplosion();
        });
      } else {
        // Large games: prepare for elimination
        // Schedule explosions before elimination phase
        this.scene.time.delayedCall(1500, () => {
          this.animationManager.createExplosionsSequence();
        });
      }
    }
  }

  private handleEliminationPhase(phaseChanged: boolean) {
    if (phaseChanged) {
      // This phase only occurs in large games
      // Visual elimination effects are handled by explosions from arena phase
      // The actual elimination logic is in the backend

      // Add dramatic effect
      this.animationManager.createCenterExplosion();

      // Add screen shake
      this.scene.cameras.main.shake(500, 0.02);
    }
  }

  private handleBettingPhase(survivorIds: string[], phaseChanged: boolean) {
    if (phaseChanged) {
      // Show the survivors (top 4) and fade out eliminated participants
      this.playerManager.showSurvivors(survivorIds);

      // Add UI prompt for spectator betting (handled by React)
      this.animationManager.showBettingPrompt();
    }
  }

  private handleBattlePhase(phaseChanged: boolean) {
    if (phaseChanged) {
      // Animate battle between surviving participants
      this.playerManager.showBattlePhase();

      // Create battle effects
      this.animationManager.createBattleEffects();

      // Schedule final explosion before results
      this.scene.time.delayedCall(12000, () => {
        this.animationManager.createFinalExplosion();
      });
    }
  }

  private handleResultsPhase(gameState: any, phaseChanged: boolean) {
    if (phaseChanged) {
      // Show the winner and celebration
      const winnerParticipant = this.playerManager.showResults(gameState);

      if (winnerParticipant) {
        const winner = gameState.participants?.find((p: any) => p._id === gameState.winnerId);
        if (winner) {
          // Add celebration after the winner is positioned
          this.scene.time.delayedCall(1000, () => {
            this.animationManager.addWinnerCelebration(winnerParticipant, winner);
          });
        }
      }
    }
  }

  private handleCompletedPhase() {
    // Game is completed, prepare for next game
    // Clear all effects and reset state
    this.scene.tweens.killAll();
    this.scene.time.removeAllEvents();

    // Fade out all participants
    this.playerManager.getParticipants().forEach(participant => {
      this.scene.tweens.add({
        targets: participant.container,
        alpha: 0,
        duration: 2000,
        onComplete: () => {
          participant.container.setVisible(false);
        }
      });
    });

    // Clear participants after fade
    this.scene.time.delayedCall(2000, () => {
      this.playerManager.clearParticipants();
    });
  }

  // Helper method to check if current game is small
  isCurrentGameSmall(): boolean {
    return this.isSmallGame;
  }

  // Helper method to get current phase
  getCurrentPhase(): string {
    return this.currentPhase;
  }

  // Reset manager state for new game
  reset() {
    this.currentPhase = '';
    this.isSmallGame = false;
    this.scene.tweens.killAll();
    this.scene.time.removeAllEvents();
    this.playerManager.clearParticipants();
  }
}
