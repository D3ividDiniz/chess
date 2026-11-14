export const tiers = {
  Brilhante: { symbol: '!!', tone: 'brilliant' },
  Excelente: { symbol: '!', tone: 'excellent' },
  'Muito Bom': { symbol: '✓', tone: 'very-good' },
  Bom: { symbol: '·', tone: 'good' },
  Imprecisão: { symbol: '?!', tone: 'inaccuracy' },
  Erro: { symbol: '?', tone: 'mistake' },
  'Erro Grave': { symbol: '??', tone: 'blunder' },
};

export function winPercent(cp) {
  const score = Number.isFinite(cp) ? cp : 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * score)) - 1);
}

export function classify({ loss, bestMatch, beforeWin, afterWin, sacrifice, pawn, forcedMateMiss }) {
  if (forcedMateMiss || loss > 20) return 'Erro Grave';
  if (sacrifice && !pawn && loss <= 2.5 && beforeWin < 92) return 'Brilhante';
  if (bestMatch && beforeWin < 92 && afterWin - beforeWin > 5) return 'Excelente';
  if (bestMatch || loss <= 1.25) return 'Muito Bom';
  if (loss <= 5) return 'Bom';
  if (loss <= 10) return 'Imprecisão';
  if (loss <= 20) return 'Erro';
  return 'Erro Grave';
}

export function accuracy(losses) {
  if (!losses.length) return 100;
  const average = losses.reduce((sum, loss) => sum + Math.max(0, loss), 0) / losses.length;
  return Math.max(0, Math.min(100, Math.round(100 * Math.exp(-average / 23))));
}
