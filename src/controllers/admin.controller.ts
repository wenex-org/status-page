import type { Request, Response } from 'express';

import { config } from '../config.js';
import type { News } from '../models/types.js';
import { NewsModel } from '../models/news.model.js';
import { GroupModel } from '../models/group.model.js';
import { checkNow } from '../services/scheduler.service.js';
import { ResourceModel } from '../models/resource.model.js';
import { CredentialsModel } from '../models/credentials.model.js';

const NEWS_LEVELS: News['level'][] = ['info', 'warning', 'critical'];

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Normalise a groupId from the request: `null` for ungrouped, else a number. */
function parseGroupId(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

/** Returns true if the groupId is null (ungrouped) or references a real group. */
function groupIdIsValid(groupId: number | null): boolean {
  return groupId === null || (Number.isInteger(groupId) && !!GroupModel.find(groupId));
}

/** Authenticated admin API (mounted behind Basic Auth). */
export const AdminController = {
  /** GET /admin/api/meta — configurable choices for the admin UI. */
  meta(_req: Request, res: Response): void {
    res.json({ allowedIntervals: config.allowedIntervals });
  },

  /** GET /admin/api/resources */
  listResources(_req: Request, res: Response): void {
    res.json(ResourceModel.all());
  },

  /** POST /admin/api/resources */
  createResource(req: Request, res: Response): void {
    const name = str(req.body?.name);
    const endpoint = str(req.body?.endpoint);
    const intervalMinutes = Number(
      req.body?.intervalMinutes ?? config.allowedIntervals[0],
    );

    if (!name || !endpoint) {
      res.status(400).json({ error: 'name and endpoint are required' });
      return;
    }
    if (!/^https?:\/\//i.test(endpoint)) {
      res.status(400).json({ error: 'endpoint must be an http(s) URL' });
      return;
    }
    if (!config.allowedIntervals.includes(intervalMinutes as never)) {
      res.status(400).json({
        error: `intervalMinutes must be one of ${config.allowedIntervals.join(', ')}`,
      });
      return;
    }

    const groupId = parseGroupId(req.body?.groupId);
    if (!groupIdIsValid(groupId)) {
      res.status(400).json({ error: 'groupId must reference an existing group' });
      return;
    }

    res
      .status(201)
      .json(ResourceModel.create({ name, endpoint, intervalMinutes, groupId }));
  },

  /** PUT /admin/api/resources/:id */
  updateResource(req: Request, res: Response): void {
    const id = Number(req.params.id);
    const patch: Record<string, unknown> = {};

    if (req.body?.name !== undefined) patch.name = str(req.body.name);
    if (req.body?.endpoint !== undefined) {
      const endpoint = str(req.body.endpoint);
      if (!/^https?:\/\//i.test(endpoint)) {
        res.status(400).json({ error: 'endpoint must be an http(s) URL' });
        return;
      }
      patch.endpoint = endpoint;
    }
    if (req.body?.intervalMinutes !== undefined) {
      const interval = Number(req.body.intervalMinutes);
      if (!config.allowedIntervals.includes(interval as never)) {
        res.status(400).json({
          error: `intervalMinutes must be one of ${config.allowedIntervals.join(', ')}`,
        });
        return;
      }
      patch.intervalMinutes = interval;
    }
    if (req.body?.enabled !== undefined) patch.enabled = Boolean(req.body.enabled);
    if (req.body?.groupId !== undefined) {
      const groupId = parseGroupId(req.body.groupId);
      if (!groupIdIsValid(groupId)) {
        res.status(400).json({ error: 'groupId must reference an existing group' });
        return;
      }
      patch.groupId = groupId;
    }

    const updated = ResourceModel.update(id, patch);
    if (!updated) {
      res.status(404).json({ error: 'resource not found' });
      return;
    }
    res.json(updated);
  },

  /** POST /admin/api/resources/reorder — body: { ids: number[] }. */
  reorderResources(req: Request, res: Response): void {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
      res.status(400).json({ error: 'ids must be an array of integers' });
      return;
    }
    ResourceModel.reorder(ids);
    res.json({ ok: true });
  },

  /** DELETE /admin/api/resources/:id */
  deleteResource(req: Request, res: Response): void {
    const ok = ResourceModel.remove(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'resource not found' });
      return;
    }
    res.status(204).end();
  },

  /** POST /admin/api/resources/:id/check — run an immediate check. */
  async checkResource(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    if (!ResourceModel.find(id)) {
      res.status(404).json({ error: 'resource not found' });
      return;
    }
    await checkNow(id);
    res.json({ ok: true });
  },

  /** GET /admin/api/news */
  listNews(_req: Request, res: Response): void {
    res.json(NewsModel.all());
  },

  /** POST /admin/api/news */
  createNews(req: Request, res: Response): void {
    const title = str(req.body?.title);
    const body = str(req.body?.body);
    const level = (str(req.body?.level) || 'info') as News['level'];

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!NEWS_LEVELS.includes(level)) {
      res.status(400).json({ error: `level must be one of ${NEWS_LEVELS.join(', ')}` });
      return;
    }
    res.status(201).json(NewsModel.create({ title, body, level }));
  },

  /** PUT /admin/api/news/:id — toggle active state. */
  updateNews(req: Request, res: Response): void {
    const id = Number(req.params.id);
    const active = Boolean(req.body?.active);
    if (!NewsModel.setActive(id, active)) {
      res.status(404).json({ error: 'news not found' });
      return;
    }
    res.json({ ok: true });
  },

  /** DELETE /admin/api/news/:id */
  deleteNews(req: Request, res: Response): void {
    if (!NewsModel.remove(Number(req.params.id))) {
      res.status(404).json({ error: 'news not found' });
      return;
    }
    res.status(204).end();
  },

  /** GET /admin/api/account — current admin username. */
  account(_req: Request, res: Response): void {
    res.json({ username: CredentialsModel.get()?.username ?? null });
  },

  /** PUT /admin/api/account — change username and/or password. */
  updateAccount(req: Request, res: Response): void {
    const username = str(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username) {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'password must be at least 6 characters' });
      return;
    }
    CredentialsModel.update(username, password);
    // Force re-auth with the new credentials.
    res
      .set('WWW-Authenticate', 'Basic realm="Status Page Admin"')
      .json({ ok: true, reauth: true });
  },
};
