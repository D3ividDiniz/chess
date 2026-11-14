let active = 0;
let current = null;

function publish(message = '') {
  document.body.dataset.busy = active > 0 ? 'true' : 'false';
  document.dispatchEvent(new CustomEvent('peleleca:busy', { detail: { active: active > 0, message } }));
}

export function runExclusive(task, message = 'Processando…') {
  if (current) return current;
  active += 1;
  publish(message);
  current = Promise.resolve().then(task).finally(() => {
    active = Math.max(0, active - 1);
    current = null;
    publish();
  });
  return current;
}

export function isBusy() { return active > 0; }
