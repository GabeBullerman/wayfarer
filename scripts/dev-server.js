// Local dev API server — mirrors the Vercel serverless function on port 3001.
// Run alongside ng serve: node scripts/dev-server.js
const http = require('http');
const fs   = require('fs');
const path = require('path');

// Load .env.local (created by "vercel env pull .env.local")
try {
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    });
    console.log('Loaded .env.local');
  } else {
    console.warn('.env.local not found — run "vercel env pull .env.local" first');
  }
} catch (e) {
  console.warn('Could not load .env.local:', e.message);
}

const aiAdvisor = require('../api/ai-advisor');

http.createServer((req, res) => {
  if (req.url === '/api/ai-advisor' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try { req.body = JSON.parse(body); } catch (_) { req.body = {}; }
      await aiAdvisor(req, res);
    });
  } else {
    res.writeHead(404).end('Not found');
  }
}).listen(3001, () => console.log('API dev server → http://localhost:3001'));
