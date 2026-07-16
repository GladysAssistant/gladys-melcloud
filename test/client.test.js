import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { MELCloudClient } from '../src/melcloud/client.js';
import { LIST_DEVICES_RESPONSE, DEVICE_STATE } from './fixtures.js';

// Tiny fake MELCloud API. `behaviour` is mutated by the tests.
function startFakeMELCloud(behaviour) {
  const requests = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const url = new URL(req.url, 'http://localhost');
      requests.push({
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        contextKey: req.headers['x-mitscontextkey'],
        body: body ? JSON.parse(body) : null,
      });
      const respond = (status, json) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
      };
      if (url.pathname === '/Login/ClientLogin') {
        respond(200, behaviour.loginResponse);
        return;
      }
      if (behaviour.failNextWith401) {
        behaviour.failNextWith401 = false;
        respond(401, {});
        return;
      }
      if (url.pathname === '/User/ListDevices') {
        respond(200, LIST_DEVICES_RESPONSE);
        return;
      }
      if (url.pathname === '/Device/Get') {
        respond(200, DEVICE_STATE);
        return;
      }
      if (url.pathname === '/Device/SetAta') {
        respond(200, {});
        return;
      }
      respond(404, {});
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, requests, port: server.address().port });
    });
  });
}

test('MELCloudClient', async (t) => {
  const behaviour = {
    loginResponse: { ErrorId: null, LoginData: { ContextKey: 'ctx-1' } },
    failNextWith401: false,
  };
  const { server, requests, port } = await startFakeMELCloud(behaviour);
  t.after(() => server.close());

  const client = new MELCloudClient(`http://127.0.0.1:${port}`);

  await t.test('login stores the context key and sends the expected payload', async () => {
    await client.login('user@example.com', 'secret');
    assert.equal(client.isLoggedIn(), true);
    const login = requests.at(-1);
    assert.equal(login.path, '/Login/ClientLogin');
    assert.deepEqual(login.body, {
      Email: 'user@example.com',
      Password: 'secret',
      Language: 0,
      AppVersion: '1.19.1.1',
      Persist: true,
      CaptchaResponse: null,
    });
  });

  await t.test('listDevices flattens houses, floors and areas', async () => {
    const devices = await client.listDevices();
    assert.deepEqual(
      devices.map((d) => d.DeviceID),
      [123, 789],
    );
    assert.equal(requests.at(-1).contextKey, 'ctx-1');
  });

  await t.test('getDevice passes the id and buildingID', async () => {
    const state = await client.getDevice(123, 456);
    assert.equal(state.SetTemperature, 21);
    assert.deepEqual(requests.at(-1).query, { id: '123', buildingID: '456' });
  });

  await t.test('a 401 triggers a single re-login and a retry', async () => {
    behaviour.loginResponse = { ErrorId: null, LoginData: { ContextKey: 'ctx-2' } };
    behaviour.failNextWith401 = true;
    const state = await client.getDevice(123, 456);
    assert.equal(state.SetTemperature, 21);
    // 401 -> new login -> retried with the new context key.
    assert.equal(requests.at(-2).path, '/Login/ClientLogin');
    assert.equal(requests.at(-1).contextKey, 'ctx-2');
  });

  await t.test('a login error from MELCloud throws', async () => {
    behaviour.loginResponse = { ErrorId: 1, ErrorMessage: 'Bad credentials' };
    await assert.rejects(() => client.login('user@example.com', 'wrong'), /Bad credentials/);
    assert.equal(client.isLoggedIn(), false);
  });
});
