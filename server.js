const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});
app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'peleleca' }));
app.get('/api/chess/:username/games/archives', async (req, res) => {
  try {
    const upstream = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(req.params.username)}/games/archives`, { headers: { 'User-Agent': 'Peleleca Chess Studio (personal game review)' } });
    res.status(upstream.status).type('json').send(await upstream.text());
  } catch { res.status(502).json({ error: 'Chess.com não respondeu. Tente novamente.' }); }
});
app.get('/api/chess/:username/games/:year/:month', async (req, res) => {
  try {
    const { username, year, month } = req.params;
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || +month < 1 || +month > 12) return res.status(400).json({ error: 'Data inválida.' });
    const upstream = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${year}/${month}`, { headers: { 'User-Agent': 'Peleleca Chess Studio (personal game review)' } });
    res.status(upstream.status).type('json').send(await upstream.text());
  } catch { res.status(502).json({ error: 'Chess.com não respondeu. Tente novamente.' }); }
});
app.use('/vendor', express.static(path.join(__dirname, 'public', 'vendor'), { maxAge: '1d' }));
app.use(express.static(publicDir, { extensions: ['html'] }));
app.get('*path', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const stockfishSource = path.join(__dirname, 'node_modules', 'stockfish');
const stockfishTarget = path.join(publicDir, 'vendor', 'stockfish');
if (fs.existsSync(stockfishSource)) {
  fs.mkdirSync(stockfishTarget, { recursive: true });
  for (const file of fs.readdirSync(path.join(stockfishSource, 'src'))) {
    if (/stockfish-nnue-16-single\.(js|wasm)$/i.test(file)) fs.copyFileSync(path.join(stockfishSource, 'src', file), path.join(stockfishTarget, file));
  }
  for (const file of ['license.txt', 'Copying.txt']) {
    const source = path.join(stockfishSource, file);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(stockfishTarget, file));
  }
}
fs.mkdirSync(path.join(publicDir, 'vendor'), { recursive: true });
const chessModule = path.join(__dirname, 'node_modules', 'chess.js', 'dist', 'esm', 'chess.js');
if (fs.existsSync(chessModule)) fs.copyFileSync(chessModule, path.join(publicDir, 'vendor', 'chess.js'));

app.listen(port, '0.0.0.0', () => console.log(`Peleleca running on ${port}`));
