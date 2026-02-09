import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stats
 * 
 * Get database statistics
 */
export async function GET() {
  try {
    // Count domains by status
    const { data: allDomains } = await supabase
      .from('domains')
      .select('status');
    
    const byStatus = allDomains?.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    // Count pending delete by TLD
    const { data: pendingDomains } = await supabase
      .from('domains')
      .select('tld')
      .eq('status', 'pending_delete');
    
    const byTLD = pendingDomains?.reduce((acc, d) => {
      acc[d.tld] = (acc[d.tld] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    // Count by category
    const { data: categorizedDomains } = await supabase
      .from('domains')
      .select('category')
      .eq('status', 'pending_delete');
    
    const byCategory = categorizedDomains?.reduce((acc, d) => {
      acc[d.category] = (acc[d.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    // Get total pending delete count
    const { count: pendingCount } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete');
    
    // Get hot domains count (high popularity)
    const { count: hotCount } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete')
      .gte('popularity_score', 70);
    
    // Get dropping this week count
    const { count: weekCount } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete')
      .lte('days_until_drop', 7);
    
    return NextResponse.json({
      total_pending: pendingCount || 0,
      hot_domains: hotCount || 0,
      dropping_this_week: weekCount || 0,
      by_status: byStatus,
      by_tld: byTLD,
      by_category: byCategory,
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
