'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

function formatRupees(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const ACTION_COLORS = {
  buy: 'text-emerald-400',
  sell: 'text-orange-400',
  short: 'text-red-400',
  cover: 'text-blue-400',
};

const ACTION_LABELS = {
  buy: 'BUY',
  sell: 'SELL',
  short: 'SHORT',
  cover: 'COVER',
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

export default function RivalsPage() {
  const router = useRouter();
  const { id: communityId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRivals = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: result, error: rpcError } = await supabase.rpc('get_rivals_data', {
        p_community_id: communityId,
      });

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      setData(result);
      setLoading(false);
    };

    fetchRivals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Loading rivals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-4xl">❌</p>
        <p className="text-sm text-red-400">{error}</p>
        <Link href={'/community/' + communityId} className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-neutral-300 hover:text-white transition-colors">
          Back to Community
        </Link>
      </div>
    );
  }

  // TODO: Re-enable lock check to hide rivals when markets are open
  // if (!data?.available) { return <LockedView />; }

  // Always show rivals data regardless of market lock status
  const members = data?.members || [];

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
          <div>
            <h1 className="text-sm font-semibold">Rivals</h1>
            <p className="text-xs text-orange-400">🔴 Live during matches</p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="px-4 pt-4 pb-20 space-y-4">
        {members.map((m) => (
          <div
            key={m.user_id}
            className={"rounded-xl border overflow-hidden " + (m.is_self ? 'border-emerald-800 bg-emerald-950/20' : 'border-neutral-800 bg-neutral-900')}
          >
            {/* Member header */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">
                    {m.display_name || 'Anonymous'}
                  </p>
                  {m.is_self && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 font-medium">(You)</span>
                  )}
                </div>
                <p className={"text-lg font-bold " + (Number(m.net_worth) >= 20000 ? 'text-emerald-400' : 'text-red-400')}>
                  {formatRupees(m.net_worth)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span>Cash {formatRupees(m.cash_balance)}</span>
                <span>Portfolio {formatRupees(m.portfolio_value)}</span>
              </div>
            </div>

            {/* Holdings */}
            {m.holdings && m.holdings.length > 0 && (
              <div className="border-t border-neutral-800 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-neutral-600 mb-2">Top Holdings</p>
                <div className="space-y-1.5">
                  {m.holdings.slice(0, 5).map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={"font-bold px-1.5 py-0.5 rounded " + (h.position_type === 'long' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400')}>
                          {h.position_type === 'long' ? 'L' : 'S'}
                        </span>
                        <span className="text-neutral-300 truncate">{h.player_name}</span>
                        <span className="text-neutral-600">{h.team}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-neutral-400">
                        <span>{h.quantity}×</span>
                        <span>@ ₹{Number(h.avg_buy_price).toFixed(0)}</span>
                        <span className="text-neutral-600">→ ₹{Number(h.current_price).toFixed(0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent trades */}
            {m.recent_trades && m.recent_trades.length > 0 && (
              <div className="border-t border-neutral-800 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-neutral-600 mb-2">Recent Trades</p>
                <div className="space-y-1">
                  {m.recent_trades.slice(0, 10).map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={ACTION_COLORS[t.action] + ' font-bold uppercase'}>
                          {ACTION_LABELS[t.action] || t.action}
                        </span>
                        <span className="text-neutral-300">{t.quantity}× {t.player_name}</span>
                        <span className="text-neutral-500">@ ₹{Number(t.price).toFixed(0)}</span>
                      </div>
                      <span className="text-neutral-600 shrink-0">{timeAgo(t.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-4xl mb-3">👀</p>
            <p className="text-neutral-500 text-sm">No rivals data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
