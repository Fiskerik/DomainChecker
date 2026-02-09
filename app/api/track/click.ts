import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/track/click
 * 
 * Track affiliate link clicks
 * 
 * Body:
 * {
 *   domain_id: number,
 *   affiliate_type: 'namecheap' | 'snapnames' | 'dropcatch'
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domain_id, affiliate_type } = body;
    
    if (!domain_id || !affiliate_type) {
      return NextResponse.json(
        { error: 'Missing domain_id or affiliate_type' },
        { status: 400 }
      );
    }
    
    // Get request headers for analytics
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || 
               headersList.get('x-real-ip') || 
               'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';
    
    // Record the click
    const { error } = await supabase
      .from('affiliate_clicks')
      .insert({
        domain_id,
        affiliate_type,
        ip_address: ip.split(',')[0].trim(), // Get first IP if multiple
        user_agent: userAgent,
      });
    
    if (error) {
      console.error('Error tracking click:', error);
      return NextResponse.json(
        { error: 'Failed to track click' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
