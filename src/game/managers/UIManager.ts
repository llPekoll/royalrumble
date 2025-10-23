import { Scene } from "phaser";

export class UIManager {
  private scene: Scene;
  private centerX: number;

  // UI Elements
  public titleLogo!: Phaser.GameObjects.Image;
  public phaseText!: Phaser.GameObjects.Text;
  public timerText!: Phaser.GameObjects.Text;
  public timerBackground!: Phaser.GameObjects.Rectangle;

  private gameState: any = null;
  private lastTimerValue: string = "";
  private timerContainer!: Phaser.GameObjects.Container;
  private digitContainers: Map<number, Phaser.GameObjects.Container> = new Map();

  constructor(scene: Scene, centerX: number) {
    this.scene = scene;
    this.centerX = centerX;
  }

  updateCenter(centerX: number) {
    this.centerX = centerX;
    // Update positions of UI elements that use centerX
    if (this.titleLogo) {
      this.titleLogo.setX(centerX);
    }
    if (this.phaseText) {
      this.phaseText.setX(centerX);
    }
    if (this.timerContainer) {
      this.timerContainer.setX(centerX);
    }
    if (this.timerBackground) {
      this.timerBackground.setX(centerX);
    }
  }

  create() {
    // Show logo for 2 seconds then disappear
    this.titleLogo = this.scene.add.image(this.centerX, 350, "logo");
    this.titleLogo.setOrigin(0.5).setDepth(200);

    // Scale the logo appropriately (adjust this value as needed)
    this.titleLogo.setScale(0.3);

    // Animate logo appearance and disappearance
    this.titleLogo.setScale(0);
    this.scene.tweens.add({
      targets: this.titleLogo,
      scale: { from: 0, to: 0.3 },
      duration: 500,
      ease: "Back.easeOut",
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        this.titleLogo.setVisible(false);
      },
    });

    // Phase indicator (always visible after title)
    this.phaseText = this.scene.add
      .text(this.centerX, 120, "", {
        fontFamily: "Arial Black",
        fontSize: 28,
        color: "#FFA500",
        stroke: "#4B2F20",
        strokeThickness: 4,
        align: "center",
        shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 3, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(150);

    // Timer background with gradient-like effect
    this.timerBackground = this.scene.add.rectangle(this.centerX, 180, 160, 60, 0x2c1810, 0.8);
    this.timerBackground.setStrokeStyle(4, 0xffb347);
    this.timerBackground.setDepth(149);

    // Create timer container for animated digits
    this.timerContainer = this.scene.add.container(this.centerX, 180);
    this.timerContainer.setDepth(151);

    // Initialize with default timer display
    this.lastTimerValue = "";
    this.initializeTimer("0:00");
  }

  private initializeTimer(timeText: string) {
    // Clear existing containers
    this.digitContainers.forEach((container) => container.destroy());
    this.digitContainers.clear();

    // Calculate centering offset based on string length
    const charWidth = 22;
    const totalWidth = timeText.length * charWidth;
    const startOffset = -totalWidth / 2 + charWidth / 2;

    // Create initial digits
    for (let i = 0; i < timeText.length; i++) {
      const char = timeText[i];
      const xOffset = startOffset + i * charWidth;

      const container = this.scene.add.container(xOffset, 0);
      this.timerContainer.add(container);
      this.digitContainers.set(i, container);

      // Create mask for this digit position
      const maskGraphics = this.scene.add.graphics();
      maskGraphics.fillRect(this.centerX + xOffset - 15, 180 - 25, 30, 50);
      const mask = maskGraphics.createGeometryMask();
      container.setMask(mask);

      // Add initial digit
      const digit = this.createDigitText(char, "#FFDB58");
      container.add(digit);
    }
  }

  updateGameState(gameState: any) {
    this.gameState = gameState;
    if (!gameState) return;

    this.updatePhaseDisplay(gameState);
  }

  private updatePhaseDisplay(gameState: any) {
    const phaseNames: { [key: string]: string } = {
      arena: "RUNNING TO CENTER",
      betting: "PLACE YOUR BETS",
      battle: "FINAL BATTLE",
      awaitingWinnerRandomness: "DRAWING WINNER",
      finished: "WINNER DECLARED",
      results: "WINNER DECLARED",
    };

    const phaseName = phaseNames[gameState.status] || "Game Phase";
    const isSmallGame =
      gameState.isSmallGame || (gameState.playersCount !== undefined && gameState.playersCount < 8);
    const maxPhases = isSmallGame ? 3 : 5;

    // Map internal phase to display phase based on game type
    let displayPhase = gameState.phase;
    if (isSmallGame) {
      // Quick game (< 8 participants): Only 3 phases
      // Phase 1: Waiting
      // Phase 2: Arena
      // Phase 3: Results (internal phase 3 when skipping betting/battle)
      if (gameState.status === "waiting") displayPhase = 1;
      else if (gameState.status === "arena") displayPhase = 2;
      else if (gameState.status === "results") displayPhase = 3;
    } else {
      // Normal game (≥ 8 participants): 5 phases
      // Phase 1: Waiting
      // Phase 2: Arena
      // Phase 3: Betting
      // Phase 4: Battle
      // Phase 5: Results
      displayPhase = gameState.phase || 1;
    }

    // Add player count for waiting phase
    let displayText = `${phaseName}`;
    if (gameState.status === "waiting" && gameState.playersCount !== undefined) {
      displayText = `${phaseName} (${gameState.playersCount}/5)`;
    } else if (displayPhase) {
      displayText = `${phaseName} (${displayPhase}/${maxPhases})`;
    }

    this.phaseText.setText(displayText);
  }

  private createDigitText(char: string, color: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, char, {
        fontFamily: "Arial Black",
        fontSize: 36,
        color: color,
        stroke: "#6B4423",
        strokeThickness: 5,
        align: "center",
        shadow: { offsetX: 2, offsetY: 2, color: "#000000", blur: 4, fill: true },
      })
      .setOrigin(0.5);
  }

