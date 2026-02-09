#!/usr/bin/env node

/**
 * Domain Ingestion Script
 * 
 * This script fetches expiring domains from WhoisXML API and stores them in Supabase.
 * It focuses on domains in "pending delete" status (5-15 days before drop).
 * 
 * Run: node scripts/ingest.js
 * 
 * Required env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - WHOIS_API_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WHOIS_API_KEY = process.env.WHOIS_API_KEY;
const WHOIS_API_BASE = 'https://whoisxmlapi.com/api/v1';

/**
 * Calculate the drop date (typically expiry + 75 days for .com)
 */
function calculateDropDate(expiryDate) {
  const date = new Date(expiryDate);
  date.setDate(date.getDate() + 75); // Standard drop timeline
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
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
 * In production, you'd integrate with Google Trends API, SEMrush, etc.
 */
function calculatePopularityScore(domainName) {
  const name = domainName.split('.')[0].toLowerCase();
  let score = 50; // Base score
  
  // Length bonus (shorter is better)
  if (name.length <= 5) score += 30;
  else if (name.length <= 8) score += 20;
  else if (name.length <= 10) score += 10;
  
  // Trending keywords bonus
  const trendingKeywords = [
    'ai', 'ml', 'crypto', 'nft', 'web3', 'saas', 'app', 'dev', 
    'tech', 'cloud', 'data', 'api', 'io', 'pay', 'shop', 'game'
  ];
  
  const hasTrendingKeyword = trendingKeywords.some(keyword => 
    name.includes(keyword)
  );
  if (hasTrendingKeyword) score += 25;
  
  // No hyphens or numbers (cleaner domains)
  if (!name.includes('-') && !/\d/.test(name)) score += 10;
  
  // Dictionary word bonus (very basic check)
  // In production, use a real dictionary API
  const commonWords = ['get', 'buy', 'my', 'the', 'new', 'best', 'top', 'pro'];
  const hasCommonWord = commonWords.some(word => name.includes(word));
  if (hasCommonWord) score += 5;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Categorize domain based on keywords
 */
function categorizeDomain(domainName) {
  const name = domainName.toLowerCase();
  
  const categories = {
    tech: ['ai', 'app', 'dev', 'tech', 'code', 'cloud', 'data', 'api', 'io', 'software'],
    finance: ['pay', 'coin', 'crypto', 'bank', 'invest', 'fund', 'trade', 'finance', 'wallet'],
    ecommerce: ['shop', 'store', 'buy', 'market', 'sell', 'deal', 'cart', 'order'],
    health: ['health', 'fit', 'med', 'care', 'wellness', 'bio', 'pharma', 'clinic'],
    gaming: ['game', 'play', 'esport', 'stream', 'gaming', 'gamer'],
    education: ['learn', 'edu', 'course', 'teach', 'school', 'academy', 'study'],
    social: ['social', 'chat', 'meet', 'connect', 'community', 'network'],
    entertainment: ['music', 'video', 'movie', 'show', 'entertainment', 'media'],
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }
  
  return 'general';
}

/**
 * Fetch expiring domains from WhoisXML API
 * Note: You may need to adjust this based on the actual API endpoint you're using
 */
async function fetchExpiringDomains() {
  console.log('🔍 Fetching expiring domains from WhoisXML API...\n');
  
  try {
    // Example using the "Newly Expiring Domains" API
    // Adjust the endpoint based on your WhoisXML API subscription
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 90); // Look 90 days ahead
    
    const params = new URLSearchParams({
      apiKey: WHOIS_API_KEY,
      outputFormat: 'json',
      // These params depend on which WhoisXML API product you're using
      // Adjust according to their documentation
    });

    // IMPORTANT: Replace this with the actual WhoisXML API endpoint for expiring domains
    // This is a placeholder - check WhoisXML API docs for the correct endpoint
    const url = `${WHOIS_API_BASE}/expiringDomains?${params}`;
    
    console.log('⚠️  NOTE: This is using a mock data generator for testing.');
    console.log('   Update the API endpoint in production with your actual WhoisXML subscription.\n');
    
    // For MVP testing, we'll generate some mock data
    // REPLACE THIS with actual API call in production:
    // const response = await fetch(url);
    // const data = await response.json();
    // return data.domains || [];
    
    return generateMockDomains();
    
  } catch (error) {
    console.error('❌ Error fetching from WhoisXML API:', error.message);
    throw error;
  }
}

/**
 * Generate mock domains for testing
 * REMOVE THIS in production and use real API data
 */
function generateMockDomains() {
  const tlds = ['com', 'io', 'ai', 'app', 'dev', 'co'];
  const prefixes = [
    'techstart', 'aitools', 'devops', 'cloudapp', 'dataflow', 'apihub',
    'payfast', 'shopnow', 'gamehub', 'fitness', 'medcare', 'edulearn',
    'cryptopay', 'nftmarket', 'webapp', 'saaskit', 'codebase', 'apigate'
  ];
  
  const mockDomains = [];
  
  // Generate 50 mock domains
  for (let i = 0; i < 50; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const tld = tlds[Math.floor(Math.random() * tlds.length)];
    const domainName = `${prefix}${i > 25 ? i : ''}.${tld}`;
    
    // Create expiry dates that result in pending_delete status (60-75 days ago)
    const daysAgo = 60 + Math.floor(Math.random() * 15); // 60-75 days ago
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
    
    // Generate slug and title for SEO
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
      console.error(`   ❌ Error upserting ${domainName}:`, error.message);
      return { stored: false, error: error.message };
    }
    
    return { stored: true, domain: data[0] };
    
  } catch (error) {
    console.error(`   ❌ Error processing domain:`, error.message);
    return { stored: false, error: error.message };
  }
}

/**
 * Update status of existing domains
 */
async function updateExistingDomains() {
  console.log('\n📊 Updating status of existing domains...\n');
  
  try {
    // Fetch all domains that haven't dropped yet
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
          if (newStatus === 'dropped') {
            dropped++;
          }
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
 * Cleanup old dropped domains (keep only last 30 days)
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
  console.log('  Domain Ingestion Script - Pending Delete Tracker');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Fetch new domains
    const domains = await fetchExpiringDomains();
    console.log(`📦 Received ${domains.length} domains from API\n`);
    
    // 2. Process and store domains
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
      
      if (result.error) {
        errors++;
      }
    }
    
    console.log('\n───────────────────────────────────────────────────────');
    console.log(`   Stored: ${stored} | Skipped: ${skipped} | Errors: ${errors}`);
    console.log('───────────────────────────────────────────────────────\n');
    
    // 3. Update existing domains
    await updateExistingDomains();
    
    // 4. Cleanup old domains
    await cleanupOldDomains();
    
    // 5. Show current stats
    const { count, error } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete');
    
    if (!error) {
      console.log('═══════════════════════════════════════════════════════');
      console.log(`  📊 Total pending delete domains in database: ${count}`);
      console.log('═══════════════════════════════════════════════════════\n');
    }
    
    console.log('✅ Script completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };
