const assert = require('assert');
const L = require('../src/tools/teleprompter/renderer/logic.js');

assert.strictEqual(L.clampSpeed(5), L.MIN_SPEED);
assert.strictEqual(L.clampSpeed(9999), L.MAX_SPEED);
assert.strictEqual(L.stepSpeed(100, 1), 110);
assert.strictEqual(L.stepSpeed(100, -1), 90);
assert.strictEqual(L.stepSpeed(L.MIN_SPEED, -1), L.MIN_SPEED);
assert.deepStrictEqual(L.advance(0, 100, 0.5, 1000), { pos: 50, done: false });
assert.deepStrictEqual(L.advance(990, 100, 0.5, 1000), { pos: 1000, done: true });

// Tablero a vídeo: lógica pura del renderer.
const B = require('../src/tools/board-video/renderer/logic.js');
assert.strictEqual(B.gameIdFromLink('https://lichess.org/AbCdEfGh'), 'AbCdEfGh');
assert.strictEqual(B.gameIdFromLink('https://lichess.org/AbCdEfGh/black'), 'AbCdEfGh');
assert.strictEqual(B.gameIdFromLink('https://lichess.org/AbCdEfGhIjKl'), 'AbCdEfGh');
assert.strictEqual(B.gameIdFromLink('mira esto https://lichess.org/AbCdEfGh!'), 'AbCdEfGh');
assert.strictEqual(B.gameIdFromLink('hola'), null);
assert.strictEqual(B.gameIdFromLink(''), null);
assert.deepStrictEqual(B.clampRange(40, 3, 5), { startPly: 4, endPly: 10 });
for (const [a, b] of [[5, 3], ['x', 2], ['', ''], [0, 3], [30, 35]]) {
  assert.deepStrictEqual(B.clampRange(40, a, b), { startPly: 0, endPly: 40 }, `rango ${a}-${b}`);
}
assert.deepStrictEqual(B.clampRange(40, 3, 999), { startPly: 4, endPly: 40 });
const one = { startPly: 0, endPly: 1, perMove: 1.2, holdSec: 0.6, slideSec: 0.3, outroSec: 2 };
assert.ok(Math.abs(B.durationOf(one) - 3.8) < 1e-9);
assert.strictEqual(B.frameAt(0, one).phase, 'hold');
const f = B.frameAt(0.7, one);
assert.deepStrictEqual([f.phase, f.ply], ['moves', 1]);
assert.ok(Math.abs(f.progress - 1 / 3) < 0.01);
assert.deepStrictEqual(B.frameAt(B.durationOf(one), one), { phase: 'outro', ply: 1, progress: 1 });
const tramo = { ...one, startPly: 4, endPly: 5 }; // tramo de una sola jugada
assert.ok(B.durationOf(tramo) > 0);
assert.strictEqual(B.frameAt(0.7, tramo).ply, 5);

// Tablero a vídeo: PGN y descarga de Lichess (proceso principal).
const P = require('../src/tools/board-video/pgn.js');
const g = P.parsePgn('[White "Ana"]\n[Black "Luis"]\n[WhiteElo "1800"]\n[BlackElo "1750"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 *');
assert.deepStrictEqual(g.moves.map((m) => [m.san, m.from, m.to]), [['e4', 'e2', 'e4'], ['e5', 'e7', 'e5'], ['Nf3', 'g1', 'f3'], ['Nc6', 'b8', 'c6']]);
assert.deepStrictEqual(g.headers, { white: 'Ana', black: 'Luis', whiteElo: '1800', blackElo: '1750', result: '*' });
assert.ok(g.startFen.startsWith('rnbqkbnr/pppppppp'));
assert.ok(g.moves[3].fen.startsWith('r1bqkbnr/pppp1ppp/2n5'));
assert.throws(() => P.parsePgn(''), /PGN/);
assert.throws(() => P.parsePgn('1. e4 e5 2. Ke4'), /PGN/);
(async () => {
  const fake = (r) => async (url, opts) => {
    assert.strictEqual(url, 'https://lichess.org/game/export/AbCdEfGh');
    assert.strictEqual(opts.headers['User-Agent'], 'chedex.app (Launcher)');
    if (r === 'red') throw new Error('ECONNRESET');
    return r;
  };
  await assert.rejects(P.fetchLichessPgn('AbCdEfGh', fake({ ok: false, status: 404 })), { message: 'Esa partida no existe o es privada.' });
  await assert.rejects(P.fetchLichessPgn('AbCdEfGh', fake('red')), { message: 'No se pudo conectar con Lichess.' });
  await assert.rejects(P.fetchLichessPgn('AbCdEfGh', fake({ ok: false, status: 500 })), /Lichess/);
  assert.strictEqual(await P.fetchLichessPgn('AbCdEfGh', fake({ ok: true, status: 200, text: async () => '1. e4 *' })), '1. e4 *');
  console.log('pgn OK');
})().catch((e) => { console.error(e); process.exit(1); });
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
  const valid = reply, code = 'a'.repeat(39) + 'WXYZ';
  assert.strictEqual((await acc.link('corto')).ok, false);
  assert.strictEqual((await acc.link(code)).ok, true);
  assert.strictEqual(acc.status().state, 'ok');
  assert.strictEqual(acc.status().codeHint, 'WXYZ', 'solo los últimos 4 caracteres');
  reply = { ok: false, status: 401, json: async () => ({ valid: false }) };
  await acc.init();
  assert.deepStrictEqual([acc.status().state, acc.status().reason], ['locked', 'revoked']);
  assert.strictEqual(acc.status().codeHint, '');
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).token, '', 'el código revocado se borra');
  assert.deepStrictEqual(events, ['ok', 'locked']);
  reply = valid;
  await acc.link(code);
  acc.unlink();
  assert.deepStrictEqual([acc.status().state, acc.status().codeHint], ['locked', '']);
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

