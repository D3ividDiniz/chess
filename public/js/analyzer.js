import { Chess } from '/vendor/chess.js';
import { configure, search } from './engine.js';
import { winPercent, classify, accuracy, tiers } from './classifier.js';

function cleanPgn(pgn) {
  return String(pgn || '')
    .replace(/\{\s*\[%[^}]*\]\s*\}/g, '')
    .replace(/\[%[^\]]*\]/g, '')
    .replace(/\uFEFF/g, '')
    .trim();
}

export function pgnGame(pgn, id) {
  const chess = new Chess();
  try { chess.loadPgn(cleanPgn(pgn), { strict: false }); }
  catch { throw new Error('Não consegui ler este PGN. Confira a partida e tente novamente.'); }
  const history = chess.history({ verbose: true });
  if (!history.length) throw new Error('Esta partida não tem lances válidos para analisar.');
  const replay = new Chess();
  const moves = history.map(move => {
    const before = replay.fen();
    const played = replay.move(move);
    return {
      san: played.san,
      uci: `${move.from}${move.to}${move.promotion || ''}`,
      before,
      after: replay.fen(),
      color: move.color,
      capture: Boolean(move.captured),
      pawn: move.piece === 'p',
    };
  });
  const headers = chess.getHeaders();
  const mate = chess.isCheckmate();
  return {
    id, pgn: cleanPgn(pgn), headers, moves,
    result: headers.Result || (mate ? (chess.turn() === 'w' ? '0-1' : '1-0') : '*'),
    white: headers.White || 'Brancas', black: headers.Black || 'Pretas',
    whiteRating: headers.WhiteElo || null, blackRating: headers.BlackElo || null,
    date: headers.Date || new Date().toISOString().slice(0, 10), timeControl: headers.TimeControl || '—',
  };
}

function material(fen, color) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return new Chess(fen).board().flat().reduce((total, piece) => total + (piece ? (piece.color === color ? 1 : -1) * values[piece.type] : 0), 0);
}

function scoreToWhite(fen, info) {
  const raw = info?.kind === 'mate' ? (info.value > 0 ? 1000 : -1000) : (info?.value || 0);
  return fen.split(' ')[1] === 'w' ? raw : -raw;
}

function mateWinner(fen, info) {
  if (info?.kind !== 'mate') return null;
  const sideToMove = fen.split(' ')[1];
  return info.value > 0 ? sideToMove : sideToMove === 'w' ? 'b' : 'w';
}

function sideWin(whiteScore, color) {
  const whiteWin = winPercent(whiteScore);
  return color === 'w' ? whiteWin : 100 - whiteWin;
}

export async function analyze(game, depth, onProgress = () => {}) {
  const losses = { w: [], b: [] }, evals = [], bestMoves = [], tags = [];
  await configure({ skill: 20, elo: 2800 });
  const initial = await search(game.moves[0].before, { depth });
  let before = { whiteCp: scoreToWhite(game.moves[0].before, initial.info), best: initial.best, mateWinner: mateWinner(game.moves[0].before, initial.info) };
  evals.push(before.whiteCp);
  onProgress(0, game.moves.length);
  for (let index = 0; index < game.moves.length; index += 1) {
    const move = game.moves[index];
    const afterSearch = await search(move.after, { depth });
    const afterWhiteCp = scoreToWhite(move.after, afterSearch.info);
    const beforeWin = sideWin(before.whiteCp, move.color);
    const afterWin = sideWin(afterWhiteCp, move.color);
    const loss = Math.max(0, beforeWin - afterWin);
    const replyFen = game.moves[index + 1]?.after || move.after;
    const sacrifice = material(move.before, move.color) - material(replyFen, move.color) > 0;
    const preservesWinningMate = afterSearch.info?.kind === 'mate' && afterSearch.info.value < 0;
    const forcedMateMiss = before.mateWinner === move.color && !preservesWinningMate;
    const category = classify({
      loss, bestMatch: move.uci === before.best, beforeWin, afterWin,
      sacrifice, pawn: move.pawn, forcedMateMiss,
    });
    tags.push({ category, symbol: tiers[category].symbol, tone: tiers[category].tone, loss: Number(loss.toFixed(1)) });
    losses[move.color].push(loss);
    evals.push(afterWhiteCp);
    bestMoves.push(before.best);
    before = { whiteCp: afterWhiteCp, best: afterSearch.best, mateWinner: mateWinner(move.after, afterSearch.info) };
    onProgress(index + 1, game.moves.length);
  }
  return {
    ...game,
    analysis: {
      depth, evals, bestMoves, tags,
      whiteAccuracy: accuracy(losses.w), blackAccuracy: accuracy(losses.b),
      analyzedAt: new Date().toISOString(),
    },
  };
}
