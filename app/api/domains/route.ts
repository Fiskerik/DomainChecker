import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DomainRecord = {
  id: number;
  domain_name: string;
  [key: string]: any;
};

async function getLiveAvailability(domainName: string): Promise<'available' | 'registered' | 'unknown'> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domainName}&type=A`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.log(`[availability-check] ${domainName}: dns lookup failed with status ${response.status}`);
      return 'unknown';
    }

    const data = await response.json();

    if (Array.isArray(data?.Answer) && data.Answer.length > 0) {
      console.log(`[availability-check] ${domainName}: registered (DNS records found)`);
      return 'registered';
    }

    console.log(`[availability-check] ${domainName}: available (no DNS A records)`);
    return 'available';
  } catch (error) {
    console.log(`[availability-check] ${domainName}: lookup error`, error);
    return 'unknown';
  }
}

async function filterOutRegisteredDomains(domains: DomainRecord[]): Promise<DomainRecord[]> {
  const checkedDomains = await Promise.all(
    domains.map(async (domain) => {
      const availability = await getLiveAvailability(domain.domain_name);

      if (availability === 'registered') {
        return null;
      }

      return domain;
    })
  );

  return checkedDomains.filter((domain): domain is DomainRecord => domain !== null);
}

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
 * - max_score: Maximum popularity score (0-100)
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
    const maxScore = parseInt(searchParams.get('max_score') || '100');
    const daysMin = parseInt(searchParams.get('days_min') || '0');
    const daysMax = parseInt(searchParams.get('days_max') || '100');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'days_until_drop';
    const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
    const search = searchParams.get('search');
    const availableOnly = searchParams.get('available_only') !== 'false';
    
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

    if (maxScore < 100) {
      query = query.lte('popularity_score', maxScore);
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
    
    let domains = (data || []) as DomainRecord[];
    let filteredCount = count || 0;

    if (availableOnly && search && domains.length > 0) {
      console.log(`[domains-api] Running live availability filter for search="${search}" on ${domains.length} domains`);
      domains = await filterOutRegisteredDomains(domains);
      filteredCount = domains.length;
      console.log(`[domains-api] Availability filter removed ${((data || []).length - domains.length)} registered domains`);
    }

    return NextResponse.json({
      domains,
      count: filteredCount,
      limit,
      offset,
      hasMore: offset + limit < filteredCount,
    });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
