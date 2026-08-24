import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';
import type { Prisma } from '@prisma/client';

export const adminRouter = Router();
adminRouter.use(requireAuth(['ADMIN']));

const doctorInput = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  specialization: z.string().min(1),
  bio: z.string().max(300).optional(),
  slotMinutes: z.coerce.number().int().min(5).max(180).default(30),
  availability: z.array(z.object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })).min(1),
});

adminRouter.get('/doctors', async (_req, res) => {
  res.json(await prisma.doctor.findMany({
    include: { user: { select: { firstName: true, lastName: true, email: true } }, availability: true, leaveDays: true },
    orderBy: { createdAt: 'desc' },
  }));
});

adminRouter.post('/doctors', async (req, res, next) => {
  try {
    const input = doctorInput.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return res.status(409).json({ error: 'An account already exists for this email' });
    const tempPassword = Math.random().toString(36).slice(2, 10) + 'A1!';
    const doctor = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: { email: input.email, firstName: input.firstName, lastName: input.lastName, role: 'DOCTOR', passwordHash: await bcrypt.hash(tempPassword, 12) },
      });
      const doc = await tx.doctor.create({
        data: { userId: user.id, specialization: input.specialization, bio: input.bio, slotMinutes: input.slotMinutes },
      });
      await tx.doctorAvailability.createMany({
        data: input.availability.map((a) => ({ doctorId: doc.id, weekday: a.weekday, startTime: a.startTime, endTime: a.endTime })),
      });
      return doc;
    });
    res.status(201).json({ doctor, temporaryPassword: tempPassword });
  } catch (error) { next(error); }
});

adminRouter.get('/appointments', async (_req, res) => {
  res.json(await prisma.appointment.findMany({
    include: { doctor: { include: { user: true } }, patient: true, preVisitSummary: true, postVisitSummary: true },
    orderBy: { startsAt: 'desc' },
  }));
});
