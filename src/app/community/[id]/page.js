'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TradeModal from '@/components/TradeModal';

const ACTION_VERBS = {
  buy: 'bought',
  sell: 'sold',
  short: 'shorted',
  cover: 'covered',
};

const ACTION_BORDER = {
  buy: 'border-emerald-700',
  sell: 'border-orange-700',
  short: 'border-red-700',
  cover: 'border-blue-700',
};

const TEAM_COLORS = {
  RCB: '#ec1c24',
  MI: '#004ba0',
  GT: '#1c1c2b',
  CSK: '#f9cd05',
  RR: '#ea1a85',
  LSG: '#a72056',
  DC: '#004c93',
  SRH: '#ff822a',
  KKR: '#3a225d',
  PBKS: '#ed1b24',
};

const ROLE_ICONS = {
  Batter: '🏏',
  Bowler: '🎯',
  'All-rounder': '⚡',
  'WK-Batter': '🧤',
};

function calculatePositionPnl(holding, market) {
  if (!market || !holding.quantity) return { pnl: 0, pnlPct: 0, error: null };
  const basePrice = market.base_price;
  const initialSupply = market.initial_supply;
  const r = market.supply_remaining;
  const N = holding.quantity;
  const avgBuyPrice = holding.avg_buy_price;

  if (holding.position_type === 'long') {
    let rAfter = r + N;
    if (rAfter > initialSupply) rAfter = initialSupply;
    const sellValue = basePrice * initialSupply * Math.log(rAfter / r);
    const pnl = sellValue - (avgBuyPrice * N);
    return { pnl, pnlPct: (pnl / (avgBuyPrice * N)) * 100, error: null };
  } else {
    const rAfter = r - N;
    if (rAfter < 1) return { pnl: 0, pnlPct: 0, error: 'Cannot exit' };
    const coverCost = basePrice * initialSupply * Math.log(r / rAfter);
    const margin = avgBuyPrice * N;
    const pnl = margin - coverCost;
    return { pnl, pnlPct: (pnl / (avgBuyPrice * N)) * 100, error: null };
  }
}

