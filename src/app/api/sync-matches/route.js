import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const API_KEY = process.env.CRICKETDATA_API_KEY || '';
const SERIES_ID = '87c62aac-bc3c-4738-ab93-19da0690488f';
const BASE_URL = 'https://api.cricapi.com/v1';
const SHORTNAME_MAP = { RCBW: 'RCB' };
const normalizeShortname = (s) => SHORTNAME_MAP[s] || s;

function parseMatchNumber(name) {
  const m = name.match(/(\d+)(?:st|nd|rd|th)\s+Match/i);
  return m ? parseInt(m[1], 10) : null;
}

function deriveStatus(matchStarted, matchEnded, statusText) {
  if (matchEnded && /no result/i.test(statusText)) return 'no_result';
  if (matchEnded) return 'completed';
  if (matchStarted) return 'live';
  return 'scheduled';
}

function extractWinner(statusText, teams) {
  if (!statusText) return null;
  for (const t of teams) {
    if (statusText.includes(t.shortname + ' won') || statusText.includes(t.name + ' won')) {
      return normalizeShortname(t.shortname);
    }
  }
  return null;
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const url = BASE_URL + '/series_info?apikey=' + API_KEY + '&id=' + SERIES_ID;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== 'success' || !json.data?.matchList) {
      return NextResponse.json({ success: false, error: 'API returned no match list' }, { status: 502 });
    }

    const matches = json.data.matchList;
    const counts = { scheduled: 0, live: 0, completed: 0, no_result: 0 };

    const rows = matches.map((m) => {
      const teams = (m.teamInfo || []).map((t) => ({
        ...t,
        shortname: normalizeShortname(t.shortname),
      }));
      const status = deriveStatus(m.matchStarted, m.matchEnded, m.status);
      counts[status]++;
      return {
        external_id: m.id,
        match_number: parseMatchNumber(m.name),
        team_a: teams[0]?.shortname || null,
        team_b: teams[1]?.shortname || null,
        match_date: m.date,
        match_datetime_gmt: m.dateTimeGMT,
        venue: m.venue,
        status,
        match_started: m.matchStarted || false,
        match_ended: m.matchEnded || false,
        winner: extractWinner(m.status, m.teamInfo || []),
      };
    });

    const { error } = await supabase
      .from('matches')
      .upsert(rows, { onConflict: 'external_id' });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      synced: rows.length,
      scheduled: counts.scheduled,
      live: counts.live,
      completed: counts.completed,
      no_result: counts.no_result,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}