import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (process.env.INGEST_SECRET && secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting live ingestion from DropCatch...');
    
    // 1. Hämta domäner från DropCatch API
    const liveDomains = await fetchDropCatchData();
    
    // Begränsa till 100 för att undvika timeout på Vercel (Hobby plan har 10s limit)
    const limitedDomains = liveDomains.slice(0, 100);
    
    let stored = 0;
    let skipped = 0;
    
    for (const domain of limitedDomains) {
      const result = await upsertDomain(domain);
      if (result.stored) stored++;
      else skipped++;
    }
    
    return NextResponse.json({
      success: true,
      message: `Ingested ${stored} domains from DropCatch, skipped ${skipped}`,
      total_processed: limitedDomains.length
    });
    
  } catch (error: any) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      { error: 'Ingestion failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Hämtar token och laddar ner CSV från DropCatch
 */
async function fetchDropCatchData() {
  // Hämta Token
  const authRes = await axios.post('https://api.dropcatch.com/authorize', {
    clientId: process.env.DROPCATCH_CLIENT_ID,
    clientSecret: process.env.DROPCATCH_CLIENT_SECRET
  });
  const token = authRes.data.token;

  // Hämta ZIP med CSV (DaysOut0 = domäner som droppar idag/snart)
  const response = await axios.get('https://api.dropcatch.com/v2/downloads/dropping/DaysOut0?fileType=Csv', {
    headers: { 'Authorization': `Bearer ${token}` },
    responseType: 'arraybuffer'
  });

  const zip = new AdmZip(Buffer.from(response.data));
  const zipEntries = zip.getEntries();
  const csvData = zipEntries[0].getData().toString('utf8');
  
  const records = parse(csvData, { columns: true, skip_empty_lines: true });

  return records.map((row: any) => ({
    domainName: row.DomainName || row.Domain,
    dropDate: row.DropDate,
    registrar: row.Registrar || 'DropCatch'
  }));
}

async function upsertDomain(domainData: any) {
  try {
    const dropDate = new Date(domainData.dropDate);
    const today = new Date();
    
    const daysUntilDrop = Math.ceil(
      (dropDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Baserat på ICANN:s PendingDelete status (5 dagar)
    // Vi sparar domäner som droppar inom kort
    if (daysUntilDrop < 0 || daysUntilDrop > 7) {
      return { stored: false };
    }
    
    const domainName = domainData.domainName.toLowerCase();
    const tld = domainName.split('.').pop();
    
    // Enkel kategorisering
    const categories = ['tech', 'finance', 'health', 'ecommerce'];
    const category = categories.find(c => domainName.includes(c)) || 'general';

    const { error } = await supabase
      .from('domains')
      .upsert({
        domain_name: domainName,
        tld,
        drop_date: dropDate.toISOString().split('T')[0],
        days_until_drop: daysUntilDrop,
        status: 'pending_delete', // Status där domänen inte kan förnyas
        registrar: domainData.registrar,
        popularity_score: Math.floor(Math.random() * 40) + 60, // Exempelscore
        category,
        slug: domainName.replace(/\./g, '-'),
        title: `${domainName} - Premium Domain Available Soon`,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'domain_name'
      });
    
    return { stored: !error };
  } catch (error) {
    return { stored: false };
  }
}