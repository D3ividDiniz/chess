const KEY = 'peleleca_data_v1';
const empty = () => ({ version: 1, games: [] });

export function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...empty(), ...saved, games: Array.isArray(saved.games) ? saved.games : [] };
  } catch {
    return empty();
  }
}

export function get(id) {
  return read().games.find(game => game.id === id);
}

export function save(game) {
  if (!game?.id || !Array.isArray(game.moves)) throw new Error('A partida não está completa para salvar.');
  const db = read();
  const index = db.games.findIndex(item => item.id === game.id);
  const saved = { ...game, updatedAt: new Date().toISOString() };
  if (index < 0) db.games.unshift(saved);
  else db.games[index] = saved;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    throw new Error('O armazenamento do navegador está cheio. Exporte a biblioteca e remova partidas antigas.');
  }
}

export function remove(id) {
  const db = read();
  db.games = db.games.filter(game => game.id !== id);
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function clear() {
  localStorage.removeItem(KEY);
}

export function exportData() {
  const blob = new Blob([JSON.stringify(read(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `peleleca-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function importData(file) {
  if (!file) throw new Error('Selecione um arquivo de backup.');
  let incoming;
  try {
    incoming = JSON.parse(await file.text());
  } catch {
    throw new Error('Não consegui ler este arquivo JSON.');
  }
  const games = Array.isArray(incoming) ? incoming : incoming?.games;
  if (!Array.isArray(games)) throw new Error('Este arquivo não parece ser um backup Peleleca.');

  const db = read();
  const byId = new Map(db.games.map((game, index) => [game.id, index]));
  let imported = 0;
  for (const game of games) {
    if (!game?.id || typeof game.pgn !== 'string' || !Array.isArray(game.moves)) continue;
    const index = byId.get(game.id);
    if (index === undefined) {
      byId.set(game.id, db.games.length);
      db.games.push(game);
    } else {
      db.games[index] = game;
    }
    imported += 1;
  }

  try {
    localStorage.setItem(KEY, JSON.stringify({ ...empty(), games: db.games }));
  } catch {
    throw new Error('O backup excede o espaço disponível neste navegador. Remova partidas antigas e tente novamente.');
  }
  return imported;
}

export function usage() {
  return new Blob([JSON.stringify(read())]).size;
}
