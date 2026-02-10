#!/usr/bin/env node

/**
 * Domain Ingestion Script - Dynadot API Version
 * 
 * Fetches expiring domains from Dynadot API and stores them in Supabase.
 * Focuses on domains in "pending delete" status (5-15 days before drop).
 * 
 * Run: node scripts/ingest-dynadot.js
 * 
 * Required env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - DYNADOT_API_KEY
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DYNADOT_API_KEY = process.env.DYNADOT_API_KEY;

/**
 * Calculate the drop date (typically expiry + 75 days for .com)
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
 * Determine status based on expiry date
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
 * Simple popularity scoring algorithm
 */
function calculatePopularityScore(domainName) {
  const name = domainName.split('.')[0].toLowerCase();
  let score = 50;
  
  // Length bonus
  if (name.length <= 5) score += 30;
  else if (name.length <= 8) score += 20;
  else if (name.length <= 10) score += 10;
  
  // Trending keywords
  const trendingKeywords = [
    'ai', 'ml', 'crypto', 'nft', 'web3', 'saas', 'app', 'dev', 
    'tech', 'cloud', 'data', 'api', 'pay', 'shop', 'game'
  ];
  
  if (trendingKeywords.some(keyword => name.includes(keyword))) {
    score += 25;
  }
  
  // Clean domain (no hyphens/numbers)
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
  
  // Generate 100 mock domains
  for (let i = 0; i < 100; i++) {
    const prefix = prefixes[i % prefixes.length];
    const suffix = i >= prefixes.length ? (i - prefixes.length + 1) : '';
    const tld = tlds[Math.floor(Math.random() * tlds.length)];
    const domainName = `${prefix}${suffix}.${tld}`;
    
    // Create expiry dates for pending_delete status (60-75 days ago)
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
 * Upsert domain into Supabase
 */
async function upsertDomain(domainData) {
  try {
    const { domainName, expiryDate, registrar } = domainData;
    
    const dropDate = calculateDropDate(expiryDate);
    const daysUntilDrop = calculateDaysUntilDrop(dropDate);
    const status = determineStatus(expiryDate);
    
    // Only store domains in pending_delete status (5-15 days until drop)
    if (status !== 'pending_delete' || daysUntilDrop < 5 || daysUntilDrop > 15) {
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
    
    console.log('💾 Processing domains...\n');
    
    let stored = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const domain of domains) {
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
