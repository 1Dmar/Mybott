'use strict';

async function mapWithConcurrency(items, worker, concurrency = 4) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (typeof worker !== 'function') throw new TypeError('worker is required');
  const limit = Math.max(1, Math.min(items.length, Math.floor(Number(concurrency) || 1)));
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => consume()));
  return results;
}

module.exports = { mapWithConcurrency };
