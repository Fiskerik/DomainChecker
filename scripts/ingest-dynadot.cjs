#!/usr/bin/env node

/**
 * Domain Ingestion Script - Dynadot API Version
 * 
 * Fetches expiring domains from Dynadot API and stores them in Supabase.
 * Focuses on domains in "pending delete" status (0-10 days before drop).
 * 
 * Run: node scripts/ingest-dynadot.cjs
 * 
 * Required env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - DYNADOT_API_KEY
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DYNADOT_API_KEY = process.env.DYNADOT_API_KEY;

const MIN_DAYS_UNTIL_DROP = parseInt(process.env.MIN_DAYS_UNTIL_DROP || '0', 10);
const MAX_DAYS_UNTIL_DROP = parseInt(process.env.MAX_DAYS_UNTIL_DROP || '10', 10);

const TRENDING_KEYWORDS = [
  'ai', 'agent', 'agents', 'gpt', 'llm', 'ml', 'automate', 'automation',
  'saas', 'api', 'cloud', 'data', 'analytics', 'dev', 'app', 'mobile',
  'fintech', 'pay', 'wallet', 'crypto', 'web3', 'security', 'cyber',
  'health', 'bio', 'med', 'edu', 'learn', 'shop', 'store', 'market',
  'creator', 'video', 'stream', 'game'
];

const STRONG_COMMERCIAL_KEYWORDS = [
  'pay', 'bank', 'invest', 'trade', 'finance', 'loan', 'insure',
  'shop', 'store', 'cart', 'deal', 'book', 'travel', 'job', 'legal',
  'health', 'clinic', 'doctor', 'learn', 'course', 'school', 'academy',
  'agency', 'studio', 'labs', 'hub', 'pro'
];

const PREFERRED_TLDS = ['com', 'io', 'ai', 'app', 'co', 'dev', 'org'];

/**
 * Calculate the drop date (typically expiry + 75 days for .com)
 */
function calculateDropDate(expiryDate) {
  const date = new Date(expiryDate);
  date.setDate(date.getDate() + 75);
  return date.toISOString().split('T')[0];
}

/**
 * Normalize a date-like value to UTC midnight to avoid timezone drift
 */
function toUtcMidnight(dateInput) {
  const date = new Date(dateInput);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Calculate whole days until drop (date-only, timezone-safe)
 */
function calculateDaysUntilDrop(dropDate) {
  const todayUtcMidnight = toUtcMidnight(new Date());
  const dropUtcMidnight = toUtcMidnight(dropDate);
  return Math.round((dropUtcMidnight - todayUtcMidnight) / (1000 * 60 * 60 * 24));
}

/**
 * Determine status based on expiry date
 */
function determineStatus(expiryDate) {
  const todayUtcMidnight = toUtcMidnight(new Date());
  const expiryUtcMidnight = toUtcMidnight(expiryDate);
  const daysSinceExpiry = Math.round((todayUtcMidnight - expiryUtcMidnight) / (1000 * 60 * 60 * 24));
  
  if (daysSinceExpiry < 0) return 'active';
  if (daysSinceExpiry <= 30) return 'grace';
  if (daysSinceExpiry <= 60) return 'redemption';
  if (daysSinceExpiry <= 75) return 'pending_delete';
  return 'dropped';
}

/**
 * Simple popularity scoring algorithm
 */
function calculatePopularityScore(domainName) {
  const [rawName = '', rawTld = ''] = domainName.toLowerCase().split('.');
  const tld = rawTld.trim();
  const name = rawName.trim();
  let score = 45;

  if (!name) return 0;

  if (name.length <= 4) score += 35;
  else if (name.length <= 6) score += 28;
  else if (name.length <= 9) score += 20;
  else if (name.length <= 12) score += 10;
  else score -= 10;

  const matchedTrending = TRENDING_KEYWORDS.filter((kw) => name.includes(kw));
  score += Math.min(24, matchedTrending.length * 8);

  const matchedCommercial = STRONG_COMMERCIAL_KEYWORDS.filter((kw) => name.includes(kw));
  score += Math.min(16, matchedCommercial.length * 8);

  if (PREFERRED_TLDS.includes(tld)) {
    score += tld === 'com' ? 14 : 8;
  } else {
    score -= 12;
  }

  if (!name.includes('-')) score += 5;
  else score -= 14;

  const digitCount = (name.match(/\d/g) || []).length;
  if (digitCount === 0) score += 6;
  else if (digitCount >= 2) score -= 10;

  const vowelCount = (name.match(/[aeiou]/g) || []).length;
  const vowelRatio = vowelCount / name.length;
  if (vowelRatio < 0.2 || vowelRatio > 0.75) score -= 10;

  const consonantClusters = name.match(/[bcdfghjklmnpqrstvwxyz]{4,}/g);
  if (consonantClusters) score -= consonantClusters.length * 8;

  if (/(.)\1\1/.test(name)) score -= 8;

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
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }
  
  return 'general';
}

