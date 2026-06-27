import type { Request, Response } from 'express';
import { GroupModel } from '../models/group.model.js';

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Authenticated admin API for managing service groups. */
export const GroupController = {
  /** GET /admin/api/groups */
  list(_req: Request, res: Response): void {
    res.json(GroupModel.all());
  },

  /** POST /admin/api/groups */
  create(req: Request, res: Response): void {
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    res.status(201).json(GroupModel.create(name));
  },

  /** PUT /admin/api/groups/:id — rename. */
  rename(req: Request, res: Response): void {
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const updated = GroupModel.rename(Number(req.params.id), name);
    if (!updated) {
      res.status(404).json({ error: 'group not found' });
      return;
    }
    res.json(updated);
  },

  /** POST /admin/api/groups/reorder — body: { ids: number[] }. */
  reorder(req: Request, res: Response): void {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
      res.status(400).json({ error: 'ids must be an array of integers' });
      return;
    }
    GroupModel.reorder(ids);
    res.json({ ok: true });
  },

  /** DELETE /admin/api/groups/:id — members fall back to "Other". */
  remove(req: Request, res: Response): void {
    if (!GroupModel.remove(Number(req.params.id))) {
      res.status(404).json({ error: 'group not found' });
      return;
    }
    res.status(204).end();
  },
};
