const assert = require('assert');
const L = require('../src/tools/teleprompter/renderer/logic.js');

assert.strictEqual(L.clampSpeed(5), L.MIN_SPEED);
assert.strictEqual(L.clampSpeed(9999), L.MAX_SPEED);
assert.strictEqual(L.stepSpeed(100, 1), 110);
assert.strictEqual(L.stepSpeed(100, -1), 90);
assert.strictEqual(L.stepSpeed(L.MIN_SPEED, -1), L.MIN_SPEED);
assert.deepStrictEqual(L.advance(0, 100, 0.5, 1000), { pos: 50, done: false });
assert.deepStrictEqual(L.advance(990, 100, 0.5, 1000), { pos: 1000, done: true });
const { decide, createAccess } = require('../src/access');
const H = 3600 * 1000, NOW = 1e12;
assert.strictEqual(decide({ token: '' }, NOW).state, 'locked');
assert.strictEqual(decide({ token: 't', result: 'valid' }, NOW).state, 'ok');
assert.deepStrictEqual(decide({ token: 't', result: 'invalid', lastOk: NOW }, NOW), { state: 'locked', reason: 'revoked' });
assert.strictEqual(decide({ token: 't', result: 'error', lastOk: NOW - 71 * H }, NOW).state, 'ok');
assert.deepStrictEqual(decide({ token: 't', result: 'error', lastOk: NOW - 73 * H }, NOW), { state: 'locked', reason: 'offline' });
assert.strictEqual(decide({ token: 't', result: 'error', lastOk: 0 }, NOW).state, 'locked');

// Flujo completo con un servidor falso: vincular, seguir válido, revocar y quedar bloqueado.
(async () => {
  const os = require('os'), fs = require('fs'), path = require('path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cue-')), 'access.json');
  let reply = { ok: true, status: 200, json: async () => ({ valid: true, username: 'Ana' }) };
  const events = [];
  const acc = createAccess({ file, safeStorage: null, send: (s) => events.push(s.state), fetchFn: async () => { if (reply.fail) throw new Error('red'); return reply; } });
  const code = 'a'.repeat(43);
  assert.strictEqual((await acc.link('corto')).ok, false);
  assert.strictEqual((await acc.link(code)).ok, true);
  assert.strictEqual(acc.status().state, 'ok');
  reply = { ok: false, status: 401, json: async () => ({ valid: false }) };
  await acc.init();
  assert.deepStrictEqual([acc.status().state, acc.status().reason], ['locked', 'revoked']);
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).token, '', 'el código revocado se borra');
  assert.deepStrictEqual(events, ['ok', 'locked']);
  console.log('access OK');
})().catch((e) => { console.error(e); process.exit(1); });

// Flujo de actualización obligatoria con un autoUpdater falso.
(async () => {
  const { EventEmitter } = require('events');
  const { createUpdateFlow } = require('../src/update-flow');
  const make = (opts = {}) => {
    const up = new EventEmitter();
    up.calls = { check: 0, download: 0, quit: 0 };
    up.checkForUpdates = async () => { up.calls.check++; if (opts.checkFails) throw new Error('sin red'); };
    up.downloadUpdate = async () => { up.calls.download++; if (opts.downloadFails) throw new Error('descarga'); };
    up.quitAndInstall = () => { up.calls.quit++; };
    const sent = [];
    const flow = createUpdateFlow({ autoUpdater: up, send: (s) => sent.push(s) });
    return { up, sent, flow, last: () => sent[sent.length - 1] };
  };
  const tick = () => new Promise((r) => setImmediate(r));
  const warn = console.warn;
  console.warn = () => {}; // los errores fuera de la descarga solo se registran

  let t = make();
  t.up.emit('update-available', { version: '1.2.0' });
  assert.deepStrictEqual(t.sent, [{ state: 'available', version: '1.2.0' }]);

  t = make();
  t.flow.install();
  assert.strictEqual(t.up.calls.download, 1);
  assert.deepStrictEqual(t.last(), { state: 'downloading', percent: 0 });
  t.up.emit('download-progress', { percent: 41.6 });
  assert.deepStrictEqual(t.last(), { state: 'downloading', percent: 42 });
  t.up.emit('update-downloaded', { version: '1.2.0' });
  assert.strictEqual(t.up.calls.quit, 1);

  t = make(); // Review 3: doble clic
  t.flow.install(); t.flow.install();
  assert.strictEqual(t.up.calls.download, 1);

  t = make(); // Review 4: comprobación de 4 h durante la descarga
  t.flow.install();
  t.up.emit('update-available', { version: '1.2.0' });
  assert.ok(!t.sent.some((s) => s.state === 'available'));

  t = make(); // Review 1: error durante la descarga o la instalación
  t.flow.install();
  t.up.emit('error', new Error('x'));
  assert.deepStrictEqual(t.last(), { state: 'error' });
  t.flow.install();
  assert.strictEqual(t.up.calls.download, 2, 'se puede reintentar');

  t = make({ downloadFails: true }); // Review 1 bis
  t.flow.install();
  await tick();
  assert.deepStrictEqual(t.last(), { state: 'error' });

  t = make({ checkFails: true }); // Review 2: sin red al comprobar
  await t.flow.check();
  t.up.emit('error', new Error('sin red'));
  assert.strictEqual(t.up.calls.check, 1);
  assert.deepStrictEqual(t.sent, []);

  t = make(); // Review 5
  t.up.emit('update-not-available', {});
  assert.deepStrictEqual(t.sent, [{ state: 'none' }]);

  console.warn = warn;
  console.log('update OK');
})().catch((e) => { console.error(e); process.exit(1); });

console.log('logic OK');