/**
 * Fetch expiring domains from Dynadot API
 * 
 * Dynadot API Documentation:
 * https://www.dynadot.com/domain/api3.html
 * 
 * Note: Dynadot's API focuses on domain management, not expiring domain lists.
 * You may need to use a different service for expiring domain data.
 * 
 * For now, this generates mock data. Replace with actual API call when available.
 */
async function fetchExpiringDomains() {
  console.log('🔍 Fetching expiring domains...\n');
  
  if (!DYNADOT_API_KEY) {
    console.log('⚠️  DYNADOT_API_KEY not found. Using mock data.\n');
    return generateMockDomains();
  }
  
  try {
    // IMPORTANT: Dynadot doesn't have an "expiring domains" endpoint
    // You'll need to use one of these services instead:
    // 
    // 1. ExpiredDomains.net API - https://www.expireddomains.net/
    // 2. WhoisXML API - https://whoisxmlapi.com/
    // 3. DropCatch API - https://www.dropcatch.com/
    // 4. GoDaddy Auctions API - https://developer.godaddy.com/
    
    console.log('⚠️  Note: Dynadot API doesn\'t provide expiring domain lists.');
    console.log('   Consider using ExpiredDomains.net or WhoisXML API instead.\n');
    console.log('   Generating mock data for now...\n');
    
    return generateMockDomains();
    
  } catch (error) {
    console.error('❌ Error fetching domains:', error.message);
    return generateMockDomains();
  }
}

/**
 * Generate mock domains for testing
 */
function generateMockDomains() {
  const tlds = ['com', 'io', 'ai', 'app', 'dev', 'co'];
  const prefixes = [
    'techstart', 'aitools', 'devops', 'cloudapp', 'dataflow', 'apihub',
    'payfast', 'shopnow', 'gamehub', 'fitness', 'medcare', 'edulearn',
    'cryptopay', 'nftmarket', 'webapp', 'saaskit', 'codebase', 'apigate',
    'smartai', 'quickpay', 'dealfinder', 'healthtrak', 'learnfast', 'datastream',
    'appsync', 'cloudpay', 'gamerzone', 'fittrack', 'medconnect', 'studyhub',
    'coinvault', 'nftplace', 'webforge', 'saasbase', 'devkit', 'apiflow',
    'aicore', 'paynow', 'shopease', 'gamespot', 'healthnow', 'learnpro'
  ];
  
  const mockDomains = [];
  
  // Generate 500 mock domains
  for (let i = 0; i < 500; i++) {
    const prefix = prefixes[i % prefixes.length];
    const suffix = i >= prefixes.length ? (i - prefixes.length + 1) : '';
    const tld = tlds[Math.floor(Math.random() * tlds.length)];
    const domainName = `${prefix}${suffix}.${tld}`;
    
    // Create expiry dates for pending_delete status (65-75 days ago => 10 to 0 days until drop)
    const daysAgo = 65 + Math.floor(Math.random() * 11);
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
 * Upsert domain into Supabase
 */
async function upsertDomain(domainData) {
  try {
    const { domainName, expiryDate, registrar } = domainData;
    
    const dropDate = calculateDropDate(expiryDate);
    const daysUntilDrop = calculateDaysUntilDrop(dropDate);
    const status = determineStatus(expiryDate);
    
    // Only store domains in pending_delete status (0-10 days until drop)
    if (status !== 'pending_delete' || daysUntilDrop < MIN_DAYS_UNTIL_DROP || daysUntilDrop > MAX_DAYS_UNTIL_DROP) {
      return { stored: false, reason: `Status: ${status}, Days: ${daysUntilDrop}` };
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
        expiry_date: expiryDate,
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

/**
 * Update status of existing domains
 */
async function updateExistingDomains() {
  console.log('\n📊 Updating status of existing domains...\n');
  
  try {
    const { data: domains, error } = await supabase
      .from('domains')
      .select('*')
      .neq('status', 'dropped');
    
    if (error) {
      console.error('❌ Error fetching domains:', error.message);
      return;
    }
    
    let updated = 0;
    let dropped = 0;
    
    for (const domain of domains) {
      const newStatus = determineStatus(domain.expiry_date);
      const newDaysUntilDrop = calculateDaysUntilDrop(domain.drop_date);
      
      if (newStatus !== domain.status || newDaysUntilDrop !== domain.days_until_drop) {
        const { error: updateError } = await supabase
          .from('domains')
          .update({
            status: newStatus,
            days_until_drop: newDaysUntilDrop,
            last_updated: new Date().toISOString(),
          })
          .eq('id', domain.id);
        
        if (!updateError) {
          updated++;
          if (newStatus === 'dropped') dropped++;
        }
      }
    }
    
    console.log(`   ✅ Updated ${updated} domains`);
    console.log(`   📉 Marked ${dropped} domains as dropped\n`);
    
  } catch (error) {
    console.error('❌ Error updating domains:', error.message);
  }
}

/**
 * Cleanup old dropped domains
 */
async function cleanupOldDomains() {
  console.log('🗑️  Cleaning up old dropped domains...\n');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data, error } = await supabase
      .from('domains')
      .delete()
      .eq('status', 'dropped')
      .lt('drop_date', thirtyDaysAgo.toISOString().split('T')[0])
      .select();
    
    if (error) {
      console.error('❌ Error cleaning up:', error.message);
      return;
    }
    
    console.log(`   ✅ Cleaned up ${data?.length || 0} old domains\n`);
    
  } catch (error) {
    console.error('❌ Error in cleanup:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Domain Ingestion Script - Dynadot Version');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    const domains = await fetchExpiringDomains();
    console.log(`📦 Received ${domains.length} domains\n`);

    const rankedDomains = domains
      .map((domain) => ({
        ...domain,
        popularityScore: calculatePopularityScore(domain.domainName),
      }))
      .sort((a, b) => b.popularityScore - a.popularityScore);

    console.log('💾 Processing domains...\n');
    
    let stored = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const domain of rankedDomains) {
      const result = await upsertDomain(domain);
      
      if (result.stored) {
        stored++;
        const d = result.domain;
        console.log(`   ✅ ${d.domain_name.padEnd(25)} | ${d.days_until_drop} days | Score: ${d.popularity_score}/100`);
      } else {
        skipped++;
      }
      
      if (result.error) errors++;
    }
    
    console.log('\n───────────────────────────────────────────────────────');
    console.log(`   Stored: ${stored} | Skipped: ${skipped} | Errors: ${errors}`);
    console.log('───────────────────────────────────────────────────────\n');
    
    await updateExistingDomains();
    await cleanupOldDomains();
    
    const { count } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  📊 Total pending delete domains: ${count}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('✅ Script completed successfully!\n');
    
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
