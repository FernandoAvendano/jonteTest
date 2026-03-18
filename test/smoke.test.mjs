import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const INDEX_PATH = new URL('../index.html', import.meta.url);
const SERVER_PATH = new URL('../server.js', import.meta.url);

async function readIndex() {
  return readFile(INDEX_PATH, 'utf8');
}

async function readServer() {
  return readFile(SERVER_PATH, 'utf8');
}

function makeElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    disabled: false,
    classList: { add() {}, remove() {} },
    addEventListener() {},
    appendChild() {},
    setAttribute() {},
    getAttribute() { return ''; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    scrollIntoView() {},
    closest() { return null; },
  };
}

test('API_BASE uses /mtandis prefix for non-localhost', async () => {
  const html = await readIndex();
  const match = html.match(/const API_BASE\s*=([\s\S]*?);\n\s*const DESKTOP_BREAKPOINT/);
  assert.ok(match, 'Could not find API_BASE definition in index.html');
  assert.match(
    match[1],
    /https:\/\/lexicostatistical-seamanly-elle\.ngrok-free\.dev\/mtandis/,
    'Expected ngrok API base to include /mtandis path prefix',
  );
});

test('login form contains environment selector', async () => {
  const html = await readIndex();
  assert.match(html, /id="environment"[^>]*name="environment"/);
  assert.match(html, /value="production"/);
  assert.match(html, /value="test"/);
});

test('frontend sends selected environment in all API payloads', async () => {
  const html = await readIndex();
  const requiredSnippets = [
    '{ username, password, environment }',
    '{ token: state.token, environment: state.environment }',
    'post("/api/order-tasks", { token: state.token, orderId: order.ID, environment: state.environment })',
    'JSON.stringify({ token: state.token, attachmentId, environment: state.environment })',
  ];
  for (const snippet of requiredSnippets) {
    assert.ok(html.includes(snippet), `Missing payload snippet: ${snippet}`);
  }
});

test('frontend script bootstraps without runtime ReferenceError', async () => {
  const html = await readIndex();
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Inline script not found in index.html');
  const script = scriptMatch[1];

  const docEl = makeElement();
  const document = {
    getElementById() { return makeElement(); },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); },
    createDocumentFragment() { return { appendChild() {} }; },
    addEventListener() {},
    body: docEl,
  };

  const windowObj = {
    location: { hostname: 'localhost', reload() {} },
    matchMedia() { return { matches: false }; },
  };

  const sandbox = {
    console,
    document,
    window: windowObj,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    FormData: class { get() { return ''; } },
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '', blob: async () => ({}) }),
    caches: { keys: async () => [], delete: async () => true },
    navigator: { serviceWorker: { getRegistrations: async () => [] } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    alert() {},
    Date,
    setTimeout,
    clearTimeout,
  };

  assert.doesNotThrow(() => vm.runInNewContext(script, sandbox), 'Frontend bootstrap should not throw');
});

test('backend defines and uses environment-specific base URLs', async () => {
  const server = await readServer();
  assert.match(server, /const ENVIRONMENT_BASES = \{/);
  assert.match(server, /production: 'https:\/\/tandis\.app:8443\/api'/);
  assert.match(server, /test: 'https:\/\/saas02\.tandis\.app:8443\/api'/);

  const baseUsageCount = (server.match(/resolveBase\(environment\)/g) || []).length;
  assert.ok(baseUsageCount >= 7, 'Expected resolveBase(environment) usage in all routes');


  assert.match(
    server,
    /app\.post\('\/api\/order-comments'[\s\S]*const \{ token, orderId, environment \} = req\.body;/,
    'order-comments route must read environment from request body',
  );

  assert.doesNotMatch(
    server,
    /const \{ token, orderId \} = req\.body;/,
    'All orderId routes must include environment in destructuring',
  );
});
