const test = require('node:test');
const assert = require('node:assert/strict');
const { mapWithConcurrency } = require('../dash/asyncPool');

test('async pool bounds concurrency and preserves order', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], async value => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, value % 2 ? 3 : 1));
    active -= 1;
    return value * 2;
  }, 2);
  assert.equal(peak, 2);
  assert.deepEqual(result, [2, 4, 6, 8, 10, 12]);
});

test('async pool propagates worker errors', async () => {
  await assert.rejects(() => mapWithConcurrency(['ok', 'bad'], async value => {
    if (value === 'bad') throw new Error('worker_failed');
    return value;
  }, 2), /worker_failed/);
});
