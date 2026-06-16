import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

const SESSION_COOKIE = 'glob_session';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    throw new UnauthorizedError('Not authenticated');
  }

  try {
    const payload = verifyAuthToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired session');
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
