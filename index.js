const mineflayer = require('mineflayer');
const fetch = require('node-fetch');
const http = require('http');

const MC_HOST     = process.env.MC_HOST;
const MC_PORT     = parseInt(process.env.MC_PORT) || 25565;
const MC_USERNAME = process.env.MC_USERNAME;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!MC_HOST || !MC_USERNAME || !WEBHOOK_URL) {
  console.error('Eksik env değişkeni!');
  process.exit(1);
}

http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000);

let mcBot = null;

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
  mcBot = mineflayer.createBot({
    host: MC_HOST, port: MC_PORT,
    username: MC_USERNAME,
    auth: 'offline', version: false
  });

  mcBot.once('spawn', () => {
    sendToDiscord('🤖 Bot', 'Sunucuya katıldı!', 0x57F287);
  });

  mcBot.on('chat', (username, message) => {
    if (username === mcBot.username) return;
    sendToDiscord(username, message, 0x5865F2);
  });

  mcBot.on('kicked', (reason) => {
    sendToDiscord('⚠️ Bot', 'Atıldı, yeniden bağlanıyor...', 0xED4245);
    mcBot = null;
    setTimeout(createBot, 10000);
  });

  mcBot.on('end', () => {
    sendToDiscord('🔌 Bot', 'Bağlantı kesildi, yeniden bağlanıyor...', 0xFEE75C);
    mcBot = null;
    setTimeout(createBot, 15000);
  });

  setInterval(() => {
    if (mcBot && mcBot.entity) {
      mcBot.setControlState('jump', true);
      setTimeout(() => mcBot.setControlState('jump', false), 200);
    }
  }, 4 * 60 * 1000);
}

async function pollDiscord() {
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) return;
  let lastMessageId = null;

  setInterval(async () => {
    try {
      const url = lastMessageId
        ? `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?after=${lastMessageId}&limit=10`
        : `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=1`;

      const res = await fetch(url, {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
      });

      const messages = await res.json();
      if (!Array.isArray(messages) || messages.length === 0) return;

      messages.reverse().forEach(msg => {
        lastMessageId = msg.id;
        if (msg.author?.bot) return;
        if (msg.content?.startsWith('!yaz ')) {
          const text = msg.content.slice(5).trim();
          if (mcBot && text) {
            mcBot.chat(text);
          }
        }
      });
    } catch (err) {
      console.error('Discord poll hatası:', err.message);
    }
  }, 3000);
}

createBot();
pollDiscord();
