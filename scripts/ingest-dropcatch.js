#!/usr/bin/env node

/**
 * DropCatch API Integration Script
 * 
 * Fetches domains from DropCatch auctions and stores them in Supabase.
 * DropCatch specializes in expiring/dropping domains.
 * 
 * API Documentation: https://www.dropcatch.com/help/api
 * 
 * Run: node scripts/ingest-dropcatch.js
 * 
 * Required env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - DROPCATCH_API_KEY
 */

// Endast för lokal utveckling!
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const AdmZip = require('adm-zip');
const { parse } = require('csv-parse/sync');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_DOMAINS_TO_STORE = parseInt(process.env.MAX_DOMAINS_TO_STORE || '100', 10);
const MIN_POPULARITY_SCORE = parseInt(process.env.MIN_POPULARITY_SCORE || '0', 10);

//const { isActuallyExpiring } = require('../lib/whois-validator.ts');



async function getDropCatchToken() {
  // Här använder du dina credentials från .env
  const clientId = process.env.DROPCATCH_CLIENT_ID; 
  const clientSecret = process.env.DROPCATCH_CLIENT_SECRET;

  // Se din bifogade bild för endpointen
  const response = await axios.post('https://api.dropcatch.com/authorize', {
    clientId: clientId,
    clientSecret: clientSecret
  });
  
  return response.data.token; // Detta är token du sen använder i dina anrop
}

/**
 * Fetch domains from DropCatch API
 */


async function fetchDropCatchDomains() {
  console.log('🔍 Fetching dropping domains file from DropCatch...\n');

  try {
    const token = await getDropCatchToken();

    const response = await axios.get('https://api.dropcatch.com/v2/downloads/dropping/AllDays?fileType=Csv', {
      headers: { 'Authorization': `Bearer ${token}` },
      responseType: 'arraybuffer'
    });

    const zip = new AdmZip(response.data);
    const zipEntries = zip.getEntries();
    if (zipEntries.length === 0) throw new Error('Zip file is empty');

    const csvData = zipEntries[0].getData().toString('utf8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true });

    if (records.length > 0) {
      const sampleKeys = Object.keys(records[0]);
      console.log(`🧪 CSV diagnostics: ${records.length} rows, columns: ${sampleKeys.join(', ')}`);
    }

    const parsedDomains = records.map((row, index) => {
      // DropCatch CSV-kolumner kan heta olika saker.
      const domainKey = Object.keys(row).find((key) => /domain|name/i.test(key));
      const dropDateKey = Object.keys(row).find((key) => /drop/i.test(key) && /date|dt|time/i.test(key));

      const rawName = row.DomainName || row.Domain || row.domain || row.name || (domainKey ? row[domainKey] : undefined);
      const rawDropDate = row.DropDate || row.drop_date || row.DropDateUtc || row.dropDate || (dropDateKey ? row[dropDateKey] : undefined);
      const validDropDate = normalizeDate(rawDropDate);

      if (!validDropDate) {
        if (index < 20) {
          console.log(`⚠️  Skipping ${rawName || 'unknown'} due to invalid drop date: ${rawDropDate}`);
        }
        return null;
      }

      const normalizedDomainName = (rawName || '').trim().toLowerCase();
      if (!normalizedDomainName) return null;

      return {
        domainName: normalizedDomainName,
        dropDate: validDropDate,
        expiryDate: calculateExpiryFromDrop(validDropDate),
        registrar: row.Registrar || 'Unknown'
      };
    })
    .filter(Boolean);

    const rankedDomains = parsedDomains
      .map((domain) => ({
        ...domain,
        popularityScore: calculatePopularityScore(domain.domainName),
      }))
      .filter((domain) => domain.popularityScore >= MIN_POPULARITY_SCORE)
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, MAX_DOMAINS_TO_STORE)
      .map(({ popularityScore, ...domain }) => domain);

    console.log(`✅ Successfully processed ${parsedDomains.length} domains from DropCatch CSV`);
    console.log(`📈 Selected top ${rankedDomains.length} domains by popularity score (min ${MIN_POPULARITY_SCORE}, max ${MAX_DOMAINS_TO_STORE})\n`);
    return rankedDomains;

  } catch (error) {
    console.error('❌ Misslyckades att hämta DropCatch-data:', error.message);
    console.log('   Using mock data instead...\n');
    return generateMockDomains();
  }
}

