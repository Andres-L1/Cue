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

console.log('logic OK');
