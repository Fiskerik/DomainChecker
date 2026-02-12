import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/domains
 * 
 * Fetch domains with filters
 * 
 * Query params:
 * - status: Filter by status (default: 'pending_delete')
 * - tld: Filter by TLD (e.g., 'com', 'io')
 * - category: Filter by category (e.g., 'tech', 'finance')
 * - min_score: Minimum popularity score (0-100)
 * - days_min: Minimum days until drop
 * - days_max: Maximum days until drop
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset
 * - sort: Sort by (popularity, drop_date, created_at)
 * - order: Sort order (asc, desc)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const status = searchParams.get('status') || 'pending_delete';
    const tld = searchParams.get('tld');
    const category = searchParams.get('category');
    const minScore = parseInt(searchParams.get('min_score') || '0');
    const daysMin = parseInt(searchParams.get('days_min') || '0');
    const daysMax = parseInt(searchParams.get('days_max') || '100');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'days_until_drop';
    const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
    const search = searchParams.get('search');
    
    // Build query
    let query = supabase
      .from('domains')
      .select('*', { count: 'exact' })
      .eq('status', status);
    
    // Apply filters
    if (tld) {
      query = query.eq('tld', tld);
    }
    
    if (category) {
      query = query.eq('category', category);
    }
    
    if (minScore > 0) {
      query = query.gte('popularity_score', minScore);
    }
    
    if (daysMin > 0) {
      query = query.gte('days_until_drop', daysMin);
    }
    
    if (daysMax < 100) {
      query = query.lte('days_until_drop', daysMax);
    }
    
    if (search) {
      query = query.ilike('domain_name', `%${search}%`);
    }
    
    // Apply sorting
    const sortColumn = sort === 'drop_date' ? 'drop_date' :
      sort === 'created_at' ? 'created_at' :
      sort === 'domain_name' ? 'domain_name' :
      sort === 'days_until_drop' ? 'days_until_drop' :
      'popularity_score';
    
    query = query.order(sortColumn, { ascending: order === 'asc' });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch domains' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      domains: data,
      count,
      limit,
      offset,
      hasMore: offset + limit < (count || 0),
    });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
