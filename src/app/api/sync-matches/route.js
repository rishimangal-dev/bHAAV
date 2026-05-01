import { NextResponse } from 'next/server';
import { syncMatches } from '@/lib/sync-matches';

export async function GET() {
  try {
    const result = await syncMatches();

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      synced: result.synced,
      scheduled: result.counts.scheduled,
      live: result.counts.live,
      completed: result.counts.completed,
      no_result: result.counts.no_result,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}