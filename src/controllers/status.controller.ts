import type { Request, Response } from 'express';
import { NewsModel } from '../models/news.model.js';
import { buildGroupedStatus } from '../services/status.service.js';

/** Public, unauthenticated endpoints powering the status page. */
export const StatusController = {
  /** GET /api/status — grouped resource status + overall summary + notices. */
  index(_req: Request, res: Response): void {
    const { overall, groups } = buildGroupedStatus();
    res.json({
      overall,
      updatedAt: new Date().toISOString(),
      groups,
      news: NewsModel.active(),
    });
  },

  /** GET /api/news — active announcements only. */
  news(_req: Request, res: Response): void {
    res.json(NewsModel.active());
  },
};