export default function CommunityMarketPage() {
  const router = useRouter();
  const { id: communityId } = useParams();

  const [community, setCommunity] = useState(null);
  const [member, setMember] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('market');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('price');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [lockedTeams, setLockedTeams] = useState(new Set());
  const [lastPerfMap, setLastPerfMap] = useState({});
  const [toasts, setToasts] = useState([]);
  const [userId, setUserId] = useState(null);
  const toastIdRef = useRef(0);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);

    const { data: communityData } = await supabase
      .from('communities')
      .select('*')
      .eq('id', communityId)
      .single();

    const { data: memberData } = await supabase
      .from('community_members')
      .select('*')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .single();

    if (!memberData) {
      router.push('/communities');
      return;
    }

    const { data: marketsData } = await supabase
      .from('player_markets')
      .select('id, base_price, current_price, supply_remaining, shorted_shares, initial_supply, players(id, name, team, role, avg_points, matches_remaining)')
      .eq('community_id', communityId)
      .order('current_price', { ascending: false });

    const { data: holdingsData } = await supabase
      .from('holdings')
      .select('*, players(name, team, role)')
      .eq('community_id', communityId)
      .eq('user_id', user.id);

    // Fetch live matches to determine locked teams
    const { data: liveMatches } = await supabase
      .from('matches')
      .select('team_a, team_b')
      .lte('match_datetime_gmt', new Date().toISOString())
      .is('settled_at', null)
      .neq('status', 'no_result');

    const locked = new Set();
    liveMatches?.forEach((m) => {
      locked.add(m.team_a);
      locked.add(m.team_b);
    });

    setCommunity(communityData);
    setMember(memberData);
    console.log('member loaded:', memberData);
    setMarkets(marketsData || []);
    setHoldings(holdingsData || []);
    setLockedTeams(locked);

    // Fetch last match performances for all players
    const playerIds = (marketsData || []).map((m) => m.players.id);
    if (playerIds.length > 0) {
      const { data: perfData } = await supabase
        .from('match_performances')
        .select('player_id, fantasy_points, played, matches!inner(match_date, team_a, team_b)')
        .in('player_id', playerIds)
        .order('matches(match_date)', { ascending: false });

      const perfMap = {};
      (perfData || []).forEach((p) => {
        if (!perfMap[p.player_id]) {
          // Find the opponent team for this player
          const playerTeam = (marketsData || []).find((m) => m.players.id === p.player_id)?.players?.team;
          const opponent = playerTeam === p.matches.team_a ? p.matches.team_b : p.matches.team_a;
          perfMap[p.player_id] = {
            points: p.fantasy_points,
            played: p.played,
            opponent,
          };
        }
      });
      setLastPerfMap(perfMap);
    }

    setLoading(false);
  }, [communityId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh lock status every 60 seconds
  useEffect(() => {
    const refreshLocks = async () => {
      const { data: liveMatches } = await supabase
        .from('matches')
        .select('team_a, team_b')
        .lte('match_datetime_gmt', new Date().toISOString())
        .is('settled_at', null)
        .neq('status', 'no_result');

      const locked = new Set();
      liveMatches?.forEach((m) => {
        locked.add(m.team_a);
        locked.add(m.team_b);
      });
      setLockedTeams(locked);
    };

    const interval = setInterval(refreshLocks, 60000);
    return () => clearInterval(interval);
  }, []);

  // Realtime trade notifications
  useEffect(() => {
    if (!communityId || !userId) return;

    const channel = supabase
      .channel('trades-' + communityId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'community_id=eq.' + communityId,
        },
        async (payload) => {
          const tx = payload.new;

          // Skip own transactions
          if (tx.user_id === userId) return;

          // Fetch display name
          const { data: profile } = await supabase
            .from('community_members')
            .select('display_name')
            .eq('community_id', communityId)
            .eq('user_id', tx.user_id)
            .maybeSingle();

          // Fetch player name
          const { data: player } = await supabase
            .from('players')
            .select('name')
            .eq('id', tx.player_id)
            .maybeSingle();

          const displayName = profile?.display_name || 'Someone';
          const playerName = player?.name || 'Unknown';
          const verb = ACTION_VERBS[tx.action] || tx.action;
          const price = Number(tx.price_per_share || 0).toFixed(0);

          const id = ++toastIdRef.current;
          const toast = {
            id,
            text: `${displayName} ${verb} ${tx.quantity} ${playerName} @ ₹${price}`,
            action: tx.action,
          };

          setToasts((prev) => [toast, ...prev].slice(0, 3));

          // Auto-remove after 5 seconds
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId, userId]);

  const handleTradeComplete = () => {
    setSelectedPlayer(null);
    loadData();
  };

  // Derived values
  const filteredMarkets = markets
    .filter((m) => {
      if (filter !== 'All' && m.players.role !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!m.players.name.toLowerCase().includes(q) && !m.players.team.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price') return b.current_price - a.current_price;
      if (sortBy === 'team') return a.players.team.localeCompare(b.players.team);
      if (sortBy === 'name') return a.players.name.localeCompare(b.players.name);
      return 0;
    });

  const portfolioValue = holdings.reduce((sum, h) => {
    const marketRow = markets.find((m) => String(m.players.id) === String(h.player_id));
    const currentPrice = marketRow ? marketRow.current_price : h.avg_buy_price;
    if (h.position_type === 'long') {
      return sum + h.quantity * currentPrice;
    }
    // short: locked collateral + unrealized P&L
    return sum + h.avg_buy_price * h.quantity + (h.avg_buy_price - currentPrice) * h.quantity;
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Loading market...</p>
      </div>
    );
  }

  const roles = ['All', 'Batter', 'Bowler', 'All-rounder', 'WK-Batter'];

  return (
    <div className="min-h-screen bg-black text-white max-w-md mx-auto relative">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-neutral-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.push('/communities')} className="text-neutral-400 hover:text-white transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <h1 className="text-sm font-semibold">{community?.name}</h1>
            <button onClick={() => setShowInvite(!showInvite)} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer">
              {showInvite ? 'Hide code' : 'Invite code'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/community/' + communityId + '/rivals')} className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-lg" title="Rivals">👀</button>
            <button onClick={() => router.push('/community/' + communityId + '/dividends')} className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-lg" title="My Dividends">💰</button>
            <button onClick={() => router.push('/community/' + communityId + '/leaderboard')} className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-lg" title="Leaderboard">🏆</button>
          </div>
        </div>

        {/* Invite code expanded */}
        {showInvite && (
          <div className="px-4 pb-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Invite Code</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-emerald-400 mb-2">{community?.invite_code}</p>
              <p className="text-xs text-neutral-600 mb-3">Share link: https://b-haav.vercel.app/join/{community?.invite_code}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => { navigator.clipboard.writeText(community?.invite_code || ''); setCopiedField('code'); setTimeout(() => setCopiedField(''), 1500); }}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedField === 'code' ? '✓ Copied!' : 'Copy Code'}
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText('https://b-haav.vercel.app/join/' + (community?.invite_code || '')); setCopiedField('link'); setTimeout(() => setCopiedField(''), 1500); }}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedField === 'link' ? '✓ Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          <div className="bg-neutral-900 rounded-xl p-3 text-center">
            <p className="text-xs text-neutral-500 mb-1">Cash</p>
            <p className="text-sm font-bold">₹{Number(member?.cash_balance ?? 0).toFixed(0)}</p>
          </div>
          <div className="bg-neutral-900 rounded-xl p-3 text-center">
            <p className="text-xs text-neutral-500 mb-1">Portfolio</p>
            <p className="text-sm font-bold text-emerald-400">₹{portfolioValue.toFixed(1)}</p>
          </div>
          <div className="bg-neutral-900 rounded-xl p-3 text-center">
            <p className="text-xs text-neutral-500 mb-1">Net Worth</p>
            <p className="text-sm font-bold">₹{(Number(member?.cash_balance ?? 0) + portfolioValue).toFixed(0)}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-4 gap-1">
          <button
            onClick={() => setTab('market')}
            className={"flex-1 py-2.5 text-sm font-medium text-center transition-all border-b-2 cursor-pointer " + (tab === 'market' ? 'text-white border-emerald-500' : 'text-neutral-500 border-transparent hover:text-neutral-300')}
          >
            Market
          </button>
          <button
            onClick={() => setTab('portfolio')}
            className={"flex-1 py-2.5 text-sm font-medium text-center transition-all border-b-2 cursor-pointer " + (tab === 'portfolio' ? 'text-white border-emerald-500' : 'text-neutral-500 border-transparent hover:text-neutral-300')}
          >
            Portfolio{holdings.length > 0 ? ' (' + holdings.length + ')' : ''}
          </button>
        </div>
      </div>

      {/* How to Play */}
      <div className="px-4 pt-3">
        <button onClick={() => setShowRules(!showRules)} className="w-full flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer">
          <span>📖 How to Play</span>
          <span className="text-xs">{showRules ? '▲' : '▼'}</span>
        </button>
        {showRules && (
          <div className="mt-2 bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3 text-sm text-neutral-400 leading-relaxed">
            <div>
              <p className="text-white font-semibold mb-1">🏏 The Game</p>
              <p>Every IPL player is a tradeable stock. Buy low, sell high, or short players you think will underperform. Your goal: grow your ₹20,000 starting cash to the highest net worth by season end.</p>
            </div>
            <div>
              <p className="text-white font-semibold mb-1">💰 Pricing</p>
              <p>A player&#39;s base price = their average fantasy points × matches remaining. When people buy heavily, prices rise. When they sell, prices fall.</p>
            </div>
            <div>
              <p className="text-white font-semibold mb-1">📊 Dividends</p>
              <p>After every match, players who scored fantasy points pay dividends at ₹1 per point to those who hold them long. Short-holders pay that dividend instead.</p>
            </div>
            <div>
              <p className="text-white font-semibold mb-1">⚔️ Strategy</p>
              <p><strong className="text-neutral-300">Long</strong> a player = you bet they&#39;ll outperform expectations.</p>
              <p><strong className="text-neutral-300">Short</strong> a player = you bet they&#39;ll underperform.</p>
              <p>Cash can go negative — shorting big players who score well will cost you.</p>
            </div>
            <div>
              <p className="text-white font-semibold mb-1">⭐ Scoring</p>
              <p>Standard Dream11 T20 points: runs, boundaries, wickets, economy bonus, catches, etc. Playing XI gets +4 just for showing up.</p>
            </div>
            <div>
              <p className="text-white font-semibold mb-1">🏆 At Season End</p>
              <p>A small floor of ₹100 per share keeps positions valuable during playoffs. Whoever has the highest net worth wins.</p>
            </div>
          </div>
        )}
      </div>

      {/* Market Tab */}
      {tab === 'market' && (
        <div className="pb-20">
          {/* Search */}
          <div className="px-4 pt-4 pb-2">
            <input
              type="text"
              placeholder="Search player or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-600 transition-colors"
            />
          </div>

          {/* Role filter pills */}
          <div className="px-4 pb-2 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setFilter(role)}
                  className={"px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer " + (filter === role ? 'bg-neutral-900 text-emerald-400 border border-emerald-600' : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:text-neutral-300')}
                >
                  {role !== 'All' ? (ROLE_ICONS[role] || '') + ' ' : ''}{role}
                </button>
              ))}
            </div>
          </div>

          {/* Sort buttons */}
          <div className="px-4 pb-3 flex gap-2">
            {['price', 'name', 'team'].map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={"px-3 py-1 rounded-lg text-xs transition-all cursor-pointer " + (sortBy === s ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:text-neutral-400')}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Player list */}
          <div>
            {filteredMarkets.map((m) => {
              const pctChange = m.base_price > 0 
                ? ((m.current_price - m.base_price) / m.base_price) * 100 
                : 0;
              const isUp = pctChange >= 0;
              const teamColor = TEAM_COLORS[m.players.team] || '#666';
              const isLocked = lockedTeams.has(m.players.team);

              return (
                <button
                  key={m.id}
                  onClick={() => !isLocked && setSelectedPlayer(m)}
                  className={"w-full flex items-center gap-3 px-4 py-3 border-b border-neutral-900 transition-colors text-left" + (isLocked ? ' opacity-60 cursor-default' : ' hover:bg-neutral-950 cursor-pointer')}
                >
                  {/* Team-colored icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: teamColor + '22' }}
                  >
                    {isLocked ? '🔒' : (ROLE_ICONS[m.players.role] || '🏏')}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <p className={"text-sm font-medium truncate " + (isLocked ? 'text-neutral-400' : 'text-white')}>{m.players.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: teamColor + '22', color: teamColor }}
                      >
                        {m.players.team}
                      </span>
                      <span className="text-xs text-neutral-600">{m.players.role}</span>
                      {isLocked && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-400">Match live</span>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <p className={"text-sm font-bold " + (isLocked ? 'text-neutral-400' : 'text-white')}>₹{m.current_price.toFixed(1)}</p>
                    {isLocked ? (
                      <p className="text-xs font-medium text-orange-400">🔒 Locked</p>
                    ) : (
                      <p className={"text-xs font-medium " + (isUp ? 'text-emerald-400' : 'text-red-400')}>
                        {isUp ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}% vs Base
                      </p>
                    )}
                    <p className={"text-xs mt-0.5 " + (m.supply_remaining < 2 ? 'text-orange-400' : 'text-neutral-500')}>
                      {m.supply_remaining} / {m.initial_supply} in pool
                    </p>
                    {m.players.avg_points != null && m.players.matches_remaining != null && (
                      <p className="text-xs text-neutral-500 mt-0.5">Avg {Math.round(m.players.avg_points)} pts • {m.players.matches_remaining} left</p>
                    )}
                    {(() => {
                      const perf = lastPerfMap[m.players.id];
                      if (!perf) return <p className="text-xs text-neutral-600 mt-0.5 italic">Last: DNP</p>;
                      if (perf.played === false) return <p className="text-xs text-neutral-600 mt-0.5">Last: 0 pts (benched)</p>;
                      const aboveAvg = m.players.avg_points != null && perf.points > m.players.avg_points;
                      return (
                        <p className={"text-xs mt-0.5 " + (aboveAvg ? 'text-emerald-500' : 'text-neutral-500')}>
                          Last: {perf.points} pts vs {perf.opponent}
                        </p>
                      );
                    })()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Portfolio Tab */}
      {tab === 'portfolio' && (
        <div className="pb-20">
          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-neutral-500 text-sm">No holdings yet</p>
              <p className="text-neutral-600 text-xs mt-1">Start trading to build your portfolio</p>
            </div>
          ) : (
            <div className="px-4 pt-4 space-y-3">
              {holdings.map((h, i) => {
                const marketRow = markets.find((m) => String(m.players.id) === String(h.player_id));
                const currentPrice = marketRow ? marketRow.current_price : h.avg_buy_price;
                
                const { pnl, pnlPct, error: pnlError } = calculatePositionPnl(h, marketRow);
                const isProfit = pnl >= 0;

                return (
                  <button type="button" key={h.player_id + '-' + h.position_type + '-' + i} onClick={() => setSelectedPlayer(marketRow)} className="w-full text-left bg-neutral-900 rounded-xl p-4 border border-neutral-800 hover:bg-neutral-800 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{h.players?.name || 'Unknown'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={"text-xs font-bold px-2 py-0.5 rounded " + (h.position_type === 'long' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400')}>
                            {h.position_type.toUpperCase()}
                          </span>
                          <span className="text-xs text-neutral-500">{h.players?.team}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {pnlError ? (
                          <p className="text-sm font-bold text-orange-400">{pnlError}</p>
                        ) : (
                          <>
                            <p className={"text-sm font-bold " + (isProfit ? 'text-emerald-400' : 'text-red-400')}>
                              {isProfit ? '+' : ''}₹{pnl.toFixed(1)}
                            </p>
                            <p className={"text-xs " + (isProfit ? 'text-emerald-500' : 'text-red-500')}>
                              {isProfit ? '+' : ''}{pnlPct.toFixed(1)}%
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{h.quantity} × ₹{h.avg_buy_price.toFixed(1)} (now ₹{currentPrice.toFixed(1)})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trade Modal */}
      {selectedPlayer && (
        <TradeModal
          market={selectedPlayer}
          communityId={communityId}
          member={member}
          holdings={holdings}
          isLocked={lockedTeams.has(selectedPlayer.players.team)}
          onClose={() => setSelectedPlayer(null)}
          onComplete={handleTradeComplete}
        />
      )}

      {/* Trade notification toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={"px-4 py-3 rounded-xl bg-neutral-900/95 backdrop-blur-sm border-l-4 shadow-lg animate-[slideIn_0.3s_ease-out] " + (ACTION_BORDER[toast.action] || 'border-neutral-700')}
            style={{ animation: 'slideIn 0.3s ease-out' }}
          >
            <p className="text-xs text-neutral-300">{toast.text}</p>
          </div>
        ))}
      </div>

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
