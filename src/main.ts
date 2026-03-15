import './style.css'
import Phaser from 'phaser'

type LearningReward = 'shield' | 'rapid-fire'

type GameState = {
  score: number
  shield: number
  reward: LearningReward | null
  rewardUntil: number
  learningSolved: boolean
}

const GAME_WIDTH = 960
const GAME_HEIGHT = 540
const HUD_STYLE = {
  fontFamily: 'Inter, system-ui, sans-serif',
  color: '#d9f7ff',
  fontSize: '20px',
} as const

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create() {
    const g = this.add.graphics()

    g.fillStyle(0x5be7ff)
    g.fillTriangle(18, 0, 0, 52, 36, 52)
    g.generateTexture('player', 36, 60)
    g.clear()

    g.fillStyle(0xff6b6b)
    g.fillRoundedRect(0, 0, 44, 26, 8)
    g.fillStyle(0xffd166)
    g.fillRect(30, 8, 10, 10)
    g.generateTexture('enemy', 44, 26)
    g.clear()

    g.fillStyle(0x9be564)
    g.fillRoundedRect(0, 0, 14, 6, 3)
    g.generateTexture('bullet', 14, 6)
    g.clear()

    g.fillStyle(0xfff275)
    g.fillCircle(12, 12, 12)
    g.generateTexture('gate', 24, 24)
    g.clear()

    g.fillStyle(0xffffff, 1)
    for (let i = 0; i < 80; i += 1) {
      g.fillCircle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.Between(1, 2),
      )
    }
    g.generateTexture('stars', GAME_WIDTH, GAME_HEIGHT)
    g.destroy()

    this.scene.start('flight')
  }
}

class FlightScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private fireKey!: Phaser.Input.Keyboard.Key
  private bullets!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private gate!: Phaser.Physics.Arcade.Image
  private bg1!: Phaser.GameObjects.TileSprite
  private bg2!: Phaser.GameObjects.TileSprite
  private hudText!: Phaser.GameObjects.Text
  private infoText!: Phaser.GameObjects.Text
  private lastShotAt = 0
  private enemyTimer?: Phaser.Time.TimerEvent
  private waveIndex = 0
  private state: GameState = {
    score: 0,
    shield: 100,
    reward: null,
    rewardUntil: 0,
    learningSolved: false,
  }

  constructor() {
    super('flight')
  }

  create() {
    this.cameras.main.setBackgroundColor('#09111f')

    this.bg1 = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'stars').setOrigin(0)
    this.bg1.setTint(0x0f2942)
    this.bg2 = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'stars').setOrigin(0)
    this.bg2.setTint(0xa8f0ff).setAlpha(0.65)

    this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 120, 'player')
    this.player.setCollideWorldBounds(true)
    this.player.setScale(1.1)

    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 60,
      runChildUpdate: false,
    })

    this.enemies = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 30,
      runChildUpdate: false,
    })

    this.gate = this.physics.add.image(GAME_WIDTH / 2, 110, 'gate')
    this.gate.setImmovable(true)
    this.gate.setScale(2.4)
    this.gate.setTint(0xffd166)

    this.enemyTimer = this.time.addEvent({
      delay: 1400,
      loop: true,
      callback: () => this.spawnWave(),
    })

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.physics.add.overlap(this.bullets, this.enemies, (bulletObj, enemyObj) => {
      const bullet = bulletObj as Phaser.Physics.Arcade.Image
      const enemy = enemyObj as Phaser.Physics.Arcade.Image
      bullet.disableBody(true, true)
      enemy.disableBody(true, true)
      this.state.score += 10
    })

    this.physics.add.overlap(this.player, this.enemies, (_player, enemyObj) => {
      const enemy = enemyObj as Phaser.Physics.Arcade.Image
      enemy.disableBody(true, true)
      this.damagePlayer(12)
    })

    this.physics.add.overlap(this.player, this.gate, () => {
      if (!this.state.learningSolved) {
        this.scene.pause()
        this.scene.launch('learning', {
          onDone: (reward: LearningReward) => {
            this.applyReward(reward)
            this.state.learningSolved = true
            this.gate.disableBody(true, true)
            this.scene.resume()
          },
        })
      }
    })

    this.hudText = this.add.text(20, 16, '', HUD_STYLE).setDepth(10)
    this.infoText = this.add
      .text(
        GAME_WIDTH - 20,
        16,
        'Pfeile bewegen · Space schießt · Fliege nach oben ins gelbe Lern-Gate',
        {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '18px',
          color: '#9ed8ff',
          align: 'right',
          wordWrap: { width: 420 },
        },
      )
      .setOrigin(1, 0)
      .setDepth(10)

    this.updateHud()
  }

  private spawnEnemyAt(x: number, yDelay = 0, vx = 0, vy = 200) {
    this.time.delayedCall(yDelay, () => {
      const enemy = this.enemies.get(x, -30, 'enemy') as Phaser.Physics.Arcade.Image | null
      if (!enemy) return

      enemy.setActive(true)
      enemy.setVisible(true)
      enemy.enableBody(true, x, -30, true, true)
      enemy.setVelocity(vx, vy)
    })
  }

  private spawnWave() {
    const pattern = this.waveIndex % 3

    if (pattern === 0) {
      ;[180, 320, 480, 640, 780].forEach((x, index) => {
        this.spawnEnemyAt(x, index * 120, 0, 185)
      })
      this.infoText.setText('Welle: Gerade Formation')
    } else if (pattern === 1) {
      ;[140, 260, 380, 500, 620].forEach((x, index) => {
        this.spawnEnemyAt(x, index * 110, 45, 190)
      })
      this.infoText.setText('Welle: Diagonal von links')
    } else {
      ;[820, 700, 580, 460, 340].forEach((x, index) => {
        this.spawnEnemyAt(x, index * 110, -45, 190)
      })
      this.infoText.setText('Welle: Diagonal von rechts')
    }

    this.waveIndex += 1
  }

  private fireBullet(now: number) {
    const fireDelay = this.state.reward === 'rapid-fire' && now < this.state.rewardUntil ? 110 : 220
    if (now - this.lastShotAt < fireDelay) return

    const bullet = this.bullets.get(this.player.x, this.player.y - 26, 'bullet') as Phaser.Physics.Arcade.Image | null
    if (!bullet) return

    bullet.setActive(true)
    bullet.setVisible(true)
    bullet.enableBody(true, this.player.x, this.player.y - 26, true, true)
    bullet.setAngle(-90)
    bullet.setVelocityY(-420)
    this.lastShotAt = now
  }

  private damagePlayer(amount: number) {
    this.state.shield = Math.max(0, this.state.shield - amount)
    this.cameras.main.shake(120, 0.005)
    this.updateHud()

    if (this.state.shield <= 0) {
      this.enemyTimer?.remove(false)
      this.scene.pause()
      this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 180, 0x04070d, 0.9)
        .setStrokeStyle(2, 0xff6b6b)
        .setDepth(20)
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 18, 'Run beendet', {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '36px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setDepth(21)
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28, 'Neu laden für den nächsten Testlauf', {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '18px',
          color: '#ffb3b3',
        })
        .setOrigin(0.5)
        .setDepth(21)
    }
  }

  private applyReward(reward: LearningReward) {
    const now = this.time.now
    this.state.reward = reward
    this.state.rewardUntil = now + 12000

    if (reward === 'shield') {
      this.state.shield = Math.min(100, this.state.shield + 30)
      this.infoText.setText('Mathe-Hack geschafft: Schild +30 für diesen Runabschnitt')
    } else {
      this.infoText.setText('Mathe-Hack geschafft: Schnellfeuer für 12 Sekunden')
    }

    this.time.delayedCall(12000, () => {
      if (this.state.rewardUntil <= this.time.now) {
        this.state.reward = null
        this.infoText.setText('Pfeile bewegen · Space schießt · Lern-Gate bereits geschafft')
        this.updateHud()
      }
    })

    this.updateHud()
  }

  private updateHud() {
    const rewardLabel =
      this.state.reward && this.time.now < this.state.rewardUntil
        ? this.state.reward === 'shield'
          ? 'Belohnung: Schildbonus'
          : 'Belohnung: Schnellfeuer'
        : 'Belohnung: –'

    this.hudText.setText([
      `Score: ${this.state.score}`,
      `Schild: ${this.state.shield}`,
      rewardLabel,
    ])
  }

  update(_time: number, delta: number) {
    this.bg1.tilePositionY -= 0.06 * delta
    this.bg2.tilePositionY -= 0.14 * delta

    const speed = 280
    const vx = (this.cursors.left?.isDown ? -1 : 0) + (this.cursors.right?.isDown ? 1 : 0)
    const vy = (this.cursors.up?.isDown ? -1 : 0) + (this.cursors.down?.isDown ? 1 : 0)
    this.player.setVelocity(vx * speed, vy * speed)

    if (this.fireKey.isDown) this.fireBullet(this.time.now)

    this.bullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image
      if (bullet.active && bullet.y < -40) bullet.disableBody(true, true)
      return false
    })

    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image
      if (enemy.active && enemy.y > GAME_HEIGHT + 60) enemy.disableBody(true, true)
      return false
    })

    this.updateHud()
  }
}

