import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mark as dynamic to avoid static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Optional: use edge runtime for faster responses

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_type, domain_slug, domain_name, registrar } = body;

    if (!event_type) {
      return NextResponse.json(
        { error: 'event_type is required' },
        { status: 400 }
      );
    }

    // Get search params instead of request.url
    const searchParams = request.nextUrl.searchParams;
    const referrer = request.headers.get('referer') || 'direct';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    switch (event_type) {
      case 'domain_view':
        if (!domain_slug) {
          return NextResponse.json(
            { error: 'domain_slug required for domain_view' },
            { status: 400 }
          );
        }

        // Increment view count
        await supabase
          .from('domains')
          .update({ 
            view_count: supabase.rpc('increment', { row_id: domain_slug })
          })
          .eq('slug', domain_slug);

        // Log view event
        await supabase
          .from('domain_views')
          .insert({
            domain_slug,
            viewed_at: new Date().toISOString(),
            referrer,
            user_agent: userAgent,
          });

        break;

      case 'affiliate_click':
        if (!domain_name || !registrar) {
          return NextResponse.json(
            { error: 'domain_name and registrar required for affiliate_click' },
            { status: 400 }
          );
        }

        // Increment click count
        await supabase
          .from('domains')
          .update({
            click_count_total: supabase.rpc('increment', { row_id: domain_slug || domain_name }),
          })
          .eq('domain_name', domain_name);

        // Log click event
        await supabase
          .from('affiliate_clicks')
          .insert({
            domain_name,
            registrar: registrar.toLowerCase(),
            clicked_at: new Date().toISOString(),
            referrer,
            user_agent: userAgent,
          });

        break;

      default:
        return NextResponse.json(
          { error: 'Invalid event_type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return analytics summary instead of using request.url
  try {
    const { data: topDomains } = await supabase
      .from('domains')
      .select('domain_name, view_count, click_count_total')
      .order('view_count', { ascending: false })
      .limit(10);

    const { data: recentClicks } = await supabase
      .from('affiliate_clicks')
      .select('domain_name, registrar, clicked_at')
      .order('clicked_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      top_domains: topDomains,
      recent_clicks: recentClicks,
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}