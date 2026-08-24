import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { EmptyState, StatusBadge, UrgencyBadge } from '../../components/ui';

type Appointment = {
  id: string;
  startsAt: string;
  status: string;
  doctor: { specialization: string; user: { firstName: string; lastName: string } };
  symptomForm?: { symptoms: string; duration?: string };
  preVisitSummary?: { urgency: 'LOW' | 'MEDIUM' | 'HIGH'; chiefComplaint: string; suggestedQuestions: string[] };
  postVisitSummary?: { summary: string; followUpSteps: string };
  prescription?: { medications: { medication: string; dosage: string; frequency: string; active: boolean }[] };
};

export function PatientDashboard() {
  const location = useLocation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [justBooked, setJustBooked] = useState(!!(location.state as { justBooked?: boolean } | null)?.justBooked);

  const load = () => {
    setLoading(true);
    api('/appointments/mine').then(setAppointments).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const cancel = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await api(`/appointments/${id}/cancel`, { method: 'PATCH' });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const now = Date.now();
  const upcoming = appointments.filter((a) => new Date(a.startsAt).getTime() >= now && a.status !== 'CANCELLED');
  const past = appointments.filter((a) => new Date(a.startsAt).getTime() < now || a.status === 'CANCELLED');

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.18em] text-coral">Your care</p>
          <h1 className="font-display text-3xl">Appointments</h1>
        </div>
        <Link to="/" className="btn">Book a visit</Link>
      </div>

      {justBooked && (
        <div className="mb-6 rounded-xl bg-mint p-4 text-sm text-pine">
          Appointment confirmed. Your clinician will see a pre-visit summary before your visit.
          <button className="ml-3 font-semibold underline" onClick={() => setJustBooked(false)}>Dismiss</button>
        </div>
      )}
      {error && <p className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-ink/50">Loading your appointments…</p>}

      {!loading && (
        <>
          <h2 className="mb-3 font-display text-xl">Upcoming</h2>
          <div className="mb-10 space-y-4">
            {upcoming.map((a) => (
              <div key={a.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Dr. {a.doctor.user.firstName} {a.doctor.user.lastName} · {a.doctor.specialization}</p>
                    <p className="text-sm text-ink/60">{new Date(a.startsAt).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                {a.preVisitSummary && (
                  <div className="mt-4 rounded-xl bg-clay p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <UrgencyBadge level={a.preVisitSummary.urgency} />
                    </div>
                    <p className="text-sm text-ink/80">{a.preVisitSummary.chiefComplaint}</p>
                  </div>
                )}
                {a.status !== 'CANCELLED' && (
                  <button onClick={() => cancel(a.id)} className="ghost mt-4 !px-3 !py-1.5 text-sm">Cancel appointment</button>
                )}
              </div>
            ))}
            {!upcoming.length && <EmptyState text="No upcoming appointments. Book a visit to get started." />}
          </div>

          <h2 className="mb-3 font-display text-xl">Past & follow-up</h2>
          <div className="space-y-4">
            {past.map((a) => (
              <div key={a.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Dr. {a.doctor.user.firstName} {a.doctor.user.lastName}</p>
                    <p className="text-sm text-ink/60">{new Date(a.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                {a.postVisitSummary && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-mint/50 p-4">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-pine">Visit summary</p>
                      <p className="text-sm text-ink/80">{a.postVisitSummary.summary}</p>
                    </div>
                    <div className="rounded-xl bg-clay p-4">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/60">Follow-up steps</p>
                      <p className="text-sm text-ink/80">{a.postVisitSummary.followUpSteps}</p>
                    </div>
                    {!!a.prescription?.medications.length && (
                      <div className="rounded-xl border border-ink/10 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">Medication reminders</p>
                        <ul className="space-y-1 text-sm text-ink/80">
                          {a.prescription.medications.map((m, i) => (
                            <li key={i}>{m.medication} — {m.dosage}, {m.frequency}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!past.length && <EmptyState text="Nothing here yet." />}
          </div>
        </>
      )}
    </section>
  );
}
