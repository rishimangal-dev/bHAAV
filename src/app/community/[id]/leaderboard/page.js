'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const STARTING_BALANCE = 20000;

function formatRupees(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { id: communityId } = useParams();
  const [rows, setRows] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserId(user.id);

    const { data, error } = await supabase.rpc('get_leaderboard', { p_community_id: communityId });
    if (!error && data) setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={'/community/' + communityId} className="text-neutral-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-sm font-semibold">Leaderboard</h1>
        </div>
      </div>

      {/* Content */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-neutral-500 text-sm">No members yet</p>
        </div>
      ) : (
        <div className="px-4 pt-4 pb-20 space-y-2">
          {rows.map((r, i) => {
            const rank = i + 1;
            const isMe = r.user_id === userId;
            const netWorth = Number(r.net_worth || 0);
            const cash = Number(r.cash_balance || 0);
            const portfolio = Number(r.portfolio_value || 0);
            const positions = Number(r.position_count || 0);
            const isUp = netWorth >= STARTING_BALANCE;

            return (
              <div
                key={r.user_id}
                className={"rounded-xl p-4 border transition-all " + (isMe ? 'bg-emerald-950/30 border-emerald-800' : 'bg-neutral-900 border-neutral-800')}
              >
                <div className="flex items-start gap-3">
                  {/* Rank */}
                  <div className="flex flex-col items-center justify-center w-8 shrink-0 pt-0.5">
                    <span className={"text-lg font-bold " + (rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-neutral-300' : rank === 3 ? 'text-amber-600' : 'text-neutral-500')}>
                      {rank === 1 ? '🏆' : '#' + rank}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white truncate">
                        {isMe ? 'You' : (r.display_name || r.email || 'Anonymous')}
                      </p>
                      {isMe && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 font-medium shrink-0">You</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span>Cash {formatRupees(cash)}</span>
                      <span>Portfolio {formatRupees(portfolio)}</span>
                      <span>{positions} position{positions !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Net worth */}
                  <div className="text-right shrink-0">
                    <p className={"text-sm font-bold " + (isUp ? 'text-emerald-400' : 'text-red-400')}>
                      {formatRupees(netWorth)}
                    </p>
                    <p className={"text-xs " + (isUp ? 'text-emerald-500' : 'text-red-500')}>
                      {isUp ? '▲' : '▼'} {Math.abs(((netWorth - STARTING_BALANCE) / STARTING_BALANCE) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
