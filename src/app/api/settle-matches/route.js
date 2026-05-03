import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { syncMatches } from '@/lib/sync-matches';

const API_KEY = process.env.CRICKETDATA_API_KEY || '';
const BASE_URL = 'https://api.cricapi.com/v1';
const BATCH_LIMIT = 5;
const MAX_ELAPSED_MS = 50_000; // 50 seconds

async function fetchScorecard(externalId) {
  const url = BASE_URL + '/match_scorecard?apikey=' + API_KEY + '&id=' + externalId;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'success' || !json.data) return null;
  return json.data;
}

function parsePlayerStats(scorecard) {
  const players = {};
  const ensure = (id, name) => {
    if (!players[id]) players[id] = { id, name, runs: 0, balls: 0, fours: 0, sixes: 0, sr: 0, dismissal: null, overs: 0, maidens: 0, wickets: 0, runs_conceded: 0, economy: 0, lbw_bowled: 0, catches: 0, stumpings: 0, runouts: 0, played: true };
    return players[id];
  };

  for (const inn of (scorecard || [])) {
    for (const b of (inn.batting || [])) {
      const p = ensure(b.batsman.id, b.batsman.name);
      p.runs = (b.r || 0); p.balls = (b.b || 0); p.fours = (b['4s'] || 0); p.sixes = (b['6s'] || 0);
      p.sr = parseFloat(b.sr) || 0; p.dismissal = b['dismissal-text'] || b.dismissal || null;
    }
    for (const bw of (inn.bowling || [])) {
      const p = ensure(bw.bowler.id, bw.bowler.name);
      p.overs = parseFloat(bw.o) || 0; p.maidens = (bw.m || 0); p.wickets = (bw.w || 0);
      p.runs_conceded = (bw.r || 0); p.economy = parseFloat(bw.eco) || 0;
    }
    for (const c of (inn.catching || [])) {
      const p = ensure(c.catcher.id, c.catcher.name);
      p.catches += (c.catch || 0); p.stumpings += (c.stumped || 0); p.runouts += (c.runout || 0);
    }
  }

  // Only consider players with bowling stats as potential bowlers
  const bowlerIds = new Set();
  for (const inn of (scorecard || [])) {
    for (const bw of (inn.bowling || [])) {
      bowlerIds.add(bw.bowler.id);
    }
  }

  const allBatters = [];
  for (const inn of (scorecard || [])) {
    for (const b of (inn.batting || [])) allBatters.push(b);
  }
  for (const b of allBatters) {
    const dt = (b['dismissal-text'] || '').toLowerCase();
    if (dt.startsWith('lbw ') || dt.startsWith('b ') || dt.includes(' lbw ') || dt.includes(' bowled ')) {
      for (const id of bowlerIds) {
        const pName = players[id].name.toLowerCase();
        if (dt.includes(pName)) {
          players[id].lbw_bowled++;
          break;
        }
      }
    }
  }

  return Object.values(players);
}

function calculateFantasyPoints(p) {
  let pts = 4; // playing XI
  pts += p.runs; // +1 per run
  pts += p.fours; // +1 bonus per four
  pts += p.sixes * 2; // +2 bonus per six
  if (p.runs >= 100) pts += 16; else if (p.runs >= 50) pts += 8; else if (p.runs >= 30) pts += 4;
  if (p.runs === 0 && p.balls > 0 && p.dismissal) pts -= 2; // duck
  if (p.balls >= 10) {
    if (p.sr > 170) pts += 6; else if (p.sr > 150) pts += 4; else if (p.sr >= 130) pts += 2;
    else if (p.sr < 50) pts -= 6; else if (p.sr < 60) pts -= 4; else if (p.sr < 70) pts -= 2;
  }
  pts += p.wickets * 25;
  pts += p.lbw_bowled * 8;
  pts += p.maidens * 12;
  if (p.wickets >= 5) pts += 16; else if (p.wickets >= 4) pts += 8; else if (p.wickets >= 3) pts += 4;
  if (p.overs >= 2) {
    if (p.economy < 5) pts += 6; else if (p.economy < 6) pts += 4; else if (p.economy <= 7) pts += 2;
    else if (p.economy > 12) pts -= 6; else if (p.economy > 11) pts -= 4; else if (p.economy >= 10) pts -= 2;
  }
  pts += p.catches * 8;
  if (p.catches >= 3) pts += 4;
  pts += p.stumpings * 12;
  pts += p.runouts * 6;
  return pts;
}

async function findPlayerInDb(supabase, extId, name) {
  // Try external_id first
  let { data } = await supabase.from('players').select('id').eq('external_id', extId).maybeSingle();
  if (data) return data.id;

  // Try exact name match (case-insensitive)
  const { data: exactMatches } = await supabase.from('players').select('id').ilike('name', name);
  if (exactMatches && exactMatches.length === 1) return exactMatches[0].id;

  // Try partial match on last name
  const lastName = name.split(' ').pop();
  if (lastName && lastName.length >= 3) {
    const { data: partialMatches } = await supabase.from('players').select('id').ilike('name', '%' + lastName + '%');
    if (partialMatches && partialMatches.length === 1) return partialMatches[0].id;
  }

  return null;
}

