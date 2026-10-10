// Zero-dependency static file server for manually testing the UI in a
// browser. Separate from `npm start` (the console entry point).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

function readPortFromArgs() {
  const arg = process.argv.find((a) => a.startsWith('--port='));
  return arg ? Number(arg.slice('--port='.length)) : 4000;
}

const server = createServer(async (req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = join(ROOT_DIR, requestPath);

  try {
    const content = await readFile(filePath);
    const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const port = readPortFromArgs();
server.listen(port, () => {
  console.log(`SyncLife UI: http://localhost:${port}`);
});
