import { Chess } from '/vendor/chess.js';
import { configure, search, stop } from './engine.js';
import { pgnGame } from './analyzer.js';
import { pieceSvg } from './pieces.js';
import { runExclusive } from './busy.js';

const $ = selector => document.querySelector(selector);
const difficulties = {
  capivara: { name: 'Capivara', skill: 0, elo: 800, depth: 5, think: [650, 900] },
  cavalomadeira: { name: 'Cavalo de Madeira', skill: 4, elo: 1100, depth: 6, think: [600, 850] },
  bispotatico: { name: 'Bispo Tático', skill: 8, elo: 1500, depth: 8, think: [520, 760] },
  torredeaco: { name: 'Torre de Aço', skill: 13, elo: 2000, depth: 10, think: [450, 680] },
  reidafloresta: { name: 'Rei da Floresta', skill: 20, elo: 2800, depth: 14, think: [400, 560] },
};
let game = new Chess(), human = 'w', orientation = 'w', selected = null, legal = [], lastMove = null;
let clockBase = 600, increment = 0, remaining = { w: 600, b: 600 }, clockTimer = null;
let phase = 'idle', session = 0, moveList = [], lastPlayed = null, config = difficulties.bispotatico, engineTurnActive = false;
let finishedCallback = () => {}, analyzeCallback = () => {};
let audioContext = null;

export const isActive = () => phase === 'human' || phase === 'engine';