class LearningScene extends Phaser.Scene {
  private onDone!: (reward: LearningReward) => void
  private timeLeft = 10
  private timerText!: Phaser.GameObjects.Text
  private feedbackText!: Phaser.GameObjects.Text
  private selected = 0
  private options: Phaser.GameObjects.Container[] = []
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private enterKey!: Phaser.Input.Keyboard.Key
  private solved = false

  constructor() {
    super('learning')
  }

  init(data: { onDone: (reward: LearningReward) => void }) {
    this.onDone = data.onDone
  }

  create() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02060d, 0.8)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 620, 360, 0x10233a, 0.96).setStrokeStyle(3, 0xffd166)

    this.add
      .text(GAME_WIDTH / 2, 130, 'Hack-Modus: Löse die Mathe-Aufgabe', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.add
      .text(GAME_WIDTH / 2, 190, '24 + 18 = ?', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '54px',
        color: '#8cf7ff',
      })
      .setOrigin(0.5)

    this.timerText = this.add
      .text(GAME_WIDTH / 2, 245, 'Zeit: 10', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffd166',
      })
      .setOrigin(0.5)

    const answers = ['40', '42', '46']
    answers.forEach((answer, index) => {
      const y = 315 + index * 58
      const box = this.add.rectangle(0, 0, 220, 42, 0x17304a, 1).setStrokeStyle(2, 0x4fd1ff)
      const label = this.add
        .text(0, 0, answer, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '28px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
      const container = this.add.container(GAME_WIDTH / 2, y, [box, label])
      this.options.push(container)
    })

    this.feedbackText = this.add
      .text(GAME_WIDTH / 2, 470, '↑↓ wählen · Enter bestätigen', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '20px',
        color: '#c6e8ff',
      })
      .setOrigin(0.5)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

    this.time.addEvent({
      delay: 1000,
      repeat: 9,
      callback: () => {
        if (this.solved) return
        this.timeLeft -= 1
        this.timerText.setText(`Zeit: ${this.timeLeft}`)
        if (this.timeLeft <= 0) this.finish(false)
      },
    })

    this.refreshSelection()
  }

  private refreshSelection() {
    this.options.forEach((container, index) => {
      const rect = container.list[0] as Phaser.GameObjects.Rectangle
      if (index === this.selected) {
        rect.setFillStyle(0x28527a)
        rect.setStrokeStyle(3, 0xffd166)
      } else {
        rect.setFillStyle(0x17304a)
        rect.setStrokeStyle(2, 0x4fd1ff)
      }
    })
  }

  private finish(success: boolean) {
    if (this.solved) return
    this.solved = true

    if (success) {
      const reward: LearningReward = Phaser.Math.Between(0, 1) === 0 ? 'shield' : 'rapid-fire'
      this.feedbackText.setText(
        reward === 'shield'
          ? 'Richtig! Belohnung: Schild +30'
          : 'Richtig! Belohnung: Schnellfeuer',
      )
      this.time.delayedCall(900, () => {
        this.scene.stop()
        this.onDone(reward)
      })
    } else {
      this.feedbackText.setText('Zeit abgelaufen oder falsch – kein Bonus dieses Mal')
      this.time.delayedCall(900, () => {
        this.scene.stop()
        this.onDone('shield')
      })
    }
  }

  update() {
    if (this.solved) return

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.selected = Phaser.Math.Wrap(this.selected - 1, 0, this.options.length)
      this.refreshSelection()
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      this.selected = Phaser.Math.Wrap(this.selected + 1, 0, this.options.length)
      this.refreshSelection()
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.finish(this.selected === 1)
    }
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  backgroundColor: '#09111f',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [BootScene, FlightScene, LearningScene],
}

new Phaser.Game(config)
