import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeartPulse, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const home = user?.role === 'DOCTOR' ? '/doctor' : user?.role === 'ADMIN' ? '/admin' : user ? '/patient' : '/';

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <Link to={home} className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-pine text-white">
            <HeartPulse size={22} />
          </div>
          <span className="font-display text-2xl font-bold">LatticeCare</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-semibold text-ink/70">
          {!user && (
            <>
              <Link to="/login" className="hover:text-pine">Sign in</Link>
              <Link to="/register" className="btn !px-4 !py-2">Create account</Link>
            </>
          )}
          {user && (
            <>
              <span className="hidden text-ink/50 sm:inline">Hi, {user.firstName}</span>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="ghost flex items-center gap-1 !px-3 !py-2"
              >
                <LogOut size={16} /> Sign out
              </button>
            </>
          )}
        </nav>
      </header>
      {children}
      <footer className="mx-auto flex max-w-6xl justify-between px-6 py-8 text-sm text-ink/60">
        <span>Private by design. Practical by nature.</span>
        <span>Care, clearly connected.</span>
      </footer>
    </div>
  );
}
