const assert = require('assert');
const L = require('../src/tools/teleprompter/renderer/logic.js');

assert.strictEqual(L.clampSpeed(5), L.MIN_SPEED);
assert.strictEqual(L.clampSpeed(9999), L.MAX_SPEED);
assert.strictEqual(L.stepSpeed(100, 1), 110);
assert.strictEqual(L.stepSpeed(100, -1), 90);
assert.strictEqual(L.stepSpeed(L.MIN_SPEED, -1), L.MIN_SPEED);
assert.deepStrictEqual(L.advance(0, 100, 0.5, 1000), { pos: 50, done: false });
assert.deepStrictEqual(L.advance(990, 100, 0.5, 1000), { pos: 1000, done: true });
console.log('logic OK');
