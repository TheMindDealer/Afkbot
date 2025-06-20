class Logger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',                                                         blue: '\x1b[34m',
      dim: '\x1b[2m'
    };
  }

  // Detect if message already starts with an emoji
  startsWithEmoji(text) {
    return /^\p{Emoji}/u.test(text.trim());
  }

  emoji(message) {
    if (message.includes('Starting')) return '🚀';
    if (message.includes('Discord')) return '🤖';
    if (message.includes('Minecraft')) return '🟢';                             if (message.includes('Reconnect')) return '🔁';
    if (message.includes('alive') || message.includes('Alive')) return '🌐';
    if (message.includes('SIGINT') || message.includes('shutting down')) return '🛑';
    if (message.includes('complete') || message.includes('Done')) return '✅';
    if (message.includes('error') || message.includes('ECONNRESET')) return '❌';
    if (message.includes('warn')) return '⚠️';
    return '';
  }

  info(message, ...args) {
    const emoji = this.startsWithEmoji(message) ? '' : this.emoji(message);
    console.log(`${this.colors.blue}${emoji} ${message}${this.colors.reset}`);
  }

  warn(message, ...args) {
    const emoji = this.startsWithEmoji(message) ? '' : this.emoji(message);
    console.warn(`${this.colors.yellow}${emoji} ${message}${this.colors.reset}`);
  }

  error(message, ...args) {
    const emoji = this.startsWithEmoji(message) ? '' : this.emoji(message);
    console.error(`${this.colors.red}${emoji} ${message}${this.colors.reset}`);
  }

  success(message, ...args) {
    const emoji = this.startsWithEmoji(message) ? '' : this.emoji(message);
    console.log(`${this.colors.green}${emoji} ${message}${this.colors.reset}`);
  }

  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.log(`${this.colors.dim}🐞 ${message}${this.colors.reset}`);
    }
  }
}

module.exports = new Logger();
