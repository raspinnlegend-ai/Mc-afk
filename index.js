const mineflayer = require('mineflayer');
const fetch = require('node-fetch');
const http = require('http');

const MC_HOST = process.env.MC_HOST;
const MC_PORT = parseInt(process.env.MC_PORT) || 25565;
const MC_USERNAME = process.env.MC_USERNAME;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000);

let bot = null;

async function sendToDiscord(username, message, color) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ description: `**${username}:** ${message}`, color, timestamp: new Date().toISOString() }]
      })
    });
  } catch (err) {}
}

function createBot() {
  bot = mineflayer.createBot({
    host: MC_HOST, port: MC_PORT,
    username: MC_USERNAME,
    auth: 'offline', version: false
  });

  bot.once('spawn', () => {
    sendToDiscord('🤖 Bot', 'Sunucuya katıldı!', 0x57F287);
  });

  bot.on('chat', (u, m) => {
    if (u === MC_USERNAME) return;
    sendToDiscord(u, m, 0x5865F2);
  });

  bot.on('message', (msg) => {
    const text = msg.toString().trim();
    if (text) sendToDiscord('📢', text, 0xFEE75C);
  });

  bot.on('kicked', (reason) => {
    let r = reason;
    try { r = JSON.parse(reason)?.text || reason; } catch {}
    sendToDiscord('⚠️ Bot', 'Atıldı: ' + r, 0xED4245);
    bot = null;
    setTimeout(createBot, 10000);
  });

  bot.on('error', () => {
    bot = null;
    setTimeout(createBot, 10000);
  });

  bot.on('end', () => {
    sendToDiscord('🔌 Bot', 'Bağlantı kesildi, yeniden bağlanıyor...', 0xFEE75C);
    bot = null;
    setTimeout(createBot, 15000);
  });

  setInterval(() => {
    if (bot?.entity) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 200);
    }
  }, 4 * 60 * 1000);
}

// Discord dinleyici — her mesajı direkt gönder
if (DISCORD_BOT_TOKEN && DISCORD_CHANNEL_ID) {
  let lastId = null;
  setInterval(async () => {
    try {
      const url = lastId
        ? `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?after=${lastId}&limit=10`
        : `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=1`;
      const res = await fetch(url, { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } });
      const msgs = await res.json();
      if (!Array.isArray(msgs) || !msgs.length) return;
      msgs.reverse().forEach(msg => {
        lastId = msg.id;
        if (msg.author?.bot) return;
        if (bot && msg.content?.trim()) {
          bot.chat(msg.content.trim());
        }
      });
    } catch (err) {}
  }, 2000);
}

createBot();
