import { createServer } from './server.js';
import { env } from './config/env.js';

const app = createServer();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 OnDemand Platform Server running at http://localhost:${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`🔒 Allowed CORS Origins: ${env.getAllowedOrigins().join(', ')}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Stopping server gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

