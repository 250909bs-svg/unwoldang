import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { loadValidatedConfig } from './config/env.ts';
import { defaultLogger } from './observability/logger.ts';

const config = loadValidatedConfig();
const logger = defaultLogger;
const server = createServer(createApp({ config, logger }));

server.listen(config.port, '0.0.0.0', () => {
  logger.log({ severity: 'INFO', event: 'server_start' });
});

server.on('error', () => {
  logger.log({ severity: 'ERROR', event: 'server_error', errorCode: 'SERVER_START_FAILED' });
});