async function createUnknownPlayer(supabase, extId, name, teamGuess) {
  const { data, error } = await supabase
    .from('players')
    .insert({
      name,
      external_id: extId,
      team: teamGuess,
      role: 'Batter', // default; can be updated manually
      avg_points: 40,
      matches_remaining: 0, // will recalculate later
      is_rookie: true,
      is_active: true
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to create unknown player:', name, error);
    return null;
  }

  const newPlayerId = data.id;

  // After creating player, create markets in all communities
  const { data: communities } = await supabase.from('communities').select('id');
  if (communities) {
    for (const c of communities) {
      const { count } = await supabase
        .from('community_members')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', c.id);
      
      const poolSize = Math.max(10, (count || 1) * 10);
      
      await supabase.from('player_markets').insert({
        community_id: c.id,
        player_id: newPlayerId,
        base_price: 100, // floor
        current_price: 100,
        initial_supply: poolSize,
        total_supply: poolSize,
        supply_remaining: poolSize
      });
    }
  }

  return newPlayerId;
}

async function settleMatchBatch(supabase, matches) {
  const results = [];

  for (const match of matches) {
    try {
      // Check if performances already exist for this match
      const { count: existingPerfs } = await supabase
        .from('match_performances')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', match.id);

      if (existingPerfs === 0) {
        // Need to fetch scorecard and write performances
        const sc = await fetchScorecard(match.external_id);
        if (!sc || !sc.scorecard) {
          console.error('Scorecard unavailable for match', match.match_number, match.external_id);
          results.push({ match: match.team_a + ' vs ' + match.team_b, success: false, error: 'Scorecard unavailable' });
          continue;
        }

        const stats = parsePlayerStats(sc.scorecard);
        const perfRows = [];

        for (const p of stats) {
          let playerId = await findPlayerInDb(supabase, p.id, p.name);
          if (!playerId) {
            console.log('Unknown player:', p.name, p.id, '— creating');
            playerId = await createUnknownPlayer(supabase, p.id, p.name, match.team_a);
            if (!playerId) continue;
          }
          perfRows.push({
            match_id: match.id, player_id: playerId, external_player_id: p.id,
            runs: p.runs, balls: p.balls, fours: p.fours, sixes: p.sixes, strike_rate: p.sr,
            dismissal: p.dismissal, overs: p.overs, maidens: p.maidens, wickets: p.wickets,
            runs_conceded: p.runs_conceded, economy: p.economy, lbw_bowled: p.lbw_bowled,
            catches: p.catches, stumpings: p.stumpings, runouts: p.runouts,
            played: true, fantasy_points: calculateFantasyPoints(p),
          });
        }

        if (perfRows.length > 0) {
          const { error: upsertErr } = await supabase.from('match_performances').upsert(perfRows, { onConflict: 'match_id,player_id' });
          if (upsertErr) {
            console.error('Upsert error for match', match.match_number, ':', upsertErr);
            results.push({ match: match.team_a + ' vs ' + match.team_b, success: false, error: 'Upsert: ' + upsertErr.message });
            continue;
          }
        }
      }

      // Try to settle (with one retry)
      let settleData, settleErr;
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await supabase.rpc('settle_match', { p_match_id: match.id });
        settleData = r.data;
        settleErr = r.error;
        if (!settleErr && settleData && settleData.success !== false) break;
        if (attempt === 0) {
          console.warn('settle_match attempt 1 failed for match', match.match_number, '— retrying');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (settleErr) {
        console.error('settle_match RPC error for match', match.match_number, ':', JSON.stringify(settleErr));
        results.push({ match: match.team_a + ' vs ' + match.team_b, success: false, error: 'RPC: ' + (settleErr.message || JSON.stringify(settleErr)) });
        continue;
      }

      if (settleData && settleData.success === false) {
        console.error('settle_match returned failure for match', match.match_number, ':', settleData);
        // Special case: "Already settled" is fine — means a previous attempt already worked
        if (settleData.error === 'Already settled') {
          results.push({ match: match.team_a + ' vs ' + match.team_b, success: true, already_settled: true });
          continue;
        }
        results.push({
          match: match.team_a + ' vs ' + match.team_b,
          success: false,
          error: 'settle_match: ' + (settleData.error || 'unknown'),
        });
        continue;
      }

      results.push({
        match: match.team_a + ' vs ' + match.team_b,
        success: true,
        dividends_paid: settleData?.dividends_paid || 0,
        shorts_charged: settleData?.shorts_charged || 0,
        community_avg: settleData?.community_avg_points || 0,
      });
    } catch (err) {
      console.error('Exception settling match', match.match_number, ':', err);
      results.push({ match: match.team_a + ' vs ' + match.team_b, success: false, error: 'Exception: ' + err.message });
    }
  }

  return results;
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // ─── Step 1: Sync matches from CricketData ───
    const syncResult = await syncMatches(supabase);
    const syncedCount = syncResult.success ? (syncResult.synced || 0) : 0;

    // ─── Step 2: Loop settlement in batches of 5 ───
    const startTime = Date.now();
    const allResults = [];
    let totalSettled = 0;
    let stillPending = 0;

    while (true) {
      // Check time budget
      if (Date.now() - startTime > MAX_ELAPSED_MS) {
        // Count remaining pending matches
        const { count } = await supabase.from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('match_ended', true).is('settled_at', null).eq('status', 'completed');
        stillPending = count || 0;
        break;
      }

      // Fetch next batch
      const { data: matches } = await supabase.from('matches')
        .select('*').eq('match_ended', true).is('settled_at', null).eq('status', 'completed').limit(BATCH_LIMIT);

      if (!matches || matches.length === 0) {
        stillPending = 0;
        break;
      }

      // Settle batch
      const batchResults = await settleMatchBatch(supabase, matches);
      allResults.push(...batchResults);
      totalSettled += batchResults.filter(r => r.success).length;

      // If we got fewer than BATCH_LIMIT, there are no more pending
      if (matches.length < BATCH_LIMIT) {
        stillPending = 0;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      synced_matches: syncedCount,
      total_settled: totalSettled,
      still_pending: stillPending,
      results: allResults,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
