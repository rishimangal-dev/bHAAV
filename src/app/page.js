'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <h1 className="text-lg font-bold tracking-tight">Bhaav</h1>
        <button
          onClick={handleSignOut}
          className="text-sm text-neutral-500 hover:text-white transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </header>

      {/* Main content */}
      <main className="max-w-sm mx-auto px-5 py-8">
        {/* User info */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-neutral-600 mb-1">Signed in as</p>
          <p className="text-sm text-neutral-300">{user?.email}</p>
        </div>

        {/* CTA button */}
        <button
          onClick={() => router.push('/communities')}
          className="w-full bg-white text-black rounded-2xl p-5 text-left hover:bg-neutral-100 transition-colors cursor-pointer mb-6"
        >
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Your communities</p>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Open market</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Join a Community */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Join a Community</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter invite code"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setJoinError(''); }}
              className="flex-1 px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors font-mono uppercase tracking-widest"
            />
            <button
              onClick={async () => {
                if (!joinCode.trim()) return;
                setJoining(true);
                setJoinError('');
                const { data, error } = await supabase.rpc('join_community_by_code', { p_code: joinCode.trim().toUpperCase() });
                setJoining(false);
                if (error) { setJoinError(error.message); return; }
                if (data && data.community_id) { router.push('/community/' + data.community_id); return; }
                if (data && data.error) { setJoinError(data.error); return; }
                setJoinError('Invalid code');
              }}
              disabled={joining || !joinCode.trim()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {joining ? '...' : 'Join'}
            </button>
          </div>
          {joinError && (
            <p className="text-xs text-red-400 mt-2">{joinError}</p>
          )}
        </div>

        {/* Info card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <p className="text-sm text-neutral-400 leading-relaxed">
            Create or join a community with friends. Everyone starts with ₹1,000. Trade IPL players whose prices move based on your community&#39;s buying and selling. After real matches, earn dividends based on player performance.
          </p>
        </div>
      </main>
    </div>
  );
}
