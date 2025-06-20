const mineflayer = require('mineflayer');
const logger = require('./utils/logger');

class MinecraftBot {
    constructor(discordBot) {
        this.discordBot = discordBot;
        this.bot = null;
        this.reconnectTimeout = null;
        this.movementInterval = null;
        this.isConnected = false;
        this.reconnectDelay = 5000;
        this.movementDelay = 2000;

        this.config = {
            host: process.env.MINECRAFT_HOST || 'localhost',
            port: parseInt(process.env.MINECRAFT_PORT) || 25565,
            username: process.env.MINECRAFT_USERNAME || 'AFKBot',
            password: process.env.MINECRAFT_PASSWORD || '',
            version: process.env.MINECRAFT_VERSION || 'auto'
        };
    }

    async start() {
        logger.info('🟢 Starting Minecraft bot...');
        this.connect();
    }

    async stop() {
        logger.info('🔻 Stopping Minecraft bot...');
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        if (this.movementInterval) clearInterval(this.movementInterval);
        if (this.bot) this.bot.quit('Bot shutting down');
        this.bot = null;
        this.isConnected = false;
    }

    connect() {
        try {
            logger.info(`🟢 Connecting to server ${this.config.host}:${this.config.port} as ${this.config.username}`);

            const botOptions = {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                version: this.config.version,
                auth: this.config.password ? 'microsoft' : 'offline',
                skipValidation: true,
                hideErrors: false
            };

            if (this.config.password) botOptions.password = this.config.password;

            logger.info('✅ Bot options loaded');
            this.bot = mineflayer.createBot(botOptions);
            this.setupEventHandlers();

        } catch (error) {
            logger.error('❌ Failed to create Minecraft bot:', error.message || error);
            this.scheduleReconnect();
        }
    }

    setupEventHandlers() {
    this.bot.on('login', () => {
        logger.info(`🟢 Minecraft logged in as ${this.bot.username}`);
        this.isConnected = true;
    });

    this.bot.on('spawn', async () => {
        logger.info('🟢 Bot spawned in game');

        // Notify Discord only after spawn
        if (this.discordBot && typeof this.discordBot.notifyMinecraftConnection === 'function') {
            await this.discordBot.notifyMinecraftConnection(this.config.host, this.config.port);
            logger.info('🤖 📨 Notified Discord: Minecraft joined');
        }

        this.startRandomMovement();
    });

    // Other event handlers...


        this.bot.on('error', (error) => {
            logger.error('❌ Bot error:', error.message || error);
            this.isConnected = false;
            this.scheduleReconnect();
        });

        this.bot.on('end', (reason) => {
            logger.info('🔌 Bot disconnected');
            this.isConnected = false;
            this.stopRandomMovement();
            this.scheduleReconnect();
        });

        this.bot.on('kicked', (reason) => {
            logger.warn('❗ Bot was kicked:', reason);
            this.isConnected = false;
            this.scheduleReconnect();
        });

        this.bot.on('death', () => {
            logger.info('💀 Bot died — respawning...');
            this.bot.respawn();
        });

        this.bot.on('chat', (username, message) => {
            if (username !== this.bot.username) {
                logger.info(`[💬 CHAT] ${username}: ${message}`);
            }
        });
    }

    startRandomMovement() {
        if (this.movementInterval) clearInterval(this.movementInterval);

        this.movementInterval = setInterval(() => {
            if (!this.bot || !this.isConnected) return;
            try {
                this.performRandomMovement();
            } catch (error) {
                logger.error('⚠️ Random movement error:', error);
            }
        }, this.movementDelay);

        logger.info('🎮 AFK movement started');
    }

    stopRandomMovement() {
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
        }
        logger.info('🛑 Random movement stopped');
    }

    performRandomMovement() {
        if (!this.bot || !this.isConnected) return;

        const movements = [
            () => this._move('forward'),
            () => this._move('back'),
            () => this._move('left'),
            () => this._move('right'),
            () => this._move('jump', 100),
            () => this.bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * Math.PI)
        ];

        const randomMovement = movements[Math.floor(Math.random() * movements.length)];
        randomMovement();
    }

    _move(direction, duration = 500) {
        this.bot.setControlState(direction, true);
        setTimeout(() => this.bot.setControlState(direction, false), duration);
    }

    scheduleReconnect() {
        if (this.reconnectTimeout) return;

        logger.info(`🔁 Reconnecting in ${this.reconnectDelay / 1000}s`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, this.reconnectDelay);
    }

    isConnected() {
        return this.isConnected && this.bot;
    }

    getServerInfo() {
        if (!this.bot || !this.isConnected) {
            return {
                online: false,
                host: this.config.host,
                port: this.config.port
            };
        }

        return {
            online: true,
            host: this.config.host,
            port: this.config.port,
            username: this.bot.username,
            health: this.bot.health,
            food: this.bot.food,
            experience: this.bot.experience
        };
    }
}

module.exports = MinecraftBot;
