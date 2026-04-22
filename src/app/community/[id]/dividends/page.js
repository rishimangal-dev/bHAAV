'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

function formatRupees(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DividendHistoryPage() {
  const { id: communityId } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('dividend_ledger')
        .select('id, created_at, position_type, shares, dividend_per_share, total_dividend, matches:match_id (team_a, team_b, match_number, match_date), players:player_id (name)')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setRows(data);
      setLoading(false);
    };

    fetchData();
  }, [communityId]);

  const totalDividends = rows.reduce((sum, r) => sum + Number(r.total_dividend || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Loading dividends...</p>
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
          <h1 className="text-sm font-semibold">Dividend History</h1>
        </div>
      </div>

      {/* Total summary */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Total Dividends</p>
          <p className={"text-2xl font-bold " + (totalDividends >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {formatRupees(totalDividends)}
          </p>
        </div>
      </div>

      {/* Entries */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-neutral-500 text-sm">No dividends yet</p>
          <p className="text-neutral-600 text-xs mt-1">Buy some players and wait for matches to complete!</p>
        </div>
      ) : (
        <div className="px-4 pt-2 pb-20 space-y-2">
          {rows.map((r) => {
            const total = Number(r.total_dividend || 0);
            const isPositive = total >= 0;
            const matchLabel = (r.matches?.team_a || '?') + ' vs ' + (r.matches?.team_b || '?') + (r.matches?.match_number ? ' (Match #' + r.matches.match_number + ')' : '');

            return (
              <div key={r.id} className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-500 truncate">{matchLabel}</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{r.players?.name || 'Unknown'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={"text-xs font-bold px-2 py-0.5 rounded " + (r.position_type === 'long' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400')}>
                        {r.position_type === 'long' ? 'Long' : 'Short'}
                      </span>
                      <span className="text-xs text-neutral-500">{r.shares} share{r.shares !== 1 ? 's' : ''}</span>
                      <span className="text-xs text-neutral-600">@ {formatRupees(r.dividend_per_share)}/sh</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <p className={"text-sm font-bold " + (isPositive ? 'text-emerald-400' : 'text-red-400')}>
                      {isPositive ? '+' : ''}{formatRupees(total)}
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">{formatDate(r.created_at)}</p>
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
