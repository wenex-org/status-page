import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';

import { config } from './config.js';
import { apiRouter } from './routes/api.routes.js';
import { adminRouter } from './routes/admin.routes.js';

/** Builds and configures the Express application (MVC wiring). */
export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  // Admin (Basic Auth). Mounted before static so /admin hits the guard.
  app.use('/admin', adminRouter);

  // Public API.
  app.use('/api', apiRouter);

  // Static assets + public status page.
  app.use(express.static(config.publicDir));
  app.get('/', (_req, res) => {
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  // 404 for unknown API routes; otherwise fall through to the SPA shell.
  app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  // Central error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
