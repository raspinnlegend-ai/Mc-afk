const mineflayer = require('mineflayer');
const fetch = require('node-fetch');
const http = require('http');
const fs = require('fs');

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

http.createServer((req, res) => {
  if (req.url === '/panel' || req.url === '/') {
    const html = fs.readFileSync('./panel.html', 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (req.url === '/bots') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Object.keys(bots).map(id => ({
      id, host: bots[id].host, username: bots[id].username, online: !!bots[id].bot?.entity
    }))));
  } else if (req.method === 'POST' && req.url === '/start') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const { host, port, username } = JSON.parse(body);
      const id = Date.now().toString();
      startBot(id, host, parseInt(port) || 25565, username);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id }));
    });
  } else if (req.method === 'POST' && req.url === '/stop') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const { id } = JSON.parse(body);
      if (bots[id]) { bots[id].bot?.end(); delete bots[id]; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(process.env.PORT || 3000);

const bots = {};

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

function startBot(id, host, port, username) {
  const bot = mineflayer.createBot({ host, port, username, auth: 'offline', version: false });
  bots[id] = { host, port, username, bot };

  bot.once('spawn', () => sendToDiscord('🤖 ' + username, host + ' sunucusuna katıldı!', 0x57F287));
  bot.on('chat', (u, m) => { if (u !== username) sendToDiscord(u, m, 0x5865F2); });
  bot.on('kicked', () => { sendToDiscord('⚠️ ' + username, 'Atıldı!', 0xED4245); setTimeout(() => startBot(id, host, port, username), 10000); });
  bot.on('end', () => { setTimeout(() => { if (bots[id]) startBot(id, host, port, username); }, 15000); });
  setInterval(() => { if (bot.entity) { bot.setControlState('jump', true); setTimeout(() => bot.setControlState('jump', false), 200); } }, 4 * 60 * 1000);
}

// Başlangıç botu (env'den)
if (process.env.MC_HOST && process.env.MC_USERNAME) {
  startBot('default', process.env.MC_HOST, parseInt(process.env.MC_PORT) || 25565, process.env.MC_USERNAME);
}

// Discord komut dinleyici
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
        if (msg.content?.startsWith('!yaz ')) {
          const text = msg.content.slice(5).trim();
          Object.values(bots).forEach(b => { if (b.bot && text) b.bot.chat(text); });
        }
      });
    } catch (err) {}
  }, 3000);
}
