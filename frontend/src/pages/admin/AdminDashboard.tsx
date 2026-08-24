import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState, StatusBadge, Toast } from '../../components/ui';

type AvailRow = { weekday: number; startTime: string; endTime: string };
type Doctor = {
  id: string; specialization: string; bio?: string; slotMinutes: number;
  user: { firstName: string; lastName: string; email: string };
  availability: AvailRow[];
};
type AdminAppointment = {
  id: string; startsAt: string; status: string;
  doctor: { user: { firstName: string; lastName: string } };
  patient: { firstName: string; lastName: string };
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AdminDashboard() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', specialization: '', bio: '', slotMinutes: 30 });
  const [availability, setAvailability] = useState<AvailRow[]>([{ weekday: 1, startTime: '09:00', endTime: '17:00' }]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'doctors' | 'bookings'>('doctors');

  const load = () => {
    api('/admin/doctors').then(setDoctors).catch((e) => setMessage(e.message));
    api('/admin/appointments').then(setAppointments).catch((e) => setMessage(e.message));
  };
  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api('/admin/doctors', { method: 'POST', body: JSON.stringify({ ...form, availability }) });
      setMessage(`Doctor profile created. Temporary password: ${res.temporaryPassword}`);
      setForm({ firstName: '', lastName: '', email: '', specialization: '', bio: '', slotMinutes: 30 });
      setAvailability([{ weekday: 1, startTime: '09:00', endTime: '17:00' }]);
      load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm font-bold uppercase tracking-[.18em] text-coral">Admin</p>
      <h1 className="font-display text-3xl">Clinic management</h1>

      <div className="mt-6 flex gap-3">
        <button onClick={() => setTab('doctors')} className={tab === 'doctors' ? 'btn !px-4 !py-2 text-sm' : 'ghost !px-4 !py-2 text-sm'}>Doctors</button>
        <button onClick={() => setTab('bookings')} className={tab === 'bookings' ? 'btn !px-4 !py-2 text-sm' : 'ghost !px-4 !py-2 text-sm'}>All bookings</button>
      </div>

      {tab === 'doctors' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={submit} className="card space-y-4 p-6">
            <p className="font-display text-xl">Add a doctor</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">First name</label><input className="field" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><label className="label">Last name</label><input className="field" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            </div>
            <div><label className="label">Email</label><input className="field" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Specialization</label><input className="field" required value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>
            <div><label className="label">Bio (optional)</label><input className="field" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            <div><label className="label">Slot length (minutes)</label><input className="field" type="number" min={5} max={180} value={form.slotMinutes} onChange={(e) => setForm({ ...form, slotMinutes: Number(e.target.value) })} /></div>

            <div>
              <label className="label">Working hours</label>
              <div className="space-y-2">
                {availability.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select className="field" value={a.weekday} onChange={(e) => setAvailability(availability.map((row, j) => (j === i ? { ...row, weekday: Number(e.target.value) } : row)))}>
                      {WEEKDAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                    </select>
                    <input className="field" type="time" value={a.startTime} onChange={(e) => setAvailability(availability.map((row, j) => (j === i ? { ...row, startTime: e.target.value } : row)))} />
                    <input className="field" type="time" value={a.endTime} onChange={(e) => setAvailability(availability.map((row, j) => (j === i ? { ...row, endTime: e.target.value } : row)))} />
                    <button type="button" onClick={() => setAvailability(availability.filter((_, j) => j !== i))} className="text-ink/40 hover:text-red-600"><Trash2 size={18} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setAvailability([...availability, { weekday: 1, startTime: '09:00', endTime: '17:00' }])} className="ghost flex items-center gap-1 !px-3 !py-1.5 text-sm">
                  <Plus size={16} /> Add day
                </button>
              </div>
            </div>
            <button className="btn w-full" disabled={busy}>{busy ? 'Creating…' : 'Create doctor profile'}</button>
          </form>

          <div>
            <p className="mb-3 font-display text-xl">Roster</p>
            <div className="space-y-3">
              {doctors.map((d) => (
                <div key={d.id} className="card p-4">
                  <p className="font-semibold">Dr. {d.user.firstName} {d.user.lastName}</p>
                  <p className="text-sm text-ink/60">{d.specialization} · {d.slotMinutes}-min slots · {d.user.email}</p>
                  <p className="mt-1 text-xs text-ink/50">
                    {d.availability.map((a) => `${WEEKDAYS[a.weekday]} ${a.startTime}-${a.endTime}`).join(' · ')}
                  </p>
                </div>
              ))}
              {!doctors.length && <EmptyState text="No doctors yet — add one to get started." />}
            </div>
          </div>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="mt-8 space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{a.patient.firstName} {a.patient.lastName} → Dr. {a.doctor.user.firstName} {a.doctor.user.lastName}</p>
                <p className="text-sm text-ink/60">{new Date(a.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
          {!appointments.length && <EmptyState text="No bookings yet." />}
        </div>
      )}

      <Toast message={message} onClose={() => setMessage('')} />
    </section>
  );
}
