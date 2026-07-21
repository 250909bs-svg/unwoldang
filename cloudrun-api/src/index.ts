import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { loadConfig } from './config/env.ts';

const config = loadConfig();
const server = createServer(createApp({ config }));

server.listen(config.port, '0.0.0.0', () => {
  console.log(`unwoldang-cloudrun-api listening on port ${config.port}`);
});
