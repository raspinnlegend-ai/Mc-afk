const mineflayer = require('mineflayer');
const fetch = require('node-fetch');
const http = require('http');
const fs = require('fs');

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const bots = {};

function addChat(id, type, user, text) {
  if (!bots[id]) return;
  bots[id].chat.push({ type, user, text, t: Date.now() });
  if (bots[id].chat.length > 100) bots[id].chat.shift();
}

function startBot(id, host, port, username) {
  const bot = mineflayer.createBot({ host, port, username, auth: 'offline', version: false });
  bots[id] = { host, port, username, bot, chat: [] };

  bot.once('spawn', () => {
    addChat(id, 'system', 'SYS', 'Sunucuya katıldı!');
    sendToDiscord('🤖 ' + username, host + ' sunucusuna katıldı!', 0x57F287);
  });

  bot.on('chat', (u, m) => {
    addChat(id, 'user', u, m);
    if (u !== username) sendToDiscord(u, m, 0x5865F2);
  });

  bot.on('message', (msg) => {
    const text = msg.toString();
    addChat(id, 'system', 'SYS', text);
  });

  bot.on('kicked', (reason) => {
    addChat(id, 'warn', 'SYS', 'Atıldı! Yeniden bağlanıyor...');
    sendToDiscord('⚠️ ' + username, 'Atıldı!', 0xED4245);
    setTimeout(() => { if (bots[id]) startBot(id, host, port, username); }, 10000);
  });

  bot.on('end', () => {
    addChat(id, 'warn', 'SYS', 'Bağlantı kesildi...');
    setTimeout(() => { if (bots[id]) startBot(id, host, port, username); }, 15000);
  });

  setInterval(() => {
    if (bot.entity) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 200);
    }
  }, 4 * 60 * 1000);
}

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

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/' || req.url === '/panel') {
    const html = fs.readFileSync('./panel.html', 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html);
  }

  if (req.url === '/bots') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(Object.entries(bots).map(([id, b]) => ({
      id, host: b.host, username: b.username,
      online: !!b.bot?.entity,
      chat: b.chat
    }))));
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (req.url === '/start') {
          const id = Date.now().toString();
          startBot(id, data.host, parseInt(data.port) || 25565, data.username);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, id }));
        }

        if (req.url === '/stop') {
          if (bots[data.id]) {
            bots[data.id].bot?.end();
            delete bots[data.id];
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

        if (req.url === '/send') {
          const b = bots[data.id];
          if (b && b.bot && data.text) {
            b.bot.chat(data.text);
            addChat(data.id, 'user', b.username, data.text);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        }

      } catch (e) {
        res.writeHead(400);
        return res.end('Bad request');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
}).listen(process.env.PORT || 3000);

if (process.env.MC_HOST && process.env.MC_USERNAME) {
  startBot('default', process.env.MC_HOST, parseInt(process.env.MC_PORT) || 25565, process.env.MC_USERNAME);
}

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
          Object.entries(bots).forEach(([id, b]) => {
            if (b.bot && text) {
              b.bot.chat(text);
              addChat(id, 'user', b.username, text);
            }
          });
        }
      });
    } catch (err) {}
  }, 3000);
          }
