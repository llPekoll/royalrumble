import { Scene } from "phaser";
import { PlayerManager } from "./PlayerManager";
import { AnimationManager } from "./AnimationManager";

export class GamePhaseManager {
  private scene: Scene;
  private playerManager: PlayerManager;
  private animationManager: AnimationManager;
  private currentPhase: string = "";
  private isSmallGame: boolean = false;
  private hasWinner: boolean = false;

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

    // Update participants with latest data from backend (elimination status, etc.)
    if (gameState.status !== "waiting") {
      this.playerManager.updateParticipants(participants);
    }

    // Check if blockchain call completed for small games during arena phase
    // ⭐ SECURITY: Only show winner animation if:
    // 1. Betting window has closed (now > endTimestamp)
    // 2. Winner has been determined (winnerId exists)
    // 3. Blockchain call is completed
    const now = Date.now();
    const bettingWindowClosed = gameState.endTimestamp ? now > gameState.endTimestamp : false;
    const hasWinner = !!gameState.winnerId;
    const blockchainCallCompleted = gameState.blockchainCallStatus === "completed";

    const blockchainCallJustCompleted = blockchainCallCompleted && !this.hasWinner;
    const canShowWinnerAnimation = bettingWindowClosed && hasWinner && blockchainCallCompleted;

    if (
      blockchainCallJustCompleted &&
      this.isSmallGame &&
      gameState.status === "arena" &&
      canShowWinnerAnimation
    ) {
      console.log("✅ Conditions met for winner animation:");
      console.log(
        "  - Betting window closed:",
        bettingWindowClosed,
        `(now: ${now}, end: ${gameState.endTimestamp})`
      );
      console.log("  - Winner determined:", gameState.winnerId);
      console.log("  - Blockchain call completed");

      this.hasWinner = true;
      // Trigger explosion after a short delay
      this.scene.time.delayedCall(500, () => {
        const participants = this.playerManager.getParticipants();
        this.animationManager.explodeParticipantsOutward(participants);
      });
    } else if (blockchainCallJustCompleted && (!bettingWindowClosed || !hasWinner)) {
      // Log why animation is blocked
      console.log("⏳ Winner animation blocked - waiting for:");
      if (!bettingWindowClosed)
        console.log(
          "  - Betting window to close (remaining:",
          (gameState.endTimestamp - now) / 1000,
          "seconds)"
        );
      if (!hasWinner) console.log("  - Winner to be determined");
    }

    // Update hasWinner flag
    this.hasWinner = !!gameState.winnerId;

    // Update participants based on game phase
    switch (gameState.status) {
      case "waiting":
        this.handleWaitingPhase(participants, gameState.map);
        break;
      case "selection":
        this.handleSelectionPhase();
        break;
      case "arena":
        this.handleArenaPhase(phaseChanged);
        break;
      case "elimination":
        this.handleEliminationPhase(phaseChanged);
        break;
      case "betting":
        this.handleBettingPhase(gameState.survivorIds || [], phaseChanged);
        break;
      case "battle":
        this.handleBattlePhase(phaseChanged);
        break;
      case "results":
        this.handleResultsPhase(gameState, phaseChanged);
        break;
      case "completed":
        this.handleCompletedPhase();
        break;
    }
  }

  private handleWaitingPhase(participants: any[], mapData: any) {
    // Clear previous game participants if this is a fresh game
    if (participants.length === 0) {
      this.playerManager.clearParticipants();
    }

    // Reset winner flag for new game
    this.hasWinner = false;

    this.playerManager.updateParticipantsInWaiting(participants, mapData);
  }

  private handleSelectionPhase() {
    // Selection phase only occurs in large games
    // Show confirmation UI for character selection
    // This is mainly handled by React UI, but we can add visual effects here

    // Highlight all participants to show they're in selection mode
    this.playerManager.getParticipants().forEach((participant) => {
      if (!participant.isBot) {
        // Add subtle glow to human participants
        this.scene.tweens.add({
          targets: participant.container,
          alpha: { from: 1, to: 0.8 },
          duration: 800,
          yoyo: true,
          repeat: -1,
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
        // Small games: start blockchain call after players move to center
        console.log("Small game: starting blockchain call after players move...");

        // Trigger blockchain call after 2.5 seconds (after players finish moving)
        this.scene.time.delayedCall(2500, () => {
          // Emit event to trigger blockchain call
          // This will be handled by the App component
          this.scene.events.emit("triggerBlockchainCall");
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
      // ⭐ SECURITY: Verify betting window closed and winner exists before showing results
      const now = Date.now();
      const bettingWindowClosed = gameState.endTimestamp ? now > gameState.endTimestamp : false;
      const hasWinner = !!gameState.winnerId;

      if (!bettingWindowClosed || !hasWinner) {
        console.log("⚠️ Cannot show results - conditions not met:");
        if (!bettingWindowClosed) console.log("  - Betting window still open");
        if (!hasWinner) console.log("  - No winner determined yet");
        return;
      }

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
    this.playerManager.getParticipants().forEach((participant) => {
      this.scene.tweens.add({
        targets: participant.container,
        alpha: 0,
        duration: 2000,
        onComplete: () => {
          participant.container.setVisible(false);
        },
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
    this.currentPhase = "";
    this.isSmallGame = false;
    this.hasWinner = false;
    this.scene.tweens.killAll();
    this.scene.time.removeAllEvents();
    this.playerManager.clearParticipants();
  }

  /**
   * Handle phase transitions based on time-based phase calculation
   * This is called from App.tsx via updateGamePhase()
   */
  handlePhaseTransition(phase: string, timeRemaining: number) {
    const phaseChanged = this.currentPhase !== phase;
    this.currentPhase = phase;

    console.log(
      `[GamePhaseManager] Phase: ${phase}, Changed: ${phaseChanged}, Time: ${timeRemaining}s`
    );

    switch (phase) {
      // No active game, should show demo scene instead

      case "WAITING":
        // Betting window open - participants being spawned
        // Handled by real-time participant spawning
        console.log(`[GamePhaseManager] WAITING phase - ${timeRemaining}s remaining`);
        break;

      case "BETTING_CLOSED":
        if (phaseChanged) {
          console.log("[GamePhaseManager] Betting window closed, preparing to fight...");
        }
        break;

      case "FIGHTING":
        if (phaseChanged) {
          console.log("[GamePhaseManager] FIGHTING phase started - moving participants to center");
          // Move all participants to center for battle
          this.playerManager.moveParticipantsToCenter();
        }
        // Show "Waiting for VRF..." message (handled by BlockchainRandomnessDialog)
        break;

      case "VRF_DELAYED":
        if (phaseChanged) {
          console.log("[GamePhaseManager] VRF taking longer than expected...");
          // Could add visual indicator here (spinning loader, etc.)
        }
        break;

      case "RESULTS":
        if (phaseChanged) {
          console.log("[GamePhaseManager] RESULTS phase - showing winner");
          // Trigger explosion of eliminated participants
          const participants = this.playerManager.getParticipants();
          this.animationManager.explodeParticipantsOutward(participants);

          // Show winner celebration after explosion
          this.scene.time.delayedCall(1000, () => {
            // Winner celebration will be triggered by existing logic
          });
        }
        break;

      case "FINISHED":
        if (phaseChanged) {
          console.log("[GamePhaseManager] Game finished, preparing for next round");
          this.handleCompletedPhase();
        }
        break;

      case "ERROR":
        if (phaseChanged) {
          console.error("[GamePhaseManager] Game error - should trigger refunds");
        }
        break;
    }
  }
}
