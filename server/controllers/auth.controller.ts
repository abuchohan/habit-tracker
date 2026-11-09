// Based on Spring Board's Prisma sessions and httpOnly cookie authentication.
import { CookieOptions, Request, Response } from 'express';
import prisma from '../prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { sendPasswordResetEmail } from '../services/email';
const credentials = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(8).max(72) });
const cookie: CookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
const expiry = () => new Date(Date.now() + 30 * 86400000);
export async function register(req: Request, res: Response) {
  const result = credentials.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Enter a valid email and a password of 8–72 characters.' });
  try {
    const { email, password } = result.data;
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, password: hash }, select: { id: true, email: true } });
    res.status(201).json({ user });
  } catch (err) {
    if (typeof err === 'object' && err && 'code' in err && err.code === 'P2002') return res.status(409).json({ error: 'That email is already registered.' });
    res.status(500).json({ error: 'Unable to create account.' });
  }
}
export async function login(req: Request, res: Response) {
  const result = credentials.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Enter your email and password.' });
  try {
    const user = await prisma.user.findUnique({ where: { email: result.data.email } });
    if (!user || !await bcrypt.compare(result.data.password, user.password)) return res.status(401).json({ error: 'Invalid email or password.' });
    const expiresAt = expiry();
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt } });
    res.cookie('session_id', session.id, { ...cookie, expires: expiresAt });
    res.json({ user: { id: user.id, email: user.email } });
  } catch { res.status(500).json({ error: 'Unable to sign in.' }); }
}
export async function logout(req: Request, res: Response) {
  try {
    await prisma.session.deleteMany({ where: { id: req.session!.id } });
    res.clearCookie('session_id', cookie).json({ message: 'Signed out.' });
  } catch { res.status(500).json({ error: 'Unable to sign out. Please try again.' }); }
}
export async function me(req: Request, res: Response) {
  try {
    const expiresAt = expiry();
    await prisma.session.update({ where: { id: req.session!.id }, data: { expiresAt } });
    res.cookie('session_id', req.session!.id, { ...cookie, expires: expiresAt });
    res.json({ user: { id: req.user!.id, email: req.user!.email } });
  } catch { res.status(500).json({ error: 'Unable to refresh session.' }); }
}
export async function resetPassword(req: Request, res: Response) {
  const result = z.string().trim().email().max(254).safeParse(req.body.email);
  if (!result.success) return res.status(400).json({ error: 'Enter a valid email.' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Password reset email is not configured on this server.' });
  try {
    const user = await prisma.user.findUnique({ where: { email: result.data.toLowerCase() } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const digest = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.passwordReset.create({ data: { userId: user.id, token: digest, expiresAt: new Date(Date.now() + 15 * 60000) } });
      await sendPasswordResetEmail(user.email, `${process.env.FRONTEND_URL}/?reset=${token}`);
    }
    res.json({ message: 'If that account exists, a reset link has been emailed.' });
  } catch { res.status(500).json({ error: 'Unable to request a reset email.' }); }
}
function tokenHash(token: unknown) { return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? crypto.createHash('sha256').update(token).digest('hex') : ''; }
export async function validateResetToken(req: Request, res: Response) {
  try {
    const token = tokenHash(req.params.resetToken);
    const reset = token ? await prisma.passwordReset.findFirst({ where: { token, used: false, expiresAt: { gt: new Date() } } }) : null;
    return reset ? res.json({ message: 'Token is valid.' }) : res.status(400).json({ error: 'This reset link has expired or is invalid.' });
  } catch { res.status(500).json({ error: 'Unable to validate link.' }); }
}
export async function resetPasswordToken(req: Request, res: Response) {
  const result = z.string().min(8).max(72).safeParse(req.body.password);
  const token = tokenHash(req.params.resetToken);
  if (!result.success || !token) return res.status(400).json({ error: 'Invalid reset link or password. Use 8–72 characters.' });
  try {
    const password = await bcrypt.hash(result.data, 12);
    await prisma.$transaction(async tx => {
      const reset = await tx.passwordReset.findFirst({ where: { token, used: false, expiresAt: { gt: new Date() } } });
      if (!reset) throw new Error('Invalid token');
      const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, used: false }, data: { used: true } });
      if (claimed.count !== 1) throw new Error('Invalid token');
      await tx.user.update({ where: { id: reset.userId }, data: { password } });
      await tx.session.deleteMany({ where: { userId: reset.userId } });
    });
    res.json({ message: 'Password changed. You can now sign in.' });
  } catch { res.status(400).json({ error: 'This reset link has expired or is invalid.' }); }
}
