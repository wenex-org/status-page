import { Router } from 'express';
import path from 'node:path';

import { config } from '../config.js';
import { basicAuth } from '../middleware/basic-auth.js';
import { AdminController } from '../controllers/admin.controller.js';
import { GroupController } from '../controllers/group.controller.js';

/** Admin routes — every route is protected by Basic Auth. */
export const adminRouter = Router();

adminRouter.use(basicAuth);

// Admin SPA shell.
adminRouter.get('/', (_req, res) => {
  res.sendFile(path.join(config.publicDir, 'admin.html'));
});

// Meta (configurable choices for the UI)
adminRouter.get('/api/meta', AdminController.meta);

// Groups
adminRouter.get('/api/groups', GroupController.list);
adminRouter.post('/api/groups', GroupController.create);
adminRouter.post('/api/groups/reorder', GroupController.reorder);
adminRouter.put('/api/groups/:id', GroupController.rename);
adminRouter.delete('/api/groups/:id', GroupController.remove);

// Resources
adminRouter.get('/api/resources', AdminController.listResources);
adminRouter.post('/api/resources', AdminController.createResource);
adminRouter.post('/api/resources/reorder', AdminController.reorderResources);
adminRouter.put('/api/resources/:id', AdminController.updateResource);
adminRouter.delete('/api/resources/:id', AdminController.deleteResource);
adminRouter.post('/api/resources/:id/check', (req, res, next) => {
  AdminController.checkResource(req, res).catch(next);
});

// News
adminRouter.get('/api/news', AdminController.listNews);
adminRouter.post('/api/news', AdminController.createNews);
adminRouter.put('/api/news/:id', AdminController.updateNews);
adminRouter.delete('/api/news/:id', AdminController.deleteNews);

// Account
adminRouter.get('/api/account', AdminController.account);
adminRouter.put('/api/account', AdminController.updateAccount);
