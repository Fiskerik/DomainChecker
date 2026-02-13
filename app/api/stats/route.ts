import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic'; // Disable caching
export const revalidate = 0;

export async function GET() {
  try {
    // Get total pending delete domains
    const { count: totalPending } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete')
      .gte('days_until_drop', 0)
      .lte('days_until_drop', 10);

    // Get high interest domains (70+ score)
    const { count: hotDomains } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete')
      .gte('popularity_score', 70)
      .gte('days_until_drop', 0)
      .lte('days_until_drop', 10);

    // Get domains dropping this week (0-7 days)
    const { count: droppingThisWeek } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete')
      .gte('days_until_drop', 0)
      .lte('days_until_drop', 7);

    // Get TLD distribution
    const { data: tldData } = await supabase
      .from('domains')
      .select('tld')
      .eq('status', 'pending_delete')
      .gte('days_until_drop', 0)
      .lte('days_until_drop', 10);

    // Count domains by TLD
    const byTld: Record<string, number> = {};
    tldData?.forEach(({ tld }) => {
      byTld[tld] = (byTld[tld] || 0) + 1;
    });

    const stats = {
      total_pending: totalPending || 0,
      hot_domains: hotDomains || 0,
      dropping_this_week: droppingThisWeek || 0,
      by_tld: byTld,
      last_updated: new Date().toISOString(),
    };

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    
    return NextResponse.json(
      {
        total_pending: 0,
        hot_domains: 0,
        dropping_this_week: 0,
        by_tld: {},
        error: 'Failed to fetch stats',
      },
      { status: 500 }
    );
  }
}