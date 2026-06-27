import { Router } from 'express';
import { StatusController } from '../controllers/status.controller.js';

/** Public API routes (no auth). */
export const apiRouter = Router();

apiRouter.get('/status', StatusController.index);
apiRouter.get('/news', StatusController.news);
