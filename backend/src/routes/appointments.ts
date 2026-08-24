import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { preVisit, postVisit } from '../lib/ai.js';
import { queueNotification } from '../lib/notifications.js';
import { createCalendarEvent, deleteCalendarEvent } from '../lib/googleCalendar.js';
import type { Prisma } from '@prisma/client';

export const appointmentRouter = Router();
const booking = z.object({ doctorId: z.string(), startsAt: z.coerce.date(), symptoms: z.string().min(10).max(5000), duration: z.string().max(100).optional(), medications: z.string().max(500).optional() });

appointmentRouter.get('/mine', requireAuth(), async (req, res) => {
  const user = currentUser(req);
  const where = user.role === 'PATIENT' ? { patientId: user.sub } : user.role === 'DOCTOR' ? { doctor: { userId: user.sub } } : {};
  res.json(await prisma.appointment.findMany({ where, include: { doctor: { include: { user: true } }, patient: true, symptomForm: true, preVisitSummary: true, postVisitSummary: true, prescription: { include: { medications: true } } }, orderBy: { startsAt: 'asc' } }));
});

appointmentRouter.post('/', requireAuth(['PATIENT']), async (req, res, next) => {
  try {
    const input = booking.parse(req.body);
    const doctor = await prisma.doctor.findUnique({ where: { id: input.doctorId }, include: { user: true } });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    const endsAt = new Date(input.startsAt.getTime() + doctor.slotMinutes * 60000);
    let appointment;
    try {
      appointment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const occupied = await tx.appointment.findUnique({ where: { doctorId_startsAt: { doctorId: doctor.id, startsAt: input.startsAt } } });
        if (occupied) throw new Error('SLOT_TAKEN');
        return tx.appointment.create({ data: { doctorId: doctor.id, patientId: currentUser(req).sub, startsAt: input.startsAt, endsAt, status: 'CONFIRMED', symptomForm: { create: { symptoms: input.symptoms, duration: input.duration, medications: input.medications } } } });
      });
    } catch (error) {
      if ((error as Error).message === 'SLOT_TAKEN' || (error as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'This time was just booked. Please choose another slot.' });
      throw error;
    }
    const summary = await preVisit(input.symptoms);
    await prisma.preVisitSummary.create({ data: { appointmentId: appointment.id, urgency: summary.urgency as 'LOW' | 'MEDIUM' | 'HIGH', chiefComplaint: summary.chiefComplaint, suggestedQuestions: summary.suggestedQuestions, retryRequired: summary.retryRequired } });
    const patient = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).sub } });
    await Promise.all([queueNotification({ userId: patient.id, email: patient.email, subject: 'LatticeCare appointment confirmed', body: `Your appointment with Dr. ${doctor.user.lastName} is confirmed for ${input.startsAt.toLocaleString()}.`, type: 'BOOKING' }), queueNotification({ userId: doctor.userId, email: doctor.user.email, subject: 'New LatticeCare appointment', body: `A patient booked ${input.startsAt.toLocaleString()}.`, type: 'BOOKING' })]);
    await createCalendarEvent(appointment.id);
    res.status(201).json(appointment);
  } catch (error) { next(error); }
});

appointmentRouter.patch('/:id/cancel', requireAuth(), async (req, res, next) => {
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: String(req.params.id) }, include: { patient: true, doctor: { include: { user: true } } } });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    const user = currentUser(req);
    if (user.sub !== appointment.patientId && user.sub !== appointment.doctor.userId && user.role !== 'ADMIN') return res.status(403).json({ error: 'Not permitted' });
    const updated = await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELLED' } });
    await deleteCalendarEvent(appointment.id);
    await Promise.all([queueNotification({ userId: appointment.patientId, email: appointment.patient.email, subject: 'Appointment cancelled', body: 'Your LatticeCare appointment has been cancelled.', type: 'CANCELLATION' }), queueNotification({ userId: appointment.doctor.userId, email: appointment.doctor.user.email, subject: 'Appointment cancelled', body: 'A LatticeCare appointment has been cancelled.', type: 'CANCELLATION' })]);
    res.json(updated);
  } catch (error) { next(error); }
});

appointmentRouter.post('/:id/visit', requireAuth(['DOCTOR']), async (req, res, next) => {
  try {
    const input = z.object({ clinicalNotes: z.string().min(10), medications: z.array(z.object({ medication: z.string().min(1), dosage: z.string().min(1), frequency: z.string().min(1) })).min(1) }).parse(req.body);
    const appointment = await prisma.appointment.findUnique({ where: { id: String(req.params.id) }, include: { doctor: true } });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (appointment.doctor.userId !== currentUser(req).sub) return res.status(403).json({ error: 'Not your appointment' });
    const friendly = await postVisit(input.clinicalNotes);
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.postVisitSummary.upsert({ where: { appointmentId: appointment.id }, create: { appointmentId: appointment.id, ...friendly }, update: friendly });
      const prescription = await tx.prescription.upsert({ where: { appointmentId: appointment.id }, create: { appointmentId: appointment.id, notes: input.clinicalNotes }, update: { notes: input.clinicalNotes } });
      await tx.medicationReminder.deleteMany({ where: { prescriptionId: prescription.id } });
      await tx.medicationReminder.createMany({ data: input.medications.map((medication) => ({ ...medication, prescriptionId: prescription.id, nextReminderAt: new Date() })) });
      return tx.appointment.update({ where: { id: appointment.id }, data: { status: 'COMPLETED' } });
    });
    res.json(result);
  } catch (error) { next(error); }
});
