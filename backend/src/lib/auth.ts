import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
export type Claims = { sub: string; role: Role; email: string };
const secret = () => process.env.JWT_SECRET || 'development-secret-change-me';
export const signToken = (user: Claims) => jwt.sign(user, secret(), { expiresIn: '7d' });
export function requireAuth(roles?: Role[]) { return (req: Request, res: Response, next: NextFunction) => { try { const token = req.headers.authorization?.replace('Bearer ', ''); if (!token) throw Error(); const claims = jwt.verify(token, secret()) as Claims; if (roles && !roles.includes(claims.role)) return res.status(403).json({ error: 'Insufficient permissions' }); (req as Request & { user: Claims }).user = claims; next(); } catch { res.status(401).json({ error: 'Authentication required' }); } }; }
export const currentUser = (req: Request) => (req as Request & { user: Claims }).user;
