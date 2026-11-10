import { CookieOptions, Request, Response } from 'express';
import prisma from '../prisma/client';

export const sessionCookie: CookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
export const sessionExpiry = () => new Date(Date.now() + 30 * 86400000);

export async function refreshSession(req: Request, res: Response) {
  const expiresAt = sessionExpiry();
  await prisma.session.update({ where: { id: req.session!.id }, data: { expiresAt } });
  res.cookie('session_id', req.session!.id, { ...sessionCookie, expires: expiresAt });
}
