const fs = require('fs');
const path = require('path');

const VERIFY_URL = 'https://chedex.app/api/launcher/verify';
const SITE_URL = 'https://chedex.app/launcher';
const GRACE = 72 * 60 * 60 * 1000; // sin conexión se puede seguir usando hasta 72 h tras la última comprobación
const RECHECK = 4 * 60 * 60 * 1000;

// Decide si se puede usar el launcher. result: 'valid' | 'invalid' | 'error' (sin conexión o fallo del servidor).
function decide({ token, result, lastOk }, now) {
  if (!token) return { state: 'locked', reason: 'none' };
  if (result === 'valid') return { state: 'ok' };
  if (result === 'invalid') return { state: 'locked', reason: 'revoked' };
  return lastOk && now - lastOk < GRACE ? { state: 'ok', offline: true } : { state: 'locked', reason: 'offline' };
}

async function verifyRemote(token, fetchFn = fetch) {
  try {
    const r = await fetchFn(VERIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(10000) });
    if (r.ok) { const j = await r.json(); return { result: 'valid', username: String(j.username || '') }; }
    return { result: r.status === 401 ? 'invalid' : 'error' };
  } catch { return { result: 'error' }; }
}

// Guarda el código vinculado en la carpeta de datos del usuario (cifrado si el sistema lo permite).
function createAccess({ file, safeStorage, send, fetchFn = fetch, now = Date.now }) {
  let saved = { token: '', username: '', lastOk: 0 };
  let status = { state: 'locked', reason: 'none', username: '', codeHint: '' };
  let lastCheck = 0;

  const load = () => {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      let token = raw.token || '';
      if (raw.enc && token) token = safeStorage.decryptString(Buffer.from(token, 'base64'));
      saved = { token, username: raw.username || '', lastOk: Number(raw.lastOk) || 0 };
    } catch { saved = { token: '', username: '', lastOk: 0 }; }
  };
  const persist = () => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const enc = !!(saved.token && safeStorage && safeStorage.isEncryptionAvailable());
      fs.writeFileSync(file, JSON.stringify({ token: enc ? safeStorage.encryptString(saved.token).toString('base64') : saved.token, enc, username: saved.username, lastOk: saved.lastOk }));
    } catch (e) { console.warn('Access:', e.message); }
  };
  const apply = (next) => {
    const changed = next.state !== status.state || next.reason !== status.reason;
    status = { ...next, username: saved.username, codeHint: saved.token.slice(-4) }; // nunca el token completo al renderer
    if (changed && send) send(status);
  };

  async function recheck() {
    lastCheck = now();
    if (!saved.token) return apply(decide({ token: '' }, now()));
    const r = await verifyRemote(saved.token, fetchFn);
    if (r.result === 'valid') { saved.username = r.username; saved.lastOk = now(); persist(); }
    if (r.result === 'invalid') { saved = { token: '', username: '', lastOk: 0 }; persist(); return apply({ state: 'locked', reason: 'revoked' }); }
    apply(decide({ token: saved.token, result: r.result, lastOk: saved.lastOk }, now()));
  }

  return {
    status: () => status,
    init: async () => { load(); await recheck(); setInterval(recheck, RECHECK).unref(); },
    // al volver a la ventana, se vuelve a comprobar si han pasado más de 10 min
    onFocus: () => { if (now() - lastCheck > 10 * 60 * 1000) recheck(); },
    link: async (code) => {
      const token = String(code || '').trim();
      if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) return { ok: false, error: 'El código no es válido.' };
      const r = await verifyRemote(token, fetchFn);
      if (r.result === 'invalid') return { ok: false, error: 'Código no válido o sin acceso. Genera uno nuevo en chedex.app/launcher.' };
      if (r.result === 'error') return { ok: false, error: 'No se ha podido conectar con Chedex. Inténtalo de nuevo.' };
      saved = { token, username: r.username, lastOk: now() };
      persist();
      apply({ state: 'ok' });
      return { ok: true };
    },
    unlink: () => { saved = { token: '', username: '', lastOk: 0 }; persist(); apply({ state: 'locked', reason: 'none' }); },
  };
}

module.exports = { decide, createAccess, verifyRemote, SITE_URL };
