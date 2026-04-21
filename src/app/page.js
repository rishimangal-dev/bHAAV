'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      setLoading(false);
    };

    checkUser();

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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-900 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Bhaav</h1>
        <button
          onClick={handleSignOut}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="px-6 py-12 max-w-sm mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block px-3 py-1 bg-green-900/30 border border-green-800 rounded-full text-xs text-green-400 font-medium mb-4">
            Signed in
          </div>
          <p className="text-neutral-400 text-sm mb-1">Welcome back</p>
          <p className="text-white font-medium">{user?.email}</p>
        </div>

        <div className="space-y-3">
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
              Coming soon
            </div>
            <div className="text-sm text-neutral-300">
              Create or join a community to start trading
            </div>
          </div>

          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
              User ID
            </div>
            <div className="text-xs text-neutral-400 font-mono break-all">
              {user?.id}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}