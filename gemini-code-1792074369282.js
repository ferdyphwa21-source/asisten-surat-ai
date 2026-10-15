const http = require('http');
const fs = require('fs');
const path = require('path');
const { verifyCode } = require('./kode');

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.MODEL || 'openai/gpt-3.5-turbo';
const FREE_LIMIT = parseInt(process.env.FREE_LIMIT || '3', 10);
const PREMIUM_LIMIT = parseInt(process.env.PREMIUM_LIMIT || '30', 10);
const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key';
const REVOKED_CODES = (process.env.REVOKED_CODES || '').split(',').map(s => s.trim());

// Tracking batas harian berbasis memori
const usageTracker = {};

// Reset usage tracker tiap tengah malam
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    for (let key in usageTracker) delete usageTracker[key];
  }
}, 60000);

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { jenisSurat, detailInput, premiumCode } = JSON.parse(body);
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        let limit = FREE_LIMIT;
        let trackerKey = `ip_${clientIp}`;

        // Cek jika menggunakan Kode Premium
        if (premiumCode) {
          const verification = verifyCode(premiumCode, SECRET_KEY);
          if (!verification.valid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: `Kode Premium Invalid: ${verification.reason}` }));
          }
          if (REVOKED_CODES.includes(verification.codeId)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Kode Premium ini telah dicabut.' }));
          }
          limit = PREMIUM_LIMIT;
          trackerKey = `code_${premiumCode}`;
        }

        // Cek Kuota
        const currentUsage = usageTracker[trackerKey] || 0;
        if (currentUsage >= limit) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 
            error: `Batas harian tercapai (${limit} surat/hari). Silakan upgrade ke Premium atau tunggu besok.` 
          }));
        }

        if (!OPENROUTER_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY belum dikonfigurasi di server.' }));
        }

        // Panggil OpenRouter API
        const prompt = `Buatkan ${jenisSurat} resmi dan profesional berbahasa Indonesia berdasarkan detail berikut:\n${detailInput}\n\nFormat surat harus lengkap (tempat/tanggal, perihal, lampiran, salam pembuka, isi, salam penutup, dan tempat tanda tangan).`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Gagal memanggil API OpenRouter');
        }

        // Increment usage
        usageTracker[trackerKey] = currentUsage + 1;

        const hasilSurat = data.choices[0].message.content;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          result: hasilSurat, 
          sisaKuota: limit - usageTracker[trackerKey] 
        }));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server Asisten Surat AI berjalan di port ${PORT}`);
});