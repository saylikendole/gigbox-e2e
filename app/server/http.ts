import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { db, type User } from './db.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

export const SESSION_COOKIE = 'gigbox_session';

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function currentUser(req: Request): User | undefined {
  const sid = readCookie(req, SESSION_COOKIE);
  const userId = sid ? db.sessions.get(sid) : undefined;
  return userId ? db.users.find((u) => u.id === userId) : undefined;
}

export function requireUser(req: Request, _res: Response, next: NextFunction): void {
  const user = currentUser(req);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in');
  req.user = user;
  next();
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