// Estudios de Lichess: enlace de capítulo, comentarios y tiempos por jugada.
assert.deepStrictEqual(B.studyFromLink('https://lichess.org/study/AbCdEfGh/IjKlMnOp#12'), { studyId: 'AbCdEfGh', chapterId: 'IjKlMnOp' });
assert.deepStrictEqual(B.studyFromLink('https://lichess.org/study/AbCdEfGh'), { studyId: 'AbCdEfGh', chapterId: null });
assert.strictEqual(B.studyFromLink('https://lichess.org/AbCdEfGh'), null);
assert.strictEqual(B.gameIdFromLink('https://lichess.org/study/AbCdEfGh/IjKlMnOp'), null);
assert.strictEqual(B.readSec(''), 0);
assert.strictEqual(B.readSec('uno dos tres'), 2.5);
assert.strictEqual(B.readSec(Array(100).fill('a').join(' ')), 12);
const cm = P.parsePgn('[Event "x"]\n\n{ Intro del capítulo. } 1. e4 { Centro. [%cal Ge2e4] } e5 2. Nf3 *');
assert.strictEqual(cm.intro, 'Intro del capítulo.');
assert.deepStrictEqual(cm.moves.map((m) => m.comment), ['Centro.', '', '']);
// Lichess deja dos comentarios seguidos tras una jugada (texto + [%csl]): antes rompía la carga.
const two = P.parsePgn('[Event "x"]\n\n{ Intro. } 1. e4 { Texto largo. } { [%csl Ge4] } c6 *');
assert.strictEqual(two.intro, 'Intro.');
assert.strictEqual(two.moves[0].comment, 'Texto largo.');
const sc = { startPly: 0, endPly: 2, perMove: 1, holdSec: 0.5, slideSec: 0.3, outroSec: 1, durations: [4, 1] };
assert.strictEqual(B.durationOf(sc), 6.5);
assert.strictEqual(B.frameAt(3, sc).ply, 1); // aún en la jugada con comentario
assert.strictEqual(B.frameAt(4.6, sc).ply, 2);
(async () => {
  let seen;
  const ok = async (url) => { seen = url; return { ok: true, status: 200, text: async () => 'pgn' }; };
  assert.strictEqual(await P.fetchStudyPgn('AbCdEfGh', 'IjKlMnOp', ok), 'pgn');
  assert.ok(seen.startsWith('https://lichess.org/api/study/AbCdEfGh/IjKlMnOp.pgn?') && seen.includes('comments=true'));
  await assert.rejects(P.fetchStudyPgn('AbCdEfGh', 'IjKlMnOp', async () => ({ ok: false, status: 404 })), /estudio/);
  console.log('study OK');
})().catch((e) => { console.error(e); process.exit(1); });

// Carrusel: lógica pura y validación de posiciones.
const C = require('../src/tools/carousel/renderer/logic.js');
const { finalFen } = require('../src/tools/carousel/position.js');
const meas = (s, z) => s.length * z / 2;
assert.deepStrictEqual(C.fitText('hola mundo', meas, 200, [[40, 2], [30, 2]]), { size: 40, lines: ['hola mundo'] });
const longFit = C.fitText(Array(50).fill('palabra').join(' '), meas, 400, [[20, 3]]); // 399 caracteres
assert.strictEqual(longFit.lines.length, 3);
assert.ok(longFit.lines[2].endsWith('…'));
assert.ok(longFit.lines.every((l) => meas(l, 20) <= 400));
const wordFit = C.fitText('a'.repeat(80), meas, 200, [[20, 10]]);
assert.ok(wordFit.lines.length > 1 && wordFit.lines.every((l) => meas(l, 20) <= 200));
assert.strictEqual(wordFit.lines.join(''), 'a'.repeat(80));
const wide = C.coverRect(2000, 1000, 1080, 1440);
assert.strictEqual(wide.sh, 1000);
assert.ok(Math.abs(wide.sw / wide.sh - 1080 / 1440) < 1e-9);
assert.ok(Math.abs(wide.sx - (2000 - wide.sw) / 2) < 1e-9 && wide.sy === 0);
const tiny = C.coverRect(100, 100, 1080, 1440);
assert.ok(Math.abs(tiny.sw / tiny.sh - 1080 / 1440) < 1e-9 && tiny.sh === 100 && tiny.sw <= 100);
assert.strictEqual(C.fileName(0), 'carrusel-1.png');
assert.strictEqual(C.fileName(4), 'carrusel-5.png');
assert.strictEqual(C.isImageFile('a.gif', 'image/gif'), false);
assert.strictEqual(C.isImageFile('a.png', 'image/png'), true);
assert.strictEqual(C.ROLES.length, 5);
assert.strictEqual(C.HINTS.length, 5);
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
assert.strictEqual(finalFen(START), START);
assert.strictEqual(finalFen('1. e4 e5'), 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'); // chess.js 1.x omite el al paso sin captura posible
assert.throws(() => finalFen('zzz'));
assert.throws(() => finalFen(''));

// Carrusel: datos del launcher (src/tools/index.js necesita Electron).
const CM = require('../src/tools/carousel/manifest');
assert.strictEqual(CM.id, 'carousel');
assert.strictEqual(CM.features.length, 4);
assert.ok(CM.preview.startsWith('<svg') && CM.icon.startsWith('<svg'));

console.log('logic OK');
