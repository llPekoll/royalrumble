import { Scene } from 'phaser';

export class UIManager {
  private scene: Scene;
  private centerX: number;

  // UI Elements
  public titleLogo!: Phaser.GameObjects.Image;
  public phaseText!: Phaser.GameObjects.Text;
  public timerText!: Phaser.GameObjects.Text;
  public timerBackground!: Phaser.GameObjects.Rectangle;
  public playerCountText!: Phaser.GameObjects.Text;
  public potAmountText!: Phaser.GameObjects.Text;

  private gameState: any = null;

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
    if (this.timerText) {
      this.timerText.setX(centerX);
    }
    if (this.timerBackground) {
      this.timerBackground.setX(centerX);
    }
    if (this.playerCountText) {
      this.playerCountText.setX(centerX);
    }
    if (this.potAmountText) {
      this.potAmountText.setX(centerX);
    }
  }

  create() {
    // Show logo for 2 seconds then disappear
    this.titleLogo = this.scene.add.image(this.centerX, 350, 'logo');
    this.titleLogo.setOrigin(0.5).setDepth(200);

    // Scale the logo appropriately (adjust this value as needed)
    this.titleLogo.setScale(0.3);

    // Animate logo appearance and disappearance
    this.titleLogo.setScale(0);
    this.scene.tweens.add({
      targets: this.titleLogo,
      scale: { from: 0, to: 0.3 },
      duration: 500,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        this.titleLogo.setVisible(false);
      }
    });

    // Phase indicator (always visible after title)
    this.phaseText = this.scene.add.text(this.centerX, 120, '', {
      fontFamily: 'Arial Black',
      fontSize: 28,
      color: '#FFA500',
      stroke: '#4B2F20',
      strokeThickness: 4,
      align: 'center',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true }
    }).setOrigin(0.5).setDepth(150);

    // Timer background with gradient-like effect
    this.timerBackground = this.scene.add.rectangle(this.centerX, 180, 160, 60, 0x2C1810, 0.8);
    this.timerBackground.setStrokeStyle(4, 0xFFB347);
    this.timerBackground.setDepth(149);

    // Timer display with amber theme
    this.timerText = this.scene.add.text(this.centerX, 180, '0:00', {
      fontFamily: 'Arial Black',
      fontSize: 36,
      color: '#FFDB58',
      stroke: '#6B4423',
      strokeThickness: 5,
      align: 'center',
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, fill: true }
    }).setOrigin(0.5).setDepth(151);

    // Player count display (bottom left)
    this.playerCountText = this.scene.add.text(this.centerX - 150, 700, 'Players: 0', {
      fontFamily: 'Arial Black',
      fontSize: 24,
      color: '#FFD700',
      stroke: '#4B2F20',
      strokeThickness: 3,
      align: 'left'
    }).setOrigin(0.5).setDepth(150);

    // Pot amount display (bottom right)
    this.potAmountText = this.scene.add.text(this.centerX + 150, 700, '£ 0', {
      fontFamily: 'Arial Black',
      fontSize: 26,
      color: '#FFB347',
      stroke: '#4B2F20',
      strokeThickness: 4,
      align: 'right',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true }
    }).setOrigin(0.5).setDepth(150);

 }

  updateGameState(gameState: any) {
    this.gameState = gameState;
    if (!gameState) return;

    this.updatePhaseDisplay(gameState);
    this.updatePlayerCount(gameState);
    this.updatePotAmount(gameState);
  }

  private updatePhaseDisplay(gameState: any) {
    const phaseNames: { [key: string]: string } = {
      'waiting': 'WAITING FOR PLAYERS',
      'arena': 'RUNNING TO CENTER',
      'betting': 'PLACE YOUR BETS',
      'battle': 'FINAL BATTLE',
      'results': 'WINNER DECLARED'
    };

    const phaseName = phaseNames[gameState.status] || 'Game Phase';
    const participantCount = gameState.participants?.length || 0;
    const maxPhases = participantCount < 8 ? 3 : 5;

    // Adjust phase number for display in 3-phase games
    let displayPhase = gameState.phase;
    if (participantCount < 8 && gameState.phase === 3) {
      displayPhase = 3; // Results is phase 3 in 3-phase games
    }

    this.phaseText.setText(`${phaseName} (${displayPhase}/${maxPhases})`);
  }

  private updatePlayerCount(gameState: any) {
    const participantCount = gameState.participants?.length || 0;
    this.playerCountText.setText(`Players: ${participantCount}`);
  }

  private updatePotAmount(gameState: any) {
    // Calculate total pot from all participants' bet amounts
    const totalPotInCoins = gameState.participants?.reduce((sum: number, participant: any) => {
      return sum + (participant.betAmount || 0);
    }, 0) || 0;

    // Display pot in coins with £ symbol
    this.potAmountText.setText(`£ ${totalPotInCoins.toLocaleString()}`);
  }

  updateTimer() {
    if (!this.gameState || !this.gameState.nextPhaseTime) return;

    const currentTime = Date.now();
    const timeRemaining = Math.max(0, this.gameState.nextPhaseTime - currentTime);
    const seconds = Math.ceil(timeRemaining / 1000);

    // Format time as M:SS
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeText = `${minutes}:${secs.toString().padStart(2, '0')}`;

    this.timerText.setText(timeText);

    // Change color based on time remaining with amber theme
    if (seconds <= 5) {
      this.timerText.setColor('#FF6B6B'); // Red-orange for urgent
      this.timerBackground.setStrokeStyle(4, 0xFF6B6B);
      // Pulse effect for last 5 seconds
      const scale = 1 + Math.sin(currentTime * 0.01) * 0.1;
      this.timerText.setScale(scale);
    } else if (seconds <= 10) {
      this.timerText.setColor('#FFA500'); // Orange for warning
      this.timerBackground.setStrokeStyle(4, 0xFFA500);
      this.timerText.setScale(1);
    } else {
      this.timerText.setColor('#FFDB58'); // Golden for normal
      this.timerBackground.setStrokeStyle(4, 0xFFB347);
      this.timerText.setScale(1);
    }
  }
}
