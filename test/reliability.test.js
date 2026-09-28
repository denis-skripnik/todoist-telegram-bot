import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Bot, InlineKeyboard } from 'grammy';

// Import the actual application, with only external boundaries controlled.
const cwd = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todoist-reliability-'));
process.chdir(dir);
const intervals = [];
let daily;
mock.method(globalThis, 'setInterval', (fn, ms) => { intervals.push({ fn, ms }); return 0; });
mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
const errors = [];
mock.method(console, 'error', (...args) => errors.push(args));
const { register } = await import('node:module');
register('./config-loader.js', import.meta.url);
mock.module('node-cron', { defaultExport: { schedule: (expression, fn) => {
  assert.equal(expression, '0 9 * * *'); daily = fn;
} } });
let bot;
class TestBot extends Bot {
  constructor(token) {
    super(token, { botInfo: { id: 123, is_bot: true, first_name: 'Test', username: 'test_bot' } });
    bot = this;
  }
  start() {}
}
mock.module('grammy', { namedExports: { Bot: TestBot, InlineKeyboard } });
let transcribe = async () => ({ text: '' });
mock.module('groq-sdk', { defaultExport: class {
  audio = { transcriptions: { create: (...args) => transcribe(...args) } };
} });
const state = await import('../state.js');
const { todoist } = await import('../todoist_api.js');
mock.method(todoist, 'getProjects', async () => []);
mock.method(todoist, 'getTasks', async () => []);
const oldSignals = new Map(['SIGINT', 'SIGTERM'].map(s => [s, process.listeners(s)]));
await import('../todoist.js');
after(() => {
  for (const [signal, before] of oldSignals) {
    for (const listener of process.listeners(signal)) if (!before.includes(listener)) process.removeListener(signal, listener);
  }
  mock.restoreAll();
  process.chdir(cwd);
  fs.rmSync(dir, { recursive: true, force: true });
});
const turn = () => new Promise(resolve => setImmediate(resolve));
const exact = intervals[1].fn;

for (const failure of ['write', 'rename']) {
  test(`atomic state save preserves old data on ${failure} failure and recovers`, () => {
    state.userStates[42] = { lng: 'ru', screen: { type: 'tasks', page: 7 }, tempData: { keep: true } };
    state.notifiedTasks.add('keep-id');
    state.saveState();
    const previous = fs.readFileSync('state.json', 'utf8');
    state.userStates[42].screen.page = 8;
    const originalWrite = fs.writeFileSync.bind(fs);
    const failureMock = mock.method(fs, failure === 'write' ? 'writeFileSync' : 'renameSync', (...args) => {
      if (failure === 'write') originalWrite(args[0], '{partial');
      throw new Error(`controlled ${failure} failure`);
    });
    try {
      assert.throws(() => state.saveState(), /controlled/);
      assert.equal(fs.readFileSync('state.json', 'utf8'), previous);
      assert.deepEqual(fs.readdirSync('.'), ['state.json'], 'failed temp removed');
    } finally { failureMock.mock.restore(); }
    state.saveState();
    const saved = JSON.parse(fs.readFileSync('state.json', 'utf8'));
    assert.deepEqual(saved, { userStates: state.userStates, notifiedTasks: [...state.notifiedTasks] });
    const ref = state.userStates[42];
    state.loadState();
    assert.deepEqual(state.userStates[42], ref);
  });
}

test('save interval catches a transient disk failure and saves on next tick', () => {
  const before = errors.length;
  const failureMock = mock.method(fs, 'writeFileSync', () => { throw new Error('controlled disk full'); });
  try { assert.doesNotThrow(() => intervals[0].fn()); }
  finally { failureMock.mock.restore(); }
  assert.equal(errors.length, before + 1);
  intervals[0].fn();
  assert.deepEqual(JSON.parse(fs.readFileSync('state.json', 'utf8')), {
    userStates: state.userStates, notifiedTasks: [...state.notifiedTasks]
  });
});

