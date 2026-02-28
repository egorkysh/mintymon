'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
      } else {
        const data = await res.json();
        setError(data.error || 'Authentication failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center noise-bg">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-healthy/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-accent-bg mb-4">
            <Monitor className="w-6 h-6 text-accent" />
            <div className="absolute inset-0 rounded-xl bg-accent/10 blur-md" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            mintymon
          </h1>
          <p className="text-[11px] text-text-tertiary uppercase tracking-[0.2em] mt-1">
            monitoring dashboard
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
            />
          </div>

          {error && (
            <p className="text-xs text-critical font-medium px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent text-sm font-semibold text-bg transition-all hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Authenticate
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Subtle footer */}
        <p className="text-center text-[10px] text-text-tertiary/50 mt-8 tracking-wide">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
