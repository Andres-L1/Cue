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
// Carrusel: selección, arrastre y redimensionado en la vista previa.
const near = (a, b) => Math.abs(a - b) < 1e-9;
const rects = { photo: { x: 0, y: 0, w: 1080, h: 1440 }, text: { x: 90, y: 400, w: 900, h: 200, scale: 1 }, board: { x: 200, y: 500, w: 600, h: 600 } };
assert.deepStrictEqual(C.hitTest(rects, 500, 550, null, 20), { kind: 'board', handle: 'move' }, 'el tablero va encima');
assert.deepStrictEqual(C.hitTest(rects, 500, 450, null, 20), { kind: 'text', handle: 'move' });
assert.deepStrictEqual(C.hitTest(rects, 50, 50, null, 20), { kind: 'photo', handle: 'move' });
assert.strictEqual(C.hitTest({}, 50, 50, null, 20), null);
assert.deepStrictEqual(C.hitTest(rects, 985, 505, 'text', 20), { kind: 'text', handle: 'e' }, 'tirador lateral del seleccionado');
assert.deepStrictEqual(C.hitTest(rects, 210, 490, 'board', 20), { kind: 'board', handle: 'nw' });
assert.deepStrictEqual(C.hitTest(rects, 200, 800, 'board', 20), { kind: 'board', handle: 'move' }, 'el tablero no tiene lados');
assert.deepStrictEqual(C.dragBox('board', rects.board, 'move', 10, -20, 1080, 1440), { x: 210, y: 480, size: 600 });
assert.deepStrictEqual(C.dragBox('board', rects.board, 'move', 5000, 5000, 1080, 1440), { x: 1020, y: 1380, size: 600 }, 'clamp: siempre queda dentro');
assert.deepStrictEqual(C.dragBox('board', rects.board, 'move', -5000, -5000, 1080, 1440), { x: -540, y: -540, size: 600 });
const se = C.dragBox('photo', rects.photo, 'se', -108, -144, 1080, 1440);
assert.ok(near(se.w, 972) && near(se.h, 1296) && se.x === 0 && se.y === 0, 'esquina: proporcional, ancla opuesta');
const nw = C.dragBox('photo', rects.photo, 'nw', 108, 144, 1080, 1440);
assert.ok(near(nw.x + nw.w, 1080) && near(nw.y + nw.h, 1440) && near(nw.w / nw.h, 0.75));
assert.strictEqual(C.dragBox('board', rects.board, 'se', -9999, -9999, 1080, 1440).size, 160, 'tamaño mínimo');
const side = C.dragBox('text', rects.text, 'w', 100, 0, 1080, 1440);
assert.deepStrictEqual(side, { x: 190, y: 400, w: 800, scale: 1 }, 'lado: solo cambia el ancho');
const big = C.dragBox('text', rects.text, 'se', 450, 100, 1080, 1440);
assert.ok(near(big.scale, 1.5) && near(big.w, 1350) && big.x === 90);
assert.strictEqual(C.dragBox('text', rects.text, 'se', 99999, 99999, 1080, 1440).scale, 3, 'letra con tope');
assert.ok(C.dragBox('text', { ...rects.text, w: 900, scale: 1 }, 'nw', 800, 0, 1080, 1440).scale >= 0.5);
assert.deepStrictEqual(Object.keys(C.handlesOf('photo', rects.photo)), ['nw', 'ne', 'sw', 'se']);
// Carrusel 1.4.2: rotación, guías con imán, deshacer y número de diapositivas.
{
const nearP = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
const sq = { x: 400, y: 400, w: 200, h: 100 }, sq90 = { ...sq, rot: 90 }; // centro (500, 450)
assert.ok(nearP(C.handlesOf('photo', sq90).nw, [550, 350]), 'los tiradores giran con el elemento');
assert.ok(nearP(C.handlesOf('photo', sq, 30, 1080, 1440).rot, [500, 370]), 'tirador de giro sobre el borde superior');
assert.ok(nearP(C.handlesOf('photo', { x: 0, y: 0, w: 1080, h: 1440 }, 30, 1080, 1440).rot, [540, 30]), 'si cae fuera, dentro');
assert.deepStrictEqual(C.hitTest({ photo: sq90 }, 500, 540, null, 10), { kind: 'photo', handle: 'move' }, 'hit-test girado');
assert.strictEqual(C.hitTest({ photo: sq90 }, 420, 450, null, 10), null, 'fuera del girado aunque dentro del original');
assert.deepStrictEqual(C.hitTest({ photo: sq }, 500, 370, 'photo', 10, 30, 1080, 1440), { kind: 'photo', handle: 'rot' });
const bb90 = C.bounds(sq90);
assert.ok(near(bb90.w, 100) && near(bb90.h, 200) && near(bb90.x, 450) && near(bb90.y, 350));
assert.deepStrictEqual(C.bounds(sq), sq, 'sin giro, la caja es el rect');
assert.strictEqual(C.angleAt(sq, 600, 450), 90);
assert.strictEqual(C.angleAt(sq, 500, 300), 0);
assert.strictEqual(C.snapAngle(47, true), 45, 'imán cada 15°');
assert.strictEqual(C.snapAngle(47, false), 47, 'Alt: sin imán');
assert.strictEqual(C.snapAngle(40, true), 40, 'fuera de la tolerancia de 3°');
assert.strictEqual(C.snapAngle(-1, true), 0);
assert.strictEqual(C.snapAngle(359, true), 0);
assert.strictEqual(C.dragBox('board', { ...rects.board, rot: 30 }, 'move', 10, 0, 1080, 1440).rot, 30, 'el giro se guarda en el override');
assert.ok(!('rot' in C.dragBox('board', rects.board, 'move', 10, 0, 1080, 1440)), 'sin giro, override de 1.4.1');
const rotSe = C.dragBox('photo', sq90, 'se', -50, 100, 1080, 1440); // girado 90°: el puntero se proyecta al eje local
assert.ok(near(rotSe.w, 300) && near(rotSe.h, 150), 'redimensiona en ejes locales');
assert.ok(nearP(C.handlesOf('photo', rotSe).nw, C.handlesOf('photo', sq90).nw), 'la esquina opuesta no se mueve');
const rotFar = C.dragBox('photo', { x: 0, y: 0, w: 400, h: 100, rot: 90 }, 'move', 5000, 0, 1080, 1440);
assert.ok(near(C.bounds(rotFar).x, 1020), 'clamp con la caja envolvente del girado');
// Guías: centro de la diapositiva, márgenes y otros elementos.
const LINES = { x: [540, 90, 990, 300], y: [720, 90, 1320] };
const sm = C.snapDrag('board', rects.board, 'move', 133, 0, 1080, 1440, LINES, 8); // bordes 333/633/933: lejos de todo
assert.deepStrictEqual(sm.guides, [], 'nada a menos de 8 px');
const sc = C.snapDrag('board', rects.board, 'move', 45, 0, 1080, 1440, LINES, 8); // centro 545 → 540
assert.deepStrictEqual(sc, { box: { x: 240, y: 500, size: 600 }, guides: [{ x: 540 }] });
const sb = C.snapDrag('board', rects.board, 'move', 95, 0, 1080, 1440, LINES, 8); // borde izq. 295 → 300
assert.strictEqual(sb.box.x, 300);
const sy = C.snapDrag('board', rects.board, 'move', 0, -405, 1080, 1440, LINES, 8); // arriba 95 → 90
assert.deepStrictEqual(sy.guides, [{ y: 90 }]);
const sr = C.snapDrag('board', rects.board, 'se', 186, 186, 1080, 1440, LINES, 8); // borde der. 986 → 990
assert.ok(near(sr.box.x + sr.box.size, 990) && sr.box.x === 200, 'redimensión: el borde que se mueve');
const ss = C.snapDrag('text', rects.text, 'e', -6, 0, 1080, 1440, LINES, 8);
assert.deepStrictEqual(ss.box, { x: 90, y: 400, w: 900, scale: 1 }, 'lado del texto al margen');
// Historial por diapositiva.
const hist = C.history(), l0 = { text: null }, l1 = { text: { x: 1 } }, l2 = { text: { x: 2 } };
assert.strictEqual(C.record(hist, l0, l0), false, 'un gesto sin cambios no ocupa historial');
assert.strictEqual(C.record(hist, l0, l1), true);
C.record(hist, l1, l2);
assert.deepStrictEqual(C.undo(hist, l2), l1);
assert.deepStrictEqual(C.undo(hist, l1), l0);
assert.strictEqual(C.undo(hist, l0), null);
assert.deepStrictEqual(C.redo(hist, l0), l1);
C.record(hist, l1, l0);
assert.strictEqual(hist.redo.length, 0, 'un cambio nuevo borra el rehacer');
const capped = C.history();
for (let i = 0; i < 120; i++) C.record(capped, { n: i }, { n: i + 1 });
assert.strictEqual(capped.undo.length, 100, 'tope de 100 pasos');
// Número de diapositivas: el rol va con la posición.
assert.strictEqual(C.MIN_SLIDES, 1);
assert.strictEqual(C.MAX_SLIDES, 8);
assert.strictEqual(C.roleOf(0), C.ROLES[0]);
assert.strictEqual(C.roleOf(5), 'Diapositiva 6');
assert.strictEqual(C.hintOf(4), C.HINTS[4]);
assert.ok(C.hintOf(7));
assert.strictEqual(C.fileName(7), 'carrusel-8.png');
const blank = { text: ' ', accent: '', positionText: '', photo: null, layout: { text: null, accent: null, photo: null, board: null } };
assert.strictEqual(C.isBlank(blank), true);
assert.strictEqual(C.isBlank({ ...blank, accent: 'a' }), false);
assert.strictEqual(C.isBlank({ ...blank, layout: { ...blank.layout, board: { x: 0, y: 0, size: 200 } } }), false);
}
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
