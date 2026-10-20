#!/usr/bin/env node
'use strict';

const http = require('node:http');
const https = require('node:https');

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const baseUrl = readArg('--base-url', 'http://127.0.0.1:8080');
const path = readArg('--path', '/health');
const requests = Math.max(1, Math.min(100000, Number(readArg('--requests', '1000')) || 1000));
const concurrency = Math.max(1, Math.min(500, Number(readArg('--concurrency', '25')) || 25));
const allowPublic = process.argv.includes('--allow-public');
const target = new URL(path, baseUrl);

if (!['http:', 'https:'].includes(target.protocol)) throw new Error('base-url must use http or https');
if (!allowPublic && !['localhost', '127.0.0.1', '::1'].includes(target.hostname)) {
  throw new Error('Refusing non-local target. Use --allow-public only after explicit approval.');
}

const client = target.protocol === 'https:' ? https : http;
let next = 0;
let completed = 0;
let failed = 0;
let active = 0;
let startedAt = Date.now();
const statuses = new Map();

function one() {
  return new Promise(resolve => {
    const request = client.request(target, { method: 'GET', headers: { 'User-Agent': 'ProMcBot-local-load-test/1.0', Accept: 'application/json' } }, response => {
      response.resume();
      response.on('end', () => {
        statuses.set(response.statusCode, (statuses.get(response.statusCode) || 0) + 1);
        if (response.statusCode < 200 || response.statusCode >= 500) failed += 1;
        completed += 1;
        resolve();
      });
    });
    request.setTimeout(10000, () => request.destroy(new Error('timeout')));
    request.on('error', () => { failed += 1; completed += 1; resolve(); });
    request.end();
  });
}

async function worker() {
  while (true) {
    const current = next++;
    if (current >= requests) return;
    await one();
  }
}

(async () => {
  startedAt = Date.now();
  active = Math.min(concurrency, requests);
  await Promise.all(Array.from({ length: active }, worker));
  const durationMs = Date.now() - startedAt;
  const rps = completed / Math.max(durationMs / 1000, 0.001);
  const result = { target: target.toString(), requests, concurrency, completed, failed, durationMs, requestsPerSecond: Number(rps.toFixed(2)), statuses: Object.fromEntries(statuses) };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
