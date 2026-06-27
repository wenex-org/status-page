import type { NextFunction, Request, Response } from 'express';
import { CredentialsModel } from '../models/credentials.model.js';

/**
 * HTTP Basic Auth guard for the admin area. Verifies the supplied credentials
 * against the (hashed) values stored in SQLite.
 */
export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (header?.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    const username = decoded.slice(0, sep);
    const password = decoded.slice(sep + 1);

    if (sep !== -1 && CredentialsModel.verify(username, password)) {
      next();
      return;
    }
  }

  res
    .set('WWW-Authenticate', 'Basic realm="Status Page Admin", charset="UTF-8"')
    .status(401)
    .send('Authentication required.');
}
