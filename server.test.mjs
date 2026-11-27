import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';

test('Express static server routes', async (t) => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });

  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  await t.test('GET / serves index.html', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    const body = await res.text();
    assert.match(body, /<title>Hiking mapa<\/title>/);
  });

  await t.test('GET /index.html serves index.html', async () => {
    const res = await fetch(`${baseUrl}/index.html`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
  });

  await t.test('GET /sw.js serves service worker script', async () => {
    const res = await fetch(`${baseUrl}/sw.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /javascript/);
    const body = await res.text();
    assert.match(body, /caches\.open/);
  });

  await t.test('server source and package files are not exposed', async () => {
    const serverRes = await fetch(`${baseUrl}/server.js`);
    assert.equal(serverRes.status, 404);
    const pkgRes = await fetch(`${baseUrl}/package.json`);
    assert.equal(pkgRes.status, 404);
  });
});
