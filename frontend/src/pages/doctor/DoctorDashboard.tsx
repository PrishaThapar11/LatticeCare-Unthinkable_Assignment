import React, { useEffect, useState } from 'react';
import { CalendarPlus, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState, StatusBadge, UrgencyBadge, Toast } from '../../components/ui';

type Appointment = {
  id: string;
  startsAt: string;
  status: string;
  patient: { firstName: string; lastName: string; email: string };
  symptomForm?: { symptoms: string; duration?: string; medications?: string };
  preVisitSummary?: { urgency: 'LOW' | 'MEDIUM' | 'HIGH'; chiefComplaint: string; suggestedQuestions: string[] };
  postVisitSummary?: { summary: string };
};

type MedRow = { medication: string; dosage: string; frequency: string };

export function DoctorDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [visitFor, setVisitFor] = useState<Appointment | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [meds, setMeds] = useState<MedRow[]>([{ medication: '', dosage: '', frequency: '' }]);
  const [submittingVisit, setSubmittingVisit] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api('/appointments/mine')
      .then((data: Appointment[]) => {
        setAppointments(data);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // We need the doctor's own id (not user id) for leave/calendar endpoints.
  useEffect(() => {
    api('/doctors').then((docs: { id: string; user: { email: string } }[]) => {
      const me = JSON.parse(localStorage.getItem('lc_user') || 'null');
      const mine = docs.find((d) => d.user && me && d.user.email === me.email);
      if (mine) setDoctorId(mine.id);
    }).catch(() => {});
  }, []);

  const now = Date.now();
  const upcoming = appointments.filter((a) => new Date(a.startsAt).getTime() >= now && a.status !== 'CANCELLED');
  const completed = appointments.filter((a) => a.status === 'COMPLETED');

  const openVisit = (a: Appointment) => {
    setVisitFor(a);
    setClinicalNotes('');
    setMeds([{ medication: '', dosage: '', frequency: '' }]);
  };

  const submitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitFor) return;
    setSubmittingVisit(true);
    try {
      await api(`/appointments/${visitFor.id}/visit`, {
        method: 'POST',
        body: JSON.stringify({ clinicalNotes, medications: meds.filter((m) => m.medication.trim()) }),
      });
      setVisitFor(null);
      load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSubmittingVisit(false);
    }
  };

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId || !leaveDate) return;
    setLeaveBusy(true);
    try {
      const res = await api(`/doctors/${doctorId}/leave`, { method: 'POST', body: JSON.stringify({ date: leaveDate, reason: leaveReason }) });
      setMessage(res.affectedBookings ? `Leave recorded. ${res.affectedBookings} affected patient(s) notified.` : 'Leave day recorded.');
      setLeaveDate('');
      setLeaveReason('');
      load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLeaveBusy(false);
    }
  };

  const connectCalendar = async () => {
    try {
      const res = await api('/calendar/connect');
      window.open(res.url, '_blank');
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.18em] text-coral">Clinician view</p>
          <h1 className="font-display text-3xl">Your schedule</h1>
        </div>
        <button onClick={connectCalendar} className="ghost flex items-center gap-2 border border-pine/20">
          <CalendarPlus size={18} /> Connect Google Calendar
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-3 font-display text-xl">Upcoming visits</h2>
          {loading && <p className="text-ink/50">Loading…</p>}
          <div className="space-y-4">
            {upcoming.map((a) => (
              <div key={a.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{a.patient.firstName} {a.patient.lastName}</p>
                    <p className="text-sm text-ink/60">{new Date(a.startsAt).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                {a.preVisitSummary && (
                  <div className="mt-4 rounded-xl bg-clay p-4">
                    <div className="mb-2"><UrgencyBadge level={a.preVisitSummary.urgency} /></div>
                    <p className="text-sm font-semibold text-ink/80">{a.preVisitSummary.chiefComplaint}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/70">
                      {a.preVisitSummary.suggestedQuestions?.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={() => openVisit(a)} className="btn mt-4 !px-4 !py-2 text-sm">Complete visit notes</button>
              </div>
            ))}
            {!loading && !upcoming.length && <EmptyState text="No upcoming visits scheduled." />}
          </div>

          <h2 className="mb-3 mt-10 font-display text-xl">Recently completed</h2>
          <div className="space-y-3">
            {completed.slice(0, 5).map((a) => (
              <div key={a.id} className="card p-4 text-sm">
                <p className="font-semibold">{a.patient.firstName} {a.patient.lastName}</p>
                <p className="text-ink/60">{new Date(a.startsAt).toLocaleDateString()}</p>
              </div>
            ))}
            {!completed.length && <EmptyState text="Completed visits will appear here." />}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-display text-xl">Mark a leave day</h2>
          <form onSubmit={submitLeave} className="card space-y-4 p-5">
            <div>
              <label className="label">Date</label>
              <input className="field" type="date" required value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input className="field" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="e.g. Conference" />
            </div>
            <button className="btn w-full" disabled={leaveBusy || !doctorId}>{leaveBusy ? 'Saving…' : 'Record leave day'}</button>
            <p className="text-xs text-ink/50">Any patients already booked that day are notified automatically and flagged for rescheduling.</p>
          </form>
        </div>
      </div>

      {visitFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6">
          <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-7">
            <p className="font-display text-2xl">Visit notes — {visitFor.patient.firstName} {visitFor.patient.lastName}</p>
            <form onSubmit={submitVisit} className="mt-5 space-y-4">
              <div>
                <label className="label">Clinical notes</label>
                <textarea className="field min-h-[100px]" required minLength={10} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} placeholder="Assessment, diagnosis, treatment plan…" />
              </div>
              <div>
                <label className="label">Prescription</label>
                <div className="space-y-2">
                  {meds.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="field" placeholder="Medication" value={m.medication} onChange={(e) => setMeds(meds.map((row, j) => (j === i ? { ...row, medication: e.target.value } : row)))} />
                      <input className="field" placeholder="Dosage" value={m.dosage} onChange={(e) => setMeds(meds.map((row, j) => (j === i ? { ...row, dosage: e.target.value } : row)))} />
                      <input className="field" placeholder="Frequency" value={m.frequency} onChange={(e) => setMeds(meds.map((row, j) => (j === i ? { ...row, frequency: e.target.value } : row)))} />
                      <button type="button" onClick={() => setMeds(meds.filter((_, j) => j !== i))} className="text-ink/40 hover:text-red-600"><Trash2 size={18} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setMeds([...meds, { medication: '', dosage: '', frequency: '' }])} className="ghost flex items-center gap-1 !px-3 !py-1.5 text-sm">
                    <Plus size={16} /> Add medication
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setVisitFor(null)} className="ghost flex-1">Cancel</button>
                <button className="btn flex-1" disabled={submittingVisit}>{submittingVisit ? 'Generating summary…' : 'Complete visit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={message} onClose={() => setMessage('')} />
    </section>
  );
}
