import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/track/view
 * 
 * Track domain page views
 * 
 * Body:
 * {
 *   domain_id: number
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domain_id } = body;
    
    if (!domain_id) {
      return NextResponse.json(
        { error: 'Missing domain_id' },
        { status: 400 }
      );
    }
    
    // Get request headers for analytics
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || 
               headersList.get('x-real-ip') || 
               'unknown';
    const referrer = headersList.get('referer') || 'direct';
    
    // Record the view
    const { error } = await supabase
      .from('domain_views')
      .insert({
        domain_id,
        ip_address: ip.split(',')[0].trim(),
        referrer,
      });
    
    if (error) {
      console.error('Error tracking view:', error);
      // Don't return error to user - views are optional
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: true }); // Still return success
  }
}
