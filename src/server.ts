import { startScheduler, stopScheduler } from './services/scheduler.service.js';
import { CredentialsModel } from './models/credentials.model.js';
import { GroupModel } from './models/group.model.js';
import { getDb, closeDb } from './db/index.js';
import { createApp } from './app.js';
import { config } from './config.js';

/** Application entry point: init DB, seed admin, start scheduler + HTTP server. */
function main(): void {
  // Initialise DB (applies schema) and seed defaults when empty.
  getDb();
  CredentialsModel.seedIfMissing(
    config.defaultAdmin.username,
    config.defaultAdmin.password,
  );
  GroupModel.seedDefaults([...config.defaultGroups]);

  startScheduler();

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`\n  Status page running:`);
    console.log(`  • Public : http://${config.host}:${config.port}/`);
    console.log(`  • Admin  : http://${config.host}:${config.port}/admin`);
    console.log(`  • DB     : ${config.dbPath}\n`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n[shutdown] received ${signal}, closing…`);
    stopScheduler();
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