  private animateDigitChange(
    position: number,
    newChar: string,
    color: string,
    totalLength: number
  ) {
    // Calculate centering offset based on total string length
    const charWidth = 22;
    const totalWidth = totalLength * charWidth;
    const startOffset = -totalWidth / 2 + charWidth / 2;
    const xOffset = startOffset + position * charWidth;

    // Get or create container for this position
    let container = this.digitContainers.get(position);
    if (!container) {
      container = this.scene.add.container(xOffset, 0);
      this.timerContainer.add(container);
      this.digitContainers.set(position, container);

      // Create mask for this digit position
      const maskGraphics = this.scene.add.graphics();
      maskGraphics.fillRect(this.centerX + xOffset - 15, 180 - 25, 30, 50);
      const mask = maskGraphics.createGeometryMask();
      container.setMask(mask);
    } else {
      // Update position if length changed
      container.setX(xOffset);
    }

    // Clear old digits that are off-screen
    const toRemove: Phaser.GameObjects.Text[] = [];
    container.each((child: any) => {
      if (child.y > 40 || child.y < -40) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((child) => container.remove(child, true));

    // Create new digit coming from top
    const newDigit = this.createDigitText(newChar, color);
    newDigit.setY(-40); // Start above visible area
    container.add(newDigit);

    // Animate existing digits down and new digit into place
    container.each((child: any) => {
      if (child === newDigit) {
        // New digit slides in from top
        this.scene.tweens.add({
          targets: child,
          y: 0,
          duration: 200,
          ease: "Power2",
        });
      } else {
        // Old digits slide down and fade out
        this.scene.tweens.add({
          targets: child,
          y: child.y + 40,
          alpha: 0,
          duration: 200,
          ease: "Power2",
          onComplete: () => {
            container.remove(child, true);
          },
        });
      }
    });
  }

  updateTimer() {
    if (!this.gameState) return;

    // Calculate nextPhaseTime from blockchain endTimestamp
    const nextPhaseTime = this.gameState.endTimestamp; // Already in milliseconds from Convex

    if (!nextPhaseTime || nextPhaseTime === 0) {
      // No countdown to show yet
      this.timerContainer.setVisible(false);
      this.timerBackground.setVisible(false);
      return;
    }

    // Determine if it's a quick game
    const isSmallGame = this.gameState.isSmallGame || this.gameState.playersCount < 8;

    // Show timer only in specific phases
    if (isSmallGame) {
      // Quick game: show timer only in phase 1 (waiting)
      if (this.gameState.status !== "waiting") {
        this.timerContainer.setVisible(false);
        this.timerBackground.setVisible(false);
        return;
      }
    } else {
      // Normal game: show timer only in phase 1 (waiting) and phase 3 (betting)
      if (this.gameState.status !== "waiting" && this.gameState.status !== "betting") {
        this.timerContainer.setVisible(false);
        this.timerBackground.setVisible(false);
        return;
      }
    }

    // Make sure timer is visible
    this.timerContainer.setVisible(true);
    this.timerBackground.setVisible(true);

    const currentTime = Date.now();
    const timeRemaining = Math.max(0, nextPhaseTime - currentTime);
    const seconds = Math.ceil(timeRemaining / 1000);

    // Format time as M:SS
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeText = `${minutes}:${secs.toString().padStart(2, "0")}`;

    // Determine color based on time remaining
    let color = "#FFDB58"; // Golden for normal
    if (seconds <= 5) {
      color = "#FF6B6B"; // Red-orange for urgent
      this.timerBackground.setStrokeStyle(4, 0xff6b6b);
      // Pulse effect for last 5 seconds
      const scale = 1 + Math.sin(currentTime * 0.01) * 0.1;
      this.timerContainer.setScale(scale);
    } else if (seconds <= 10) {
      color = "#FFA500"; // Orange for warning
      this.timerBackground.setStrokeStyle(4, 0xffa500);
      this.timerContainer.setScale(1);
    } else {
      this.timerBackground.setStrokeStyle(4, 0xffb347);
      this.timerContainer.setScale(1);
    }

    // Animate digit changes
    if (timeText !== this.lastTimerValue) {
      // Update all digit positions if length changed
      if (timeText.length !== this.lastTimerValue.length) {
        // Recenter all containers
        const charWidth = 22;
        const totalWidth = timeText.length * charWidth;
        const startOffset = -totalWidth / 2 + charWidth / 2;

        for (let i = 0; i < timeText.length; i++) {
          const xOffset = startOffset + i * charWidth;
          const container = this.digitContainers.get(i);
          if (container) {
            container.setX(xOffset);
          }
        }
      }

      for (let i = 0; i < timeText.length; i++) {
        const newChar = timeText[i];
        const oldChar = this.lastTimerValue[i] || "";

        if (newChar !== oldChar) {
          this.animateDigitChange(i, newChar, color, timeText.length);
        } else {
          // Update color of existing digits
          const container = this.digitContainers.get(i);
          if (container) {
            container.each((child: any) => {
              if (child.y === 0) {
                // Only update the visible digit
                child.setColor(color);
              }
            });
          }
        }
      }

      // Remove extra digit containers if new text is shorter
      if (timeText.length < this.lastTimerValue.length) {
        for (let i = timeText.length; i < this.lastTimerValue.length; i++) {
          const container = this.digitContainers.get(i);
          if (container) {
            container.destroy();
            this.digitContainers.delete(i);
          }
        }
      }

      this.lastTimerValue = timeText;
    }
  }
}
