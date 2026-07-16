// End-to-end test: boots the REAL integration process (index.js) against a
// fake Gladys host (WebSocket + REST, same contract as the SDK) and a fake
// MELCloud API, then exercises the full flows: initial discovery, scan
// request, poll and set-value commands.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { AC_MODE } from '../src/constants.js';
import { LIST_DEVICES_RESPONSE, DEVICE_STATE } from './fixtures.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SELECTOR = 'melcloud-test';
const TOKEN = 'test-token';

async function waitUntil(predicate, what, timeoutMs = 10000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

// --- Fake MELCloud API -------------------------------------------------------
function startFakeMELCloud() {
  const requests = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const url = new URL(req.url, 'http://localhost');
      requests.push({ method: req.method, path: url.pathname, body: body ? JSON.parse(body) : null });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (url.pathname === '/Login/ClientLogin') {
        res.end(JSON.stringify({ ErrorId: null, LoginData: { ContextKey: 'ctx' } }));
      } else if (url.pathname === '/User/ListDevices') {
        res.end(JSON.stringify(LIST_DEVICES_RESPONSE));
      } else if (url.pathname === '/Device/Get') {
        res.end(JSON.stringify(DEVICE_STATE));
      } else {
        res.end(JSON.stringify({}));
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, requests, port: server.address().port }));
  });
}

// --- Fake Gladys host (REST + WebSocket) --------------------------------------
function startFakeGladys() {
  const state = {
    discoveredDevicePosts: [],
    statePosts: [],
    commandResults: [],
    ws: null,
  };
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const respond = (json) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
      };
      if (req.method === 'GET' && req.url === '/api/integration/v1/device') {
        respond([]);
      } else if (req.method === 'GET' && req.url === '/api/integration/v1/config') {
        respond({ config: { username: 'user@example.com', password: 'secret' } });
      } else if (req.method === 'POST' && req.url === '/api/integration/v1/discovered_device') {
        const parsed = JSON.parse(body);
        state.discoveredDevicePosts.push(parsed.devices);
        respond({ success: true, count: parsed.devices.length });
      } else if (req.method === 'POST' && req.url === '/api/integration/v1/state') {
        state.statePosts.push(JSON.parse(body).states);
        respond({ success: true });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    state.ws = ws;
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'authenticate.integration-request' && message.payload.token === TOKEN) {
        ws.send(JSON.stringify({ type: 'authentication.connected', payload: {} }));
      }
      if (message.type === 'external-integration.command-result') {
        state.commandResults.push(message.payload);
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, state, port: server.address().port }));
  });
}