let replyFailure = false;
const sentMessages = [];
bot.api.config.use(async (_prev, method, payload) => {
  if (method === 'getFile') return { ok: true, result: { file_path: 'voice.ogg' } };
  if (method === 'sendMessage') {
    if (replyFailure) throw new Error('controlled reply failure');
    sentMessages.push(payload);
    return { ok: true, result: { message_id: 1 } };
  }
  throw new Error(`Unexpected Telegram method: ${method}`);
});

for (const scenario of ['success', 'empty', 'download', 'groq', 'reply']) {
  test(`voice handler removes temporary audio on ${scenario}`, async () => {
    state.userStates[42] = { lng: 'en', mode: 'ai_waiting_project', screen: { type: 'main_menu' } };
    replyFailure = scenario === 'reply';
    globalThis.fetch.mock.mockImplementation(async () => ({
      ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    }));
    transcribe = async () => {
      if (scenario === 'groq') throw new Error('controlled Groq failure');
      return { text: scenario === 'empty' ? '   ' : 'a task' };
    };
    const write = fs.promises.writeFile.bind(fs.promises);
    const writeMock = scenario === 'download' ? mock.method(fs.promises, 'writeFile', async (...args) => {
      await write(...args); // Partial download exists before failure.
      throw new Error('controlled download write failure');
    }) : null;
    try {
      const result = bot.handleUpdate({ update_id: 1, message: {
        message_id: 1, date: 1, chat: { id: 42, type: 'private' },
        voice: { file_id: 'voice-test', file_unique_id: 'voice-test', duration: 1 }
      } });
      if (scenario === 'reply') await assert.rejects(result, /controlled reply failure/);
      else await result;
      assert.deepEqual(fs.existsSync('tmp') ? fs.readdirSync('tmp') : [], []);
    } finally {
      writeMock?.mock.restore();
      replyFailure = false;
      fs.rmSync('tmp', { recursive: true, force: true });
    }
  });
}

test('scheduled passes serialize, coalesce bursts, retain daily work and recover after failure', async () => {
  assert.deepEqual(intervals.map(i => i.ms), [60000, 60000]);
  let release;
  let calls = 0;
  todoist.getProjects.mock.mockImplementation(async () => {
    calls++;
    if (calls === 1) await new Promise(resolve => { release = resolve; });
    return [{ id: 'p', name: 'Project' }];
  });
  todoist.getTasks.mock.mockImplementation(async () => { throw new Error('controlled task failure'); });
  exact();
  await turn();
  for (let i = 0; i < 100; i++) { daily(); exact(); }
  await turn();
  const whileBlocked = calls;
  release();
  for (let i = 0; i < 8; i++) await turn();
  assert.equal(whileBlocked, 1, 'no overlapping daily or exact API pass');
  assert.equal(calls, 3, 'at most one queued pass per type, including daily');
  exact();
  await turn();
  assert.equal(calls, 4, 'guard released after rejection');
});

test('queued daily pass actually delivers; failed send can retry; exact dedup remains', async () => {
  const { format } = await import('date-fns');
  const now = new Date();
  todoist.getTasks.mock.mockImplementation(async () => [
    { id: 'exact-new', content: 'Exact reminder', due: { date: now.toISOString(), string: 'now' } },
    { id: 'daily-new', content: 'Daily reminder', due: { date: format(now, 'yyyy-MM-dd') } }
  ]);
  let release;
  todoist.getProjects.mock.mockImplementationOnce(async () => {
    await new Promise(resolve => { release = resolve; });
    return [{ id: 'p', name: 'Project' }];
  });
  sentMessages.length = 0;
  exact();
  await turn();
  daily();
  release();
  for (let i = 0; i < 8; i++) await turn();
  assert.equal(sentMessages.filter(p => p.text.includes('Daily reminder')).length, 1);
  assert.equal(sentMessages.filter(p => p.text.includes('Exact reminder')).length, 1);
  assert.ok(state.notifiedTasks.has('exact-new'));
  exact();
  await turn();
  assert.equal(sentMessages.filter(p => p.text.includes('Exact reminder')).length, 1);
  state.notifiedTasks.delete('exact-new');
  replyFailure = true;
  exact();
  await turn();
  assert.equal(state.notifiedTasks.has('exact-new'), false);
  replyFailure = false;
  exact();
  await turn();
  assert.ok(state.notifiedTasks.has('exact-new'));
});
