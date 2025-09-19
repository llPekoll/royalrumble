import { Scene } from 'phaser';

export class UIManager {
  private scene: Scene;
  private centerX: number;

  // UI Elements
  public titleText!: Phaser.GameObjects.Text;
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

  create() {
    // Show title for 2 seconds then disappear
    this.titleText = this.scene.add.text(this.centerX, 150, '🏆 ROYAL RUMBLE 🏆', {
      fontFamily: 'Arial Black',
      fontSize: 48,
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center'
    }).setOrigin(0.5).setDepth(200);

    // Animate title appearance and disappearance
    this.titleText.setScale(0);
    this.scene.tweens.add({
      targets: this.titleText,
      scale: { from: 0, to: 1.2 },
      duration: 500,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        this.titleText.setVisible(false);
      }
    });

    // Phase indicator (always visible after title)
    this.phaseText = this.scene.add.text(this.centerX, 50, '', {
      fontFamily: 'Arial Black',
      fontSize: 24,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center'
    }).setOrigin(0.5).setDepth(150);

    // Timer background
    this.timerBackground = this.scene.add.rectangle(this.centerX, 100, 140, 50, 0x000000, 0.7);
    this.timerBackground.setStrokeStyle(3, 0xffd700);
    this.timerBackground.setDepth(149);

    // Timer display
    this.timerText = this.scene.add.text(this.centerX, 100, '0:00', {
      fontFamily: 'Arial Black',
      fontSize: 32,
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5).setDepth(151);

    // Player count display (bottom left)
    this.playerCountText = this.scene.add.text(this.centerX - 150, 700, 'Players: 0', {
      fontFamily: 'Arial Black',
      fontSize: 24,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'left'
    }).setOrigin(0.5).setDepth(150);

    // Pot amount display (bottom right)
    this.potAmountText = this.scene.add.text(this.centerX + 150, 700, 'Pot: 0 SOL', {
      fontFamily: 'Arial Black',
      fontSize: 24,
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'right'
    }).setOrigin(0.5).setDepth(150);

    // Debug: Scene name at bottom
    this.scene.add.text(this.centerX, 750, 'Scene: RoyalRumble', {
      fontFamily: 'Arial', fontSize: 16, color: '#ffff00',
      stroke: '#000000', strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5).setDepth(1000);
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
      'waiting': '⏳ Waiting for Players',
      'arena': '🏃‍♂️ Running to Center',
      'betting': '💰 Betting on Finalists',
      'battle': '⚔️ Final Battle',
      'results': '🏆 Results'
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

    // Convert coins to SOL (1000 coins = 1 SOL)
    const totalPotInSol = (totalPotInCoins / 1000).toFixed(3);
    this.potAmountText.setText(`Pot: ${totalPotInSol} SOL`);
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

    // Change color based on time remaining
    if (seconds <= 5) {
      this.timerText.setColor('#ff0000'); // Red for urgent
      this.timerBackground.setStrokeStyle(3, 0xff0000);
      // Pulse effect for last 5 seconds
      const scale = 1 + Math.sin(currentTime * 0.01) * 0.1;
      this.timerText.setScale(scale);
    } else if (seconds <= 10) {
      this.timerText.setColor('#ffff00'); // Yellow for warning
      this.timerBackground.setStrokeStyle(3, 0xffff00);
      this.timerText.setScale(1);
    } else {
      this.timerText.setColor('#00ff00'); // Green for normal
      this.timerBackground.setStrokeStyle(3, 0x00ff00);
      this.timerText.setScale(1);
    }
  }
}
