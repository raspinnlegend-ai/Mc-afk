const mineflayer = require('mineflayer');
const fetch = require('node-fetch');
const http = require('http');

const MC_HOST     = process.env.MC_HOST;
const MC_PORT     = parseInt(process.env.MC_PORT) || 25565;
const MC_USERNAME = process.env.MC_USERNAME;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!MC_HOST || !MC_USERNAME || !WEBHOOK_URL) {
  console.error('Eksik env değişkeni!');
  process.exit(1);
}

http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000);

async function sendToDiscord(username, message, color) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ description: `**${username}:** ${message}`, color, timestamp: new Date().toISOString() }]
      })
    });
  } catch (err) {
    console.error('Discord hatası:', err.message);
  }
}

function createBot() {
  const bot = mineflayer.createBot({
    host: MC_HOST, port: MC_PORT,
    username: MC_USERNAME,
    auth: 'offline', version: false
  });

  bot.once('spawn', () => {
    sendToDiscord('🤖 Bot', 'Sunucuya katıldı!', 0x57F287);
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    sendToDiscord(username, message, 0x5865F2);
  });

  bot.on('kicked', (reason) => {
    sendToDiscord('⚠️ Bot', 'Atıldı, yeniden bağlanıyor...', 0xED4245);
    setTimeout(createBot, 10000);
  });

  bot.on('end', () => {
    sendToDiscord('🔌 Bot', 'Bağlantı kesildi, yeniden bağlanıyor...', 0xFEE75C);
    setTimeout(createBot, 15000);
  });

  setInterval(() => {
    if (bot.entity) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 200);
    }
  }, 4 * 60 * 1000);
}

createBot();
