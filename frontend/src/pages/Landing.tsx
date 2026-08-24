import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Stethoscope, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Toast } from '../components/ui';

type Doctor = { id: string; specialization: string; bio?: string; user: { firstName: string; lastName: string } };
type Slot = { startsAt: string; endsAt: string };

export function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Doctor>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [message, setMessage] = useState('');
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [symptomForm, setSymptomForm] = useState({ symptoms: '', duration: '', medications: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/doctors' + (query ? '?specialization=' + encodeURIComponent(query) : '')).then(setDoctors).catch((e) => setMessage(e.message));
  }, [query]);

  useEffect(() => {
    if (selected) api(`/doctors/${selected.id}/slots?date=${date}`).then(setSlots).catch((e) => setMessage(e.message));
  }, [selected, date]);

  const pickSlot = (slot: Slot) => {
    if (!user) {
      setMessage('Sign in to reserve this time, then complete your symptom form.');
      return;
    }
    if (user.role !== 'PATIENT') {
      setMessage('Sign in with a patient account to book an appointment.');
      return;
    }
    setBookingSlot(slot);
  };

  const confirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !bookingSlot) return;
    setSubmitting(true);
    try {
      await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({ doctorId: selected.id, startsAt: bookingSlot.startsAt, ...symptomForm }),
      });
      navigate('/patient', { state: { justBooked: true } });
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-[.18em] text-coral">Appointment management, made human</p>
          <h1 className="max-w-xl font-display text-5xl leading-[1.04]">A calmer path from symptom to follow-up.</h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink/70">
            Find a clinician, share what is happening before you arrive, and keep every next step close at hand.
          </p>
          <div className="mt-10 flex gap-7 text-sm">
            <span className="flex items-center gap-2"><CalendarDays size={18} className="text-pine" />Live availability</span>
            <span className="flex items-center gap-2"><Stethoscope size={18} className="text-pine" />Prepared visits</span>
          </div>
        </div>
        <div className="card p-6">
          <p className="font-display text-2xl">Find your clinician</p>
          <label className="label mt-5">Specialty</label>
          <input className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Cardiology" />
          <div className="mt-5 space-y-3">
            {doctors.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className={'w-full rounded-xl border p-4 text-left ' + (selected?.id === d.id ? 'border-pine bg-mint' : 'border-ink/10 hover:border-pine/40')}
              >
                <span className="font-semibold">Dr. {d.user.firstName} {d.user.lastName}</span>
                <span className="mt-1 block text-sm text-ink/60">{d.specialization} · {d.bio}</span>
              </button>
            ))}
            {!doctors.length && <EmptyState text="No clinicians match that specialty yet." />}
          </div>
        </div>
      </section>

      {selected && (
        <section className="border-t border-ink/10 bg-mint/45">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <p className="font-display text-3xl">Choose a time with Dr. {selected.user.lastName}</p>
            <input className="field mt-5 max-w-xs" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="mt-5 flex flex-wrap gap-3">
              {slots.map((s) => (
                <button
                  key={s.startsAt}
                  className="rounded-xl border border-pine/20 bg-white px-4 py-3 text-sm font-semibold hover:bg-pine hover:text-white"
                  onClick={() => pickSlot(s)}
                >
                  {new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
              {!slots.length && <p className="text-ink/65">No available times on this day.</p>}
            </div>
          </div>
        </section>
      )}

      {bookingSlot && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6">
          <div className="card w-full max-w-lg p-7">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="font-display text-2xl">Before your visit</p>
                <p className="mt-1 text-sm text-ink/60">
                  Dr. {selected.user.lastName} · {new Date(bookingSlot.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <button onClick={() => setBookingSlot(null)} className="text-ink/40 hover:text-ink"><X size={20} /></button>
            </div>
            <form onSubmit={confirmBooking} className="space-y-4">
              <div>
                <label className="label">What's going on? (symptoms)</label>
                <textarea
                  className="field min-h-[100px]"
                  required
                  minLength={10}
                  value={symptomForm.symptoms}
                  onChange={(e) => setSymptomForm({ ...symptomForm, symptoms: e.target.value })}
                  placeholder="Describe your symptoms in a sentence or two…"
                />
              </div>
              <div>
                <label className="label">How long has this been going on?</label>
                <input className="field" value={symptomForm.duration} onChange={(e) => setSymptomForm({ ...symptomForm, duration: e.target.value })} placeholder="e.g. 3 days" />
              </div>
              <div>
                <label className="label">Current medications (optional)</label>
                <input className="field" value={symptomForm.medications} onChange={(e) => setSymptomForm({ ...symptomForm, medications: e.target.value })} placeholder="e.g. None, or list medications" />
              </div>
              <button className="btn w-full" disabled={submitting}>{submitting ? 'Confirming…' : 'Confirm appointment'}</button>
            </form>
          </div>
        </div>
      )}

      <Toast message={message} onClose={() => setMessage('')} />
    </>
  );
}
