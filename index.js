const MinecraftBot = require('./minecraft-bot');
const DiscordBot = require('./discord-bot');
const logger = require('./utils/logger');

// Load environment variables
require('dotenv').config();

class BotManager {
    constructor() {
        this.minecraftBot = null;
        this.discordBot = null;
        this.isShuttingDown = false;
    }

    async start() {
        try {
            logger.info('🚀 Starting bot manager...');

            this.discordBot = new DiscordBot();
            logger.info('🤖 Starting Discord bot...');
            await this.discordBot.start();

            this.minecraftBot = new MinecraftBot(this.discordBot);
            logger.info('🟢 Starting Minecraft bot...');
            await this.minecraftBot.start();

            this.setupGracefulShutdown();

            logger.info('✅ Both bots started');
            this.keepAlive();

        } catch (error) {
            logger.error('❌ Failed to start bots:', error);
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            logger.info(`🛑 ${signal}: graceful shutdown...`);
            try {
                if (this.minecraftBot) {
                    logger.info('🔻 Stopping Minecraft bot...');
                    await this.minecraftBot.stop();
                }
                if (this.discordBot) {
                    logger.info('🔻 Stopping Discord bot...');
                    await this.discordBot.stop();
                }
                logger.info('✅ Shutdown complete');
                process.exit(0);
            } catch (error) {
                logger.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('uncaughtException', (error) => {
            logger.error('💥 Uncaught exception:', error);
            shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }

    keepAlive() {
        const express = require('express');
        const app = express();

        app.get('/', (req, res) => {
            res.json({
                status: 'online',
                minecraft: this.minecraftBot ? this.minecraftBot.isConnected : false,
                discord: this.discordBot ? this.discordBot.isReady : false,
                uptime: process.uptime()
            });
        });

        app.listen(5000, '0.0.0.0', () => {
            logger.info('🌐 Keep-alive at :5000');
        });
    }
}

// Start the bots
const botManager = new BotManager();
botManager.start().catch(error => {
    logger.error('❌ Failed to start application:', error);
    process.exit(1);
});
