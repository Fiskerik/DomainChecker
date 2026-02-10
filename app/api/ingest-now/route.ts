import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/ingest-now
 * 
 * Manually trigger domain ingestion
 * Add ?secret=YOUR_SECRET to protect this endpoint
 */
export async function GET(request: Request) {
  // Optional: Protect with a secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  // Set this in your Vercel env vars
  if (process.env.INGEST_SECRET && secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting manual ingestion...');
    
    // Generate mock domains for now
    // Replace this with actual WhoisXML API call in production
    const mockDomains = generateMockDomains();
    
    let stored = 0;
    let skipped = 0;
    
    for (const domain of mockDomains) {
      const result = await upsertDomain(domain);
      if (result.stored) stored++;
      else skipped++;
    }
    
    return NextResponse.json({
      success: true,
      message: `Ingested ${stored} domains, skipped ${skipped}`,
      stored,
      skipped,
    });
    
  } catch (error: any) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      { error: 'Ingestion failed', details: error.message },
      { status: 500 }
    );
  }
}

function generateMockDomains() {
  const tlds = ['com', 'io', 'ai', 'app', 'dev'];
  const prefixes = [
    'techstart', 'aitools', 'devops', 'cloudapp', 'dataflow',
    'payfast', 'shopnow', 'gamehub', 'fitness', 'cryptopay'
  ];
  
  return prefixes.map((prefix, i) => {
    const tld = tlds[i % tlds.length];
    const daysAgo = 60 + Math.floor(Math.random() * 15);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - daysAgo);
    
    return {
      domainName: `${prefix}.${tld}`,
      expiryDate: expiryDate.toISOString().split('T')[0],
      registrar: 'Mock Registrar Inc.',
    };
  });
}

async function upsertDomain(domainData: any) {
  try {
    const dropDate = new Date(domainData.expiryDate);
    dropDate.setDate(dropDate.getDate() + 75);
    
    const daysUntilDrop = Math.floor(
      (dropDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Only store if in pending_delete range
    if (daysUntilDrop < 5 || daysUntilDrop > 15) {
      return { stored: false };
    }
    
    const tld = domainData.domainName.split('.').pop();
    const popularityScore = 50 + Math.floor(Math.random() * 50);
    
    const { error } = await supabase
      .from('domains')
      .upsert({
        domain_name: domainData.domainName,
        tld,
        expiry_date: domainData.expiryDate,
        drop_date: dropDate.toISOString().split('T')[0],
        days_until_drop: daysUntilDrop,
        status: 'pending_delete',
        registrar: domainData.registrar,
        popularity_score: popularityScore,
        category: 'tech',
        slug: domainData.domainName.replace(/\./g, '-'),
        title: `${domainData.domainName} - Dropping in ${daysUntilDrop} Days`,
      }, {
        onConflict: 'domain_name'
      });
    
    return { stored: !error };
  } catch (error) {
    return { stored: false };
  }
}