/**
 * Calculate expiry date from drop date (drop date - 75 days)
 */
function calculateExpiryFromDrop(dropDate) {
  const drop = new Date(dropDate);
  drop.setDate(drop.getDate() - 75);
  return drop.toISOString().split('T')[0];
}

/**
 * Normalize and validate date input (YYYY-MM-DD output)
 */
function normalizeDate(rawDate) {
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) return null;

  return parsed.toISOString().split('T')[0];
}

/**
 * Calculate drop date from expiry date
 */
function calculateDropDate(expiryDate) {
  const date = new Date(expiryDate);
  date.setDate(date.getDate() + 75);
  return date.toISOString().split('T')[0];
}

/**
 * Calculate days until drop
 */
function calculateDaysUntilDrop(dropDate) {
  const today = new Date();
  const drop = new Date(dropDate);
  const diffTime = drop - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determine status
 */
function determineStatus(expiryDate) {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysSinceExpiry = Math.floor((today - expiry) / (1000 * 60 * 60 * 24));
  
  if (daysSinceExpiry < 0) return 'active';
  if (daysSinceExpiry <= 30) return 'grace';
  if (daysSinceExpiry <= 60) return 'redemption';
  if (daysSinceExpiry <= 75) return 'pending_delete';
  return 'dropped';
}

/**
 * Calculate popularity score
 */
function calculatePopularityScore(domainName) {
  const name = domainName.split('.')[0].toLowerCase();
  let score = 50;
  
  if (name.length <= 5) score += 30;
  else if (name.length <= 8) score += 20;
  else if (name.length <= 10) score += 10;
  
  const trending = ['ai', 'ml', 'crypto', 'nft', 'web3', 'saas', 'app', 'dev', 'tech', 'cloud', 'data', 'api', 'pay', 'shop', 'game'];
  if (trending.some(kw => name.includes(kw))) score += 25;
  
  if (!name.includes('-') && !/\d/.test(name)) score += 10;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Categorize domain
 */
function categorizeDomain(domainName) {
  const name = domainName.toLowerCase();
  const categories = {
    tech: ['ai', 'app', 'dev', 'tech', 'code', 'cloud', 'data', 'api', 'software'],
    finance: ['pay', 'coin', 'crypto', 'bank', 'invest', 'fund', 'trade', 'finance'],
    ecommerce: ['shop', 'store', 'buy', 'market', 'sell', 'deal', 'cart'],
    health: ['health', 'fit', 'med', 'care', 'wellness', 'bio'],
    gaming: ['game', 'play', 'esport', 'stream', 'gaming'],
    education: ['learn', 'edu', 'course', 'teach', 'school'],
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => name.includes(kw))) return category;
  }
  return 'general';
}

/**
 * Generate mock domains
 */
function generateMockDomains() {
  const tlds = ['com', 'io', 'ai', 'app', 'dev', 'co'];
  const prefixes = [
    'techstart', 'aitools', 'devops', 'cloudapp', 'dataflow', 'apihub',
    'payfast', 'shopnow', 'gamehub', 'fitness', 'medcare', 'edulearn',
    'cryptopay', 'nftmarket', 'webapp', 'saaskit', 'codebase', 'apigate',
    'smartai', 'quickpay', 'dealfinder', 'healthtrak', 'learnfast', 'datastream'
  ];
  
  const mockDomains = [];
  
  for (let i = 0; i < 50; i++) {
    const prefix = prefixes[i % prefixes.length];
    const suffix = i >= prefixes.length ? (i - prefixes.length + 1) : '';
    const tld = tlds[Math.floor(Math.random() * tlds.length)];
    const domainName = `${prefix}${suffix}.${tld}`;
    
    const daysAgo = 60 + Math.floor(Math.random() * 15);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - daysAgo);
    
    mockDomains.push({
      domainName,
      expiryDate: expiryDate.toISOString().split('T')[0],
      registrar: 'Mock Registrar Inc.',
    });
  }
  
  return mockDomains;
}

/**
 * Upsert domain into database
 */
async function upsertDomain(domainData) {
  try {
    const { domainName, expiryDate, registrar } = domainData;

    const normalizedExpiryDate = normalizeDate(expiryDate);
    if (!normalizedExpiryDate) {
      return { stored: false, reason: `Invalid expiry date: ${expiryDate}` };
    }
    
    const dropDate = normalizeDate(domainData.dropDate) || calculateDropDate(normalizedExpiryDate);
    const daysUntilDrop = calculateDaysUntilDrop(dropDate);
    const status = determineStatus(normalizedExpiryDate);
    
    // Only store pending_delete domains (5-15 days window)
    if (status !== 'pending_delete' || daysUntilDrop < 5 || daysUntilDrop > 15) {
      return { stored: false, reason: `Out of range: ${status}, ${daysUntilDrop}d` };
    }
    
    const tld = domainName.split('.').pop();
    const popularityScore = calculatePopularityScore(domainName);
    const category = categorizeDomain(domainName);
    const slug = domainName.replace(/\./g, '-');
    const title = `${domainName} - Premium Domain Dropping in ${daysUntilDrop} Days`;
    
    const { data, error } = await supabase
      .from('domains')
      .upsert({
        domain_name: domainName,
        tld,
        expiry_date: normalizedExpiryDate,
        drop_date: dropDate,
        days_until_drop: daysUntilDrop,
        status,
        registrar,
        popularity_score: popularityScore,
        category,
        slug,
        title,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'domain_name'
      })
      .select();
    
    if (error) {
      return { stored: false, error: error.message };
    }
    
    return { stored: true, domain: data[0] };
    
  } catch (error) {
    return { stored: false, error: error.message };
  }
}
async function quickCheck(domainName) {
  try {
    const [aResponse, nsResponse, soaResponse] = await Promise.all([
      fetch(`https://dns.google/resolve?name=${domainName}&type=A`),
      fetch(`https://dns.google/resolve?name=${domainName}&type=NS`),
      fetch(`https://dns.google/resolve?name=${domainName}&type=SOA`),
    ]);

    const [aData, nsData, soaData] = await Promise.all([
      aResponse.json(),
      nsResponse.json(),
      soaResponse.json(),
    ]);

    // If DNS resolves (A/NS/SOA or Status=0), the domain is almost certainly taken.
    const hasRecords = [aData, nsData, soaData].some(data => Array.isArray(data.Answer) && data.Answer.length > 0);
    const hasNoError = [aData, nsData, soaData].some(data => data.Status === 0);

    if (hasRecords || hasNoError) {
      console.log(`   WHOIS filter: skip taken domain ${domainName}`);
      return false;
    }

    return true;
  } catch (error) {
    console.log(`   WHOIS filter warning (${domainName}): ${error.message}`);
    return true;
  }
}
/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  DropCatch API Integration');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    const domains = await fetchDropCatchDomains();
    const limitedDomains = domains.slice(0, MAX_DOMAINS_TO_STORE);
    console.log(`📦 Processing ${limitedDomains.length} domains (hard cap: ${MAX_DOMAINS_TO_STORE})...\n`);
    
    let stored = 0;
    let skipped = 0;
    
    for (const domain of limitedDomains) {
    const isExpiring = await quickCheck(domain.domainName);
    if (!isExpiring) {
      skipped++;
      continue;
    }
      const result = await upsertDomain(domain);
      
      if (result.stored) {
        stored++;
        const d = result.domain;
        console.log(`   ✅ ${d.domain_name.padEnd(30)} | ${d.days_until_drop}d | ${d.popularity_score}/100`);
      } else {
        skipped++;
        if (result.reason) {
          console.log(`   ℹ️  Skip ${domain.domainName}: ${result.reason}`);
        } else if (result.error) {
          console.log(`   ⚠️  Error ${domain.domainName}: ${result.error}`);
        }
      }
    }
    
    console.log('\n───────────────────────────────────────────────────────');
    console.log(`   Stored: ${stored} | Skipped: ${skipped}`);
    console.log('───────────────────────────────────────────────────────\n');
    
    const { count } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  📊 Total domains in database: ${count}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('✅ Ingestion complete!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };
