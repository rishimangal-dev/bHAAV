'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function JoinByCodePage() {
  const router = useRouter();
  const { code } = useParams();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const joinCommunity = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/join/' + code);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('join_community_by_code', {
        p_code: code,
      });

      if (rpcError) {
        setError(rpcError.message);
        setStatus('error');
        return;
      }

      if (data && data.community_id) {
        router.push('/community/' + data.community_id);
      } else if (data && data.error) {
        setError(data.error);
        setStatus('error');
      } else {
        setError('Unexpected response from server');
        setStatus('error');
      }
    };

    joinCommunity();
  }, [code, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-neutral-500 text-sm">Joining community...</p>
        <p className="text-neutral-600 text-xs">Code: {code}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <p className="text-4xl mb-4">😕</p>
        <h1 className="text-lg font-semibold text-white mb-2">Could not join</h1>
        <p className="text-sm text-red-400 mb-6">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-neutral-300 hover:text-white transition-colors cursor-pointer"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
