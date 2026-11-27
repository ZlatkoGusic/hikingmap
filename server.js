import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.get('/sw.js', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'sw.js'));
  });

  app.get('/hike-math.js', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'hike-math.js'));
  });

  app.get(['/', '/index.html'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  app.use((_req, res) => {
    res.status(404).send('Not found');
  });

  return app;
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';
  const app = createApp();

  app.listen(PORT, HOST, () => {
    console.log(`Hiking mapa server listening on http://${HOST}:${PORT}`);
  });
}
