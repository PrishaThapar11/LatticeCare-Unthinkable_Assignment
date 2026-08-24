import { google } from 'googleapis';
import { prisma } from './prisma.js';

const oauthClient = () => new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function calendarFor(refreshToken: string) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth: client });
}

/**
 * Creates a calendar event on the doctor's connected Google Calendar for a confirmed appointment.
 * Silently no-ops (never throws) if Calendar isn't configured or the doctor hasn't connected —
 * booking must never fail because of a calendar integration issue.
 */
export async function createCalendarEvent(appointmentId: string) {
  try {
    if (!isConfigured()) return;
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: { include: { user: true } }, patient: true },
    });
    if (!appt || !appt.doctor.googleRefreshToken) return;
    const calendar = await calendarFor(appt.doctor.googleRefreshToken);
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `LatticeCare: ${appt.patient.firstName} ${appt.patient.lastName}`,
        description: `Patient visit booked via LatticeCare.`,
        start: { dateTime: appt.startsAt.toISOString() },
        end: { dateTime: appt.endsAt.toISOString() },
        attendees: [{ email: appt.patient.email }, { email: appt.doctor.user.email }],
      },
    });
    if (event.data.id) {
      await prisma.appointment.update({ where: { id: appointmentId }, data: { calendarEventId: event.data.id } });
    }
  } catch (err) {
    console.error('Calendar event creation failed (non-fatal):', err);
  }
}

/** Deletes the calendar event tied to a cancelled or rescheduled appointment. Never throws. */
export async function deleteCalendarEvent(appointmentId: string) {
  try {
    if (!isConfigured()) return;
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { doctor: true } });
    if (!appt?.calendarEventId || !appt.doctor.googleRefreshToken) return;
    const calendar = await calendarFor(appt.doctor.googleRefreshToken);
    await calendar.events.delete({ calendarId: 'primary', eventId: appt.calendarEventId }).catch(() => {});
    await prisma.appointment.update({ where: { id: appointmentId }, data: { calendarEventId: null } });
  } catch (err) {
    console.error('Calendar event deletion failed (non-fatal):', err);
  }
}
