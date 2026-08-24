import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/patient');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <div className="card p-8">
        <p className="mb-1 text-sm font-bold uppercase tracking-[.18em] text-coral">Get started</p>
        <h1 className="font-display text-3xl">Create your patient account</h1>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First name</label>
              <input className="field" required value={form.firstName} onChange={set('firstName')} />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="field" required value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="field" type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="field" type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/60">
          Already have an account? <Link to="/login" className="font-semibold text-pine">Sign in</Link>
        </p>
        <p className="mt-4 text-xs text-ink/50">
          Doctor and admin accounts are created by clinic administrators, not through self-registration.
        </p>
      </div>
    </section>
  );
}
