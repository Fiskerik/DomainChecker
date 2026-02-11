import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'week';

    // Calculate date filter
    const now = new Date();
    let startDate = new Date();
    
    switch (range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'all':
      default:
        startDate = new Date(0); // Beginning of time
    }

    // Get total domains
    const { count: total_domains } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete');

    // Get views in range
    const { data: views } = await supabase
      .from('domain_views')
      .select('*')
      .gte('viewed_at', startDate.toISOString());

    // Get clicks in range
    const { data: clicks } = await supabase
      .from('affiliate_clicks')
      .select('*')
      .gte('clicked_at', startDate.toISOString());

    const total_views = views?.length || 0;
    const total_clicks = clicks?.length || 0;
    const ctr = total_views > 0 ? (total_clicks / total_views) * 100 : 0;

    // Clicks by affiliate
    const clicks_by_affiliate: Record<string, number> = {};
    clicks?.forEach(click => {
      const type = click.affiliate_type || 'unknown';
      clicks_by_affiliate[type] = (clicks_by_affiliate[type] || 0) + 1;
    });

    // Top domains
    const { data: topDomains } = await supabase
      .from('domains')
      .select('domain_name, click_count_total, view_count')
      .eq('status', 'pending_delete')
      .order('click_count_total', { ascending: false })
      .limit(10);

    const top_domains = (topDomains || []).map(d => ({
      ...d,
      ctr: d.view_count > 0 ? (d.click_count_total / d.view_count) * 100 : 0,
    }));

    // Estimated revenue
    const estimated_revenue = {
      today: estimateRevenue(clicks_by_affiliate, 'day'),
      week: estimateRevenue(clicks_by_affiliate, 'week'),
      month: estimateRevenue(clicks_by_affiliate, 'month'),
    };

    return NextResponse.json({
      total_domains,
      total_views,
      total_clicks,
      ctr,
      clicks_by_affiliate,
      top_domains,
      estimated_revenue,
    });

  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

function estimateRevenue(clicks: Record<string, number>, period: string): number {
  const multiplier = period === 'day' ? 1 : period === 'week' ? 7 : 30;
  
  const rates = {
    dropcatch: 0.9,    // $9 per conversion at 10%
    namecheap: 0.24,   // $3 per conversion at 8%
    godaddy: 1.8,      // $15 per conversion at 12%
    snapnames: 1.0,    // $10 per conversion at 10%
    dynadot: 0.16,     // $2 per conversion at 8%
  };

  let total = 0;
  Object.entries(clicks).forEach(([affiliate, count]) => {
    const rate = rates[affiliate.toLowerCase() as keyof typeof rates] || 0.5;
    total += count * rate;
  });

  return total * multiplier;
}