function delay(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }
function ensureAudio() { const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return null; audioContext ||= new Context(); if (audioContext.state === 'suspended') audioContext.resume().catch(() => {}); return audioContext; }
function tickSound(kind) { try { const ctx = ensureAudio(); if (!ctx) return; const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = kind === 'end' ? 880 : kind === 'check' ? 740 : kind === 'capture' ? 290 : 440; gain.gain.setValueAtTime(.045, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .09); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .1); } catch {} }
function formatClock(seconds) { if (!clockBase) return '∞'; const value = Math.max(0, Math.floor(seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }

function syncNames() {
  $('#black-name').textContent = human === 'b' ? 'Você' : 'Stockfish';
  $('#white-name').textContent = human === 'w' ? 'Você' : 'Stockfish';
  const area = $('.play-board-area'), board = $('#play-board');
  const blackRow = $('#black-clock').closest('.clock-row'), whiteRow = $('#white-clock').closest('.clock-row');
  area.insertBefore(human === 'w' ? blackRow : whiteRow, board);
  area.append(human === 'w' ? whiteRow : blackRow);
}

function draw() {
  const host = $('#play-board');
  host.replaceChildren();
  const matrix = game.board();
  for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
    const square = document.createElement('div');
    square.className = `square ${(row + col) % 2 ? 'dark' : 'light'}`;
    const name = orientation === 'w' ? 'abcdefgh'[col] + (8 - row) : 'abcdefgh'[7 - col] + (row + 1);
    square.dataset.square = name;
    const piece = matrix[orientation === 'w' ? row : 7 - row][orientation === 'w' ? col : 7 - col];
    if (piece) {
      const visual = document.createElement('span');
      visual.className = 'piece';
      visual.innerHTML = pieceSvg(piece);
      square.append(visual);
      square.draggable = phase === 'human' && piece.color === human && game.turn() === human;
      square.ondragstart = event => { selected = name; legal = game.moves({ square: name, verbose: true }).map(move => move.to); event.dataTransfer.setData('text/plain', name); };
      square.ondragover = event => event.preventDefault();
      square.ondrop = event => { event.preventDefault(); prepareMove(event.dataTransfer.getData('text/plain'), name); };
    }
    if (selected === name) square.classList.add('selected-square');
    if (legal.includes(name)) square.classList.add(game.get(name) ? 'capture' : 'legal');
    if (lastMove && (name === lastMove.from || name === lastMove.to)) square.classList.add(name === lastMove.from ? 'last-from' : 'last-to');
    square.onclick = () => clickSquare(name);
    host.append(square);
  }
  $('#play-moves').textContent = moveList.slice(-14).join('   ');
  $('#white-clock').textContent = formatClock(remaining.w); $('#black-clock').textContent = formatClock(remaining.b);
  $('#white-clock').classList.toggle('active-clock', phase !== 'finished' && game.turn() === 'w');
  $('#black-clock').classList.toggle('active-clock', phase !== 'finished' && game.turn() === 'b');
}

function recordMove(move) { moveList.push(`${Math.ceil(game.history().length / 2)}${move.color === 'w' ? '.' : '...'} ${move.san}`); lastMove = { from: move.from, to: move.to }; }
function clickSquare(name) {
  if (phase !== 'human' || game.turn() !== human) return;
  if (selected && legal.includes(name)) { prepareMove(selected, name); return; }
  const piece = game.get(name);
  if (piece?.color === human) { selected = name; legal = game.moves({ square: name, verbose: true }).map(move => move.to); } else { selected = null; legal = []; }
  draw();
}
function prepareMove(from, to) {
  if (phase !== 'human' || !from || !to) return;
  const move = game.move({ from, to, promotion: 'q' });
  if (!move) return;
  selected = null; legal = []; recordMove(move); afterMove(move);
}
function afterMove(move) {
  remaining[move.color] += increment;
  tickSound(game.isCheck() ? 'check' : move.captured ? 'capture' : 'move');
  if (game.isGameOver()) { finish(game.isCheckmate() ? `${move.color === 'w' ? '1-0' : '0-1'} · Xeque-mate` : '½-½ · Empate'); return; }
  const engineToMove = game.turn() !== human;
  phase = engineToMove ? 'engine' : 'human';
  $('#play-status').textContent = engineToMove ? `${config.name} pensando…` : 'Sua vez';
  draw();
  if (engineToMove) engineTurn();
}

async function engineTurn() {
  if (phase !== 'engine' || engineTurnActive) return;
  engineTurnActive = true;
  const turnSession = session;
  $('#play-status').textContent = `${config.name} pensando…`;
  draw();
  const [minimum, maximum] = config.think;
  try {
    await runExclusive(async () => {
      await delay(minimum + Math.round(Math.random() * (maximum - minimum)));
      if (turnSession !== session || phase !== 'engine') return;
      try {
        const response = await search(game.fen(), { depth: config.depth });
        if (turnSession !== session || phase !== 'engine') return;
        if (!response.best) throw new Error('Stockfish não encontrou um lance legal.');
        const move = game.move({ from: response.best.slice(0, 2), to: response.best.slice(2, 4), promotion: response.best[4] || 'q' });
        if (!move) throw new Error('Stockfish retornou um lance inválido.');
        recordMove(move);
        afterMove(move);
      } catch (error) {
        if (turnSession !== session || phase === 'finished') return;
        $('#play-status').textContent = error.message;
        finish('Engine indisponível');
      }
    }, `${config.name} pensando…`);
  } finally {
    engineTurnActive = false;
  }
}

function finish(label) {
  if (phase === 'finished' || phase === 'idle') return;
  phase = 'finished'; clearInterval(clockTimer); stop(); tickSound('end');
  $('#play-status').textContent = label; $('#result-title').textContent = label; $('#post-game').hidden = false;
  const result = label.startsWith('1-0') ? '1-0' : label.startsWith('0-1') ? '0-1' : label.startsWith('½-½') ? '1/2-1/2' : '*';
  game.header('Event', 'Peleleca vs Stockfish', 'Site', 'Peleleca', 'Date', new Date().toISOString().slice(0, 10).replaceAll('-', '.'));
  game.header('White', human === 'w' ? 'Você' : 'Stockfish', 'Black', human === 'b' ? 'Você' : 'Stockfish', 'Result', result);
  if (clockBase) game.header('TimeControl', `${Math.floor(clockBase)}+${increment}`);
  lastPlayed = pgnGame(game.pgn(), `local-${crypto.randomUUID()}`); lastPlayed.result = result; finishedCallback(lastPlayed); draw();
}
function runClock() { clearInterval(clockTimer); clockTimer = setInterval(() => { if (!isActive() || clockBase === 0) return; remaining[game.turn()] -= 1; if (remaining[game.turn()] <= 0) { remaining[game.turn()] = 0; finish(game.turn() === 'w' ? '0-1 · Tempo esgotado' : '1-0 · Tempo esgotado'); } draw(); }, 1000); }

async function begin() {
  const side = $('#setup-side').value; human = side === 'random' ? (Math.random() < .5 ? 'w' : 'b') : side;
  config = difficulties[$('#setup-level').value] || difficulties.capivara;
  const controls = { 0: [0, 0], 1: [60, 0], 2: [120, 1], 3: [180, 0], 4: [180, 2], 5: [300, 0], 6: [600, 0], 7: [900, 10] };
  [clockBase, increment] = controls[$('#setup-time').value] || [600, 0]; remaining = { w: clockBase, b: clockBase };
  session += 1; phase = 'idle'; engineTurnActive = false; orientation = human; game = new Chess(); moveList = []; lastMove = null; selected = null; legal = []; lastPlayed = null;
  $('#post-game').hidden = true; syncNames(); $('#play-status').textContent = 'Preparando Stockfish…'; draw();
  try { await configure({ skill: config.skill, elo: config.elo }); }
  catch (error) { $('#play-status').textContent = error.message; return; }
  phase = game.turn() === human ? 'human' : 'engine'; $('#play-status').textContent = phase === 'human' ? 'Sua vez' : `${config.name} começa`; draw(); runClock();
}

export function initPlay({ onFinished = () => {}, onAnalyze = () => {} } = {}) {
  finishedCallback = onFinished; analyzeCallback = onAnalyze; draw();
  $('#setup-form').onsubmit = event => { event.preventDefault(); try { ensureAudio(); } catch {} $('#setup-dialog').close(); runExclusive(begin, 'Preparando partida…').then(() => { if (phase === 'engine') engineTurn(); }).catch(error => { $('#play-status').textContent = error.message; }); };
  $('#close-setup').onclick = () => $('#setup-dialog').close();
  $('#flip-play').onclick = () => { orientation = orientation === 'w' ? 'b' : 'w'; draw(); };
  $('#resign').onclick = () => { if (isActive()) finish(human === 'w' ? '0-1 · Você desistiu' : '1-0 · Você desistiu'); };
  $('#offer-draw').onclick = () => { if (!isActive()) return; if (game.isDraw()) finish('½-½ · Empate'); else { $('#play-status').textContent = 'Empate recusado'; setTimeout(() => { if (phase === 'human') $('#play-status').textContent = 'Sua vez'; }, 1200); } };
  $('#takeback').onclick = () => { if (!isActive() || phase === 'engine' || !game.history().length) return; const first = game.undo(); const second = game.turn() !== human ? game.undo() : null; if (first || second) { moveList = game.history().map((san, index) => `${Math.floor(index / 2) + 1}${index % 2 ? '...' : '.'} ${san}`); lastMove = null; selected = null; legal = []; draw(); } };
  $('#analyze-played').onclick = () => { if (lastPlayed) analyzeCallback(lastPlayed); };
}
