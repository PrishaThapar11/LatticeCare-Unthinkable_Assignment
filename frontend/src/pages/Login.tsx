import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'DOCTOR' ? '/doctor' : user.role === 'ADMIN' ? '/admin' : '/patient');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <div className="card p-8">
        <p className="mb-1 text-sm font-bold uppercase tracking-[.18em] text-coral">Welcome back</p>
        <h1 className="font-display text-3xl">Sign in to LatticeCare</h1>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="label">Email</label>
            <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="field" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/60">
          New here? <Link to="/register" className="font-semibold text-pine">Create an account</Link>
        </p>
        <p className="mt-4 rounded-xl bg-clay p-3 text-xs leading-relaxed text-ink/60">
          Demo accounts (password <code className="font-mono">DemoPass123!</code>): admin@latticecare.demo · arjun.menon@demo.test (doctor) · ananya.shah@demo.test (patient)
        </p>
      </div>
    </section>
  );
}