test('the integration discovers, polls and controls MELCloud devices', async (t) => {
  const melcloud = await startFakeMELCloud();
  const gladys = await startFakeGladys();
  t.after(() => {
    melcloud.server.close();
    gladys.server.close();
  });

  let output = '';
  const child = spawn(process.execPath, ['index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      GLADYS_HOST_API_URL: `http://127.0.0.1:${gladys.port}`,
      GLADYS_INTEGRATION_TOKEN: TOKEN,
      GLADYS_INTEGRATION_SELECTOR: SELECTOR,
      MELCLOUD_ENDPOINT: `http://127.0.0.1:${melcloud.port}`,
      LOG_LEVEL: 'debug',
    },
  });
  child.stdout.on('data', (d) => {
    output += d;
  });
  child.stderr.on('data', (d) => {
    output += d;
  });
  t.after(() => child.kill('SIGKILL'));
  t.afterEach((ctx) => {
    if (ctx.name && output && process.env.E2E_VERBOSE) {
      console.log(output);
    }
  });

  const send = (type, payload) => gladys.state.ws.send(JSON.stringify({ type, payload }));

  await t.test('on connection: logs in to MELCloud and publishes the discovered devices', async () => {
    await waitUntil(() => gladys.state.discoveredDevicePosts.length >= 1, `initial discovery\n${output}`);

    const login = melcloud.requests.find((r) => r.path === '/Login/ClientLogin');
    assert.ok(login, 'the integration logged in to MELCloud');
    assert.equal(login.body.Email, 'user@example.com');
    assert.equal(login.body.Password, 'secret');

    const devices = gladys.state.discoveredDevicePosts.at(-1);
    assert.equal(devices.length, 2);

    const airToAir = devices.find((d) => d.external_id === `ext:${SELECTOR}:123`);
    assert.equal(airToAir.name, 'Living room AC');
    assert.equal(airToAir.poll_frequency, 10000);
    assert.equal(airToAir.should_poll, true);
    assert.deepEqual(airToAir.params, [{ name: 'buildingID', value: 456 }]);
    assert.deepEqual(
      airToAir.features.map((f) => f.external_id),
      [`ext:${SELECTOR}:123:power`, `ext:${SELECTOR}:123:mode`, `ext:${SELECTOR}:123:temperature`],
    );

    const airToWater = devices.find((d) => d.external_id === `ext:${SELECTOR}:789`);
    assert.deepEqual(airToWater.features, []);
  });

  await t.test('a scan request republishes the devices', async () => {
    const before = gladys.state.discoveredDevicePosts.length;
    send('external-integration.scan-request', {});
    await waitUntil(() => gladys.state.discoveredDevicePosts.length > before, `scan republish\n${output}`);
    assert.equal(gladys.state.discoveredDevicePosts.at(-1).length, 2);
  });

  const pollDevice = {
    external_id: `ext:${SELECTOR}:123`,
    selector: `ext-${SELECTOR}-123`,
    params: [{ name: 'buildingID', value: 456 }],
  };

  await t.test('a poll command publishes the device states', async () => {
    send('external-integration.device.poll', { message_id: 'poll-1', device: pollDevice });
    await waitUntil(() => gladys.state.commandResults.some((r) => r.message_id === 'poll-1'), `poll ack\n${output}`);

    const ack = gladys.state.commandResults.find((r) => r.message_id === 'poll-1');
    assert.equal(ack.success, true, ack.error);

    const states = gladys.state.statePosts.at(-1);
    assert.deepEqual(states, [
      { device_feature_external_id: `ext:${SELECTOR}:123:power`, state: 1 },
      { device_feature_external_id: `ext:${SELECTOR}:123:mode`, state: AC_MODE.HEATING },
      { device_feature_external_id: `ext:${SELECTOR}:123:temperature`, state: 21 },
    ]);

    const get = melcloud.requests.at(-1);
    assert.equal(get.path, '/Device/Get');
  });

  await t.test('a set-value command writes the state back to MELCloud', async () => {
    send('external-integration.device.set-value', {
      message_id: 'set-1',
      device: pollDevice,
      device_feature: {
        external_id: `ext:${SELECTOR}:123:mode`,
        category: 'air-conditioning',
        type: 'mode',
      },
      value: AC_MODE.COOLING,
    });
    await waitUntil(() => gladys.state.commandResults.some((r) => r.message_id === 'set-1'), `set ack\n${output}`);

    const ack = gladys.state.commandResults.find((r) => r.message_id === 'set-1');
    assert.equal(ack.success, true, ack.error);

    const setAta = melcloud.requests.findLast((r) => r.path === '/Device/SetAta');
    assert.ok(setAta, 'the integration called Device/SetAta');
    // Full current state + the change + its EffectiveFlags.
    assert.equal(setAta.body.OperationMode, 3); // cooling on MELCloud
    assert.equal(setAta.body.EffectiveFlags, 6);
    assert.equal(setAta.body.HasPendingCommand, true);
    assert.equal(setAta.body.SetTemperature, 21); // untouched, from Device/Get
  });

  await t.test('a set-value command on an unknown feature is acked as failed', async () => {
    send('external-integration.device.set-value', {
      message_id: 'set-2',
      device: pollDevice,
      device_feature: { external_id: `ext:${SELECTOR}:123:unknown`, category: 'air-conditioning', type: 'mode' },
      value: 1,
    });
    await waitUntil(() => gladys.state.commandResults.some((r) => r.message_id === 'set-2'), `fail ack\n${output}`);
    const ack = gladys.state.commandResults.find((r) => r.message_id === 'set-2');
    assert.equal(ack.success, false);
    assert.match(ack.error, /not controllable/);
  });
});
