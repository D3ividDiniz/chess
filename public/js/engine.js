let worker = null;
let readyPromise = null;
let readyResolve = null;
let readyReject = null;
let initTimer = null;
let currentSearch = null;
let serial = Promise.resolve();
let readyWaiters = [];

function rejectSearch(error) {
  if (!currentSearch) return;
  const job = currentSearch;
  currentSearch = null;
  clearTimeout(job.timer);
  clearTimeout(job.stopTimer);
  job.reject(error);
}

function resetEngine(error) {
  clearTimeout(initTimer);
  initTimer = null;
  if (readyReject) readyReject(error);
  readyResolve = null;
  readyReject = null;
  readyWaiters.forEach(waiter => {
    clearTimeout(waiter.timer);
    waiter.reject(error);
  });
  readyWaiters = [];
  rejectSearch(error);
  worker?.terminate();
  worker = null;
  readyPromise = null;
}

function fail(message) {
  resetEngine(new Error(message));
}

function resolveReady() {
  if (readyResolve) {
    clearTimeout(initTimer);
    initTimer = null;
    readyResolve();
    readyResolve = null;
    readyReject = null;
    return;
  }
  const waiter = readyWaiters.shift();
  if (waiter) {
    clearTimeout(waiter.timer);
    waiter.resolve();
  }
}

function waitReady(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const waiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        if (readyWaiters.includes(waiter)) fail('Stockfish não confirmou as opções de força.');
      }, timeoutMs),
    };
    readyWaiters.push(waiter);
    worker.postMessage('isready');
  });
}

function boot() {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
    initTimer = setTimeout(() => fail('Stockfish demorou para iniciar. Recarregue a página e tente novamente.'), 30000);
    try {
      worker = new Worker('/vendor/stockfish/stockfish-nnue-16-single.js');
      worker.onmessage = ({ data }) => {
        const line = String(data || '').trim();
        if (line === 'uciok') {
          worker.postMessage('isready');
          return;
        }
        if (line === 'readyok') {
          resolveReady();
          return;
        }
        if (line.startsWith('info ') && currentSearch) {
          const score = line.match(/\bscore (cp|mate) (-?\d+)/);
          const pv = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (score) currentSearch.info = { kind: score[1], value: Number(score[2]), best: currentSearch.info?.best || null };
          if (pv && currentSearch.info) currentSearch.info.best = pv[1];
          return;
        }
        if (line.startsWith('bestmove ') && currentSearch) {
          const job = currentSearch;
          currentSearch = null;
          clearTimeout(job.timer);
          clearTimeout(job.stopTimer);
          const best = line.split(/\s+/)[1];
          if (job.timeoutError) job.reject(job.timeoutError);
          else job.resolve({ best: best === '(none)' ? null : best, info: { ...job.info, best: job.info?.best || (best === '(none)' ? null : best) } });
        }
      };
      worker.onerror = () => fail('Stockfish não conseguiu iniciar neste dispositivo.');
      worker.postMessage('uci');
    } catch {
      fail('Este navegador não consegue executar Stockfish.');
    }
  });
  return readyPromise;
}

function enqueue(task) {
  const next = serial.then(task, task);
  serial = next.catch(() => undefined);
  return next;
}

export function start() { return boot(); }

export function configure({ skill = 10, elo = 1800 } = {}) {
  return enqueue(async () => {
    await boot();
    worker.postMessage(`setoption name Skill Level value ${Math.max(0, Math.min(20, skill))}`);
    worker.postMessage('setoption name UCI_LimitStrength value true');
    worker.postMessage(`setoption name UCI_Elo value ${Math.max(800, Math.min(2800, elo))}`);
    worker.postMessage('setoption name MultiPV value 1');
    await waitReady();
  });
}

export function search(fen, { depth = 12, movetime = 0 } = {}) {
  return enqueue(async () => {
    await boot();
    return new Promise((resolve, reject) => {
      const timeoutMs = Math.max(60000, (movetime || depth * 5000) + 20000);
      const job = currentSearch = {
        resolve,
        reject,
        info: null,
        timeoutError: null,
        timer: setTimeout(() => {
          if (currentSearch !== job) return;
          job.timeoutError = new Error('A análise demorou demais. Tente uma profundidade menor.');
          worker.postMessage('stop');
          job.stopTimer = setTimeout(() => fail('Stockfish parou de responder.'), 8000);
        }, timeoutMs),
        stopTimer: null,
      };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(movetime ? `go movetime ${movetime}` : `go depth ${Math.max(1, Math.min(22, depth))}`);
    });
  });
}

export function stop() {
  if (!worker || !currentSearch) return;
  currentSearch.timeoutError ||= new Error('Busca interrompida.');
  worker.postMessage('stop');
  currentSearch.stopTimer ||= setTimeout(() => fail('Stockfish parou de responder.'), 8000);
}
