const mineflayer = require('mineflayer');
const fetch = require('node-fetch');
const http = require('http');

const MC_HOST = process.env.MC_HOST;
const MC_PORT = parseInt(process.env.MC_PORT) || 25565;
const MC_USERNAME = process.env.MC_USERNAME;
const MC_PASSWORD = process.env.MC_PASSWORD;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000);

let bot = null;
let loggedIn = false;
let reconnectDelay = 15000;

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
  loggedIn = false;
  
  try {
    bot = mineflayer.createBot({
      host: MC_HOST,
      port: MC_PORT,
      username: MC_USERNAME,
      auth: 'offline',
      version: false,
      hideErrors: false,
      checkTimeoutInterval: 60000,
    });
  } catch(e) {
    setTimeout(createBot, reconnectDelay);
    return;
  }

  // Spawn olunca giriş yap
  bot.once('spawn', () => {
    setTimeout(() => {
      if (bot && !loggedIn) {
        bot.chat(`/giriş ${MC_PASSWORD}`);
        loggedIn = true;
        reconnectDelay = 15000;
        sendToDiscord('✅ Bot', `${MC_HOST} sunucusuna katıldı!`, 0x57F287);
      }
    }, 2000);
  });

  // Sunucu mesajlarını yakala
  bot.on('message', (msg) => {
    const text = msg.toString().trim();
    if (!text) return;

    // Giriş başarılı mesajı
    if (text.includes('başarı') || text.includes('hoş geldin') || text.includes('giriş')) {
      sendToDiscord('📢', text, 0x57F287);
      return;
    }

    sendToDiscord('📢', text, 0xFEE75C);
  });

  // Chat mesajları
  bot.on('chat', (u, m) => {
    if (u === MC_USERNAME) return;
    sendToDiscord(u, m, 0x5865F2);
  });

  // Atılma
  bot.on('kicked', (reason) => {
    let r = reason;
    try { r = JSON.parse(reason)?.text || reason; } catch {}
    sendToDiscord('⚠️ Bot', 'Atıldı: ' + r, 0xED4245);
    bot = null;
    // Çok hızlı atılıyorsa daha uzun bekle
    if (r.includes('fast') || r.includes('hızlı')) {
      reconnectDelay = 30000;
    }
    setTimeout(createBot, reconnectDelay);
  });

  bot.on('error', (err) => {
    bot = null;
    setTimeout(createBot, reconnectDelay);
  });

  bot.on('end', () => {
    if (loggedIn) {
      sendToDiscord('🔌 Bot', 'Bağlantı kesildi, yeniden bağlanıyor...', 0xFEE75C);
    }
    bot = null;
    setTimeout(createBot, reconnectDelay);
  });

  // Anti-AFK
  setInterval(() => {
    if (bot?.entity && loggedIn) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 200);
    }
  }, 4 * 60 * 1000);
}

// Discord dinleyici
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
        if (bot && loggedIn && msg.content?.trim()) {
          bot.chat(msg.content.trim());
        }
      });
    } catch (err) {}
  }, 2000);
}

createBot();
