const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const logger = require('./utils/logger');
const { getServerStatus } = require('./utils/server-status');

class DiscordBot {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.scheduledTask = null;

        // Get configuration from environment variables
        this.config = {
            token: process.env.DISCORD_TOKEN || '',
            channelId: process.env.DISCORD_CHANNEL_ID || '',
            guildId: process.env.DISCORD_GUILD_ID || '',
            minecraftHost: process.env.MINECRAFT_HOST || 'localhost',
            minecraftPort: parseInt(process.env.MINECRAFT_PORT) || 25565
        };

        if (!this.config.token) {
            throw new Error('DISCORD_TOKEN environment variable is required');
        }
    }

    async start() {
        try {
            logger.info('Starting Discord bot...');

            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent
                ]
            });

            this.setupEventHandlers();
            await this.client.login(this.config.token);

        } catch (error) {
            logger.error('Failed to start Discord bot:', error);
            throw error;
        }
    }

    async stop() {
        logger.info('Stopping Discord bot...');

        if (this.scheduledTask) {
            this.scheduledTask.stop();
            this.scheduledTask = null;
        }

        if (this.client) {
            await this.client.destroy();
            this.client = null;
        }

        this.isReady = false;
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            logger.info(`Discord bot logged in as ${this.client.user.tag}`);
            this.isReady = true;
            this.startScheduledMessages();
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            const content = message.content.toLowerCase().trim();

            // Handle server status command
            if (content === '!serverstatus' || content === '!status') {
                await this.handleServerStatusCommand(message);
            }

            // Handle help command
            if (content === '!help') {
                await this.handleHelpCommand(message);
            }
        });

        this.client.on('error', (error) => {
            logger.error('Discord bot error:', error);
        });

        this.client.on('disconnect', () => {
            logger.warn('Discord bot disconnected');
            this.isReady = false;
        });
    }

    startScheduledMessages() {
        // Schedule message every 30 minutes
        this.scheduledTask = cron.schedule('*/30 * * * *', async () => {
            await this.sendScheduledMessage();
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        logger.info('Scheduled messages started (every 30 minutes)');
    }

    async sendScheduledMessage() {
        try {
            if (!this.config.channelId) {
                logger.warn('No Discord channel ID configured for scheduled messages');
                return;
            }

            const channel = await this.client.channels.fetch(this.config.channelId);
            if (!channel) {
                logger.error('Could not find Discord channel');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎮 Server Reminder')
                .setDescription('@everyone join server!')
                .setColor(0x00AE86)
                .addFields(
                    { name: 'Server IP', value: `${this.config.minecraftHost}:${this.config.minecraftPort}`, inline: true },
                    { name: 'Commands', value: '`!status` - Check server status\n`!help` - Show all commands', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Minecraft AFK Bot' });

            await channel.send({ embeds: [embed] });
            logger.info('Scheduled message sent to Discord');

        } catch (error) {
            logger.error('Failed to send scheduled message:', error);
        }
    }

    async notifyMinecraftConnection(host, port) {
        try {
            if (!this.config.channelId || !this.isReady) {
                return;
            }

            const channel = await this.client.channels.fetch(this.config.channelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('✅ Minecraft Bot Connected')
                .setDescription(`Successfully connected to the Minecraft server!`)
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Server', value: `${host}:${port}`, inline: true },
                    { name: 'Status', value: 'Online and AFK mode active', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Minecraft AFK Bot' });

            await channel.send({ embeds: [embed] });
            logger.info('Minecraft connection notification sent to Discord');

        } catch (error) {
            logger.error('Failed to send connection notification:', error);
        }
    }

    async handleServerStatusCommand(message) {
        try {
            await message.channel.sendTyping();

            const serverStatus = await getServerStatus(this.config.minecraftHost, this.config.minecraftPort);

            const embed = new EmbedBuilder()
                .setTitle('🖥️ Server Status')
                .setColor(serverStatus.online ? 0x00FF00 : 0xFF0000);

            if (serverStatus.online) {
                embed
                    .setDescription('✅ Server is online!')
                    .addFields(
                        { name: 'Server IP', value: `${this.config.minecraftHost}:${this.config.minecraftPort}`, inline: true },
                        { name: 'Players Online', value: `${serverStatus.players.online}/${serverStatus.players.max}`, inline: true },
                        { name: 'Version', value: serverStatus.version.name || 'Unknown', inline: true }
                    );

                if (serverStatus.players.sample && serverStatus.players.sample.length > 0) {
                    const playerList = serverStatus.players.sample
                        .slice(0, 10)
                        .map(player => player.name)
                        .join(', ');
                    embed.addFields({ name: 'Online Players', value: playerList, inline: false });
                }

                if (serverStatus.description) {
                    embed.addFields({ name: 'MOTD', value: serverStatus.description.text || 'No description', inline: false });
                }
            } else {
                embed
                    .setDescription('❌ Server is offline or unreachable')
                    .addFields(
                        { name: 'Server IP', value: `${this.config.minecraftHost}:${this.config.minecraftPort}`, inline: true },
                        { name: 'Status', value: 'Offline', inline: true }
                    );
            }

            embed
                .setTimestamp()
                .setFooter({ text: 'Minecraft AFK Bot' });

            await message.reply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error handling server status command:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to retrieve server status. Please try again later.')
                .setColor(0xFF0000)
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });
        }
    }

    async handleHelpCommand(message) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🤖 Bot Commands')
                .setDescription('Here are all available commands:')
                .setColor(0x0099FF)
                .addFields(
                    { name: '!status', value: 'Check Minecraft server status, player count, and online players', inline: false },
                    { name: '!serverstatus', value: 'Alias for !status command', inline: false },
                    { name: '!help', value: 'Show this help message', inline: false }
                )
                .addFields(
                    { name: 'Automatic Features', value: '• Sends "@everyone join server" every 30 minutes\n• Notifies when AFK bot connects to server\n• Keeps Minecraft bot active with random movements', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Minecraft AFK Bot' });

            await message.reply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error handling help command:', error);
        }
    }

    isReady() {
        return this.isReady && this.client && this.client.readyAt;
    }
}

module.exports = DiscordBot;
