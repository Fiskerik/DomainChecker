/**
 * Complete Ingestion Script with Scoring + WHOIS Validation
 * 
 * FEATURES:
 * ✅ Advanced domain scoring (filters gibberish)
 * ✅ WHOIS validation (removes still-registered domains)
 * ✅ Pure JavaScript (no TypeScript errors)
 * 
 * SETUP:
 * 1. npm install @supabase/supabase-js whois-json dotenv
 * 2. Add to .env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 3. Run: node scripts/ingest-with-scoring-and-whois.js
 */

import { createClient } from '@supabase/supabase-js';
import whois from 'whois-json';
import dotenv from 'dotenv';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NAMEBIO_API_KEY = process.env.NAMEBIO_API_KEY; // Optional

const MIN_SCORE = 30; // Reject domains below this score
const ENABLE_WHOIS_CHECK = true; // Set to false to skip WHOIS validation
const MAX_DOMAINS_TO_PROCESS = parseInt(process.env.MAX_DOMAINS_TO_STORE || '300', 10);
const WHOIS_REQUEST_DELAY_MS = parseInt(process.env.WHOIS_REQUEST_DELAY_MS || '2000', 10);
const WHOIS_RETRY_ATTEMPTS = parseInt(process.env.WHOIS_RETRY_ATTEMPTS || '2', 10);
const WHOIS_RETRY_DELAY_MS = parseInt(process.env.WHOIS_RETRY_DELAY_MS || '1500', 10);
const WHOIS_FAILURE_COOLDOWN_AFTER = parseInt(process.env.WHOIS_FAILURE_COOLDOWN_AFTER || '10', 10);
const WHOIS_FAILURE_COOLDOWN_MS = parseInt(process.env.WHOIS_FAILURE_COOLDOWN_MS || '12000', 10);
const DOMAIN_STATUS_SOURCE = (process.env.DOMAIN_STATUS_SOURCE || 'namecheap').toLowerCase(); // namecheap | whois

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isWhoisTransientError(errorMessage) {
  if (!errorMessage) return false;
  const normalized = String(errorMessage).toLowerCase();
  return [
    'econnrefused',
    'etimedout',
    'socket hang up',
    'econnreset',
    'connection reset',
  ].some(token => normalized.includes(token));
}

async function queryWhoisWithRetry(domainName) {
  let lastError = null;

  for (let attempt = 1; attempt <= WHOIS_RETRY_ATTEMPTS; attempt++) {
    try {
      return await whois(domainName);
    } catch (error) {
      lastError = error;
      const transient = isWhoisTransientError(error?.message);
      const shouldRetry = transient && attempt < WHOIS_RETRY_ATTEMPTS;

      console.log(`   ⚠️  WHOIS attempt ${attempt}/${WHOIS_RETRY_ATTEMPTS} failed: ${error.message}`);

      if (shouldRetry) {
        console.log(`   ℹ️  Retrying WHOIS in ${WHOIS_RETRY_DELAY_MS}ms...`);
        await sleep(WHOIS_RETRY_DELAY_MS);
      } else {
        break;
      }
    }
  }

  throw lastError;
}

async function queryNamecheapAvailability(domainName) {
  const url = `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domainName)}`;
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.namecheap.com/',
      DNT: '1',
    },
    responseType: 'text',
  });

  const html = String(response.data || '');
  const normalizedHtml = html.toLowerCase().replace(/\s+/g, ' ');
  const normalizedDomain = domainName.toLowerCase();

  console.log(`   🧪 Namecheap HTML check for ${domainName}: ${normalizedHtml.length} chars`);

  const takenSignals = [
    `${normalizedDomain} is taken`,
    `"domain":"${normalizedDomain}","isavailable":false`,
    'domain is taken',
    'already registered',
  ];

  if (takenSignals.some((signal) => normalizedHtml.includes(signal))) {
    return 'taken';
  }

  const availableSignals = [
    `"domain":"${normalizedDomain}","isavailable":true`,
    `${normalizedDomain}</span>`,
    `${normalizedDomain}</h`,
  ];

  if (availableSignals.some((signal) => normalizedHtml.includes(signal))) {
    return 'available';
  }

  return 'unknown';
}

async function getNamecheapStatus(domainName) {
  try {
    console.log(`   🔍 Checking Namecheap availability for ${domainName}...`);
    const availability = await queryNamecheapAvailability(domainName);
    console.log(`   ℹ️  Namecheap status: ${availability}`);
    return availability;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const responseBody = String(error.response?.data || '').slice(0, 200).replace(/\s+/g, ' ');

      if (status === 403) {
        console.log(`   ⚠️  Namecheap returned 403 Forbidden for ${domainName} (likely anti-bot/CDN protection).`);
      }

      console.log(`   🧪 Namecheap error diagnostics: status=${status || 'none'} statusText=${statusText || 'none'} bodyPreview="${responseBody || 'none'}"`);
    }
    console.log(`   ⚠️  Namecheap availability check failed: ${error.message}`);
    return 'unknown';
  }
}

async function getDropCatchToken() {
  const clientId = process.env.DROPCATCH_CLIENT_ID;
  const clientSecret = process.env.DROPCATCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing DROPCATCH_CLIENT_ID or DROPCATCH_CLIENT_SECRET');
  }

  const response = await axios.post('https://api.dropcatch.com/authorize', {
    clientId,
    clientSecret,
  });

  if (!response.data?.token) {
    throw new Error('DropCatch authorize response did not contain token');
  }

  return response.data.token;
}

function normalizeDate(rawDate) {
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().split('T')[0];
}

function calculateExpiryFromDrop(dropDate) {
  const drop = new Date(dropDate);
  drop.setDate(drop.getDate() - 75);
  return drop.toISOString().split('T')[0];
}

async function fetchDropCatchDomains() {
  console.log('🔍 Fetching dropping domains file from DropCatch...\n');

  const token = await getDropCatchToken();

  const response = await axios.get('https://api.dropcatch.com/v2/downloads/dropping/DaysOut0?fileType=Csv', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    },
    responseType: 'arraybuffer',
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

  const parsedDomains = records
    .map((row, index) => {
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
        registrar: row.Registrar || 'Unknown',
      };
    })
    .filter(Boolean)
    .slice(0, MAX_DOMAINS_TO_PROCESS);

  console.log(`✅ Successfully processed ${parsedDomains.length} domains from DropCatch CSV\n`);

  return parsedDomains;
}

// ============================================================================
// TRENDING KEYWORDS (2025)
// ============================================================================

const TRENDING_KEYWORDS = {
  // AI & Tech
  ai: 25,
  quantum: 24,
  neural: 23,
  llm: 22,
  agent: 21,
  autonomous: 20,
  
  // Crypto & Web3
  defi: 22,
  web3: 21,
  blockchain: 19,
  nft: 18,
  token: 17,
  
  // Climate
  climate: 23,
  carbon: 21,
  renewable: 20,
  solar: 19,
  sustainable: 18,
  
  // Health
  longevity: 24,
  biohack: 22,
  wellness: 20,
  mental: 19,
  therapy: 18,
  
  // Generic valuable
  labs: 19,
  hub: 17,
  pro: 18,
  studio: 16,
  academy: 15,
};

// ============================================================================
// SCORING ENGINE
// ============================================================================

function calculateDomainScore(domainName) {
  const name = domainName.split('.')[0].toLowerCase();
  const tld = domainName.split('.')[1] || 'com';
  const length = name.length;
  
  let score = {
    nameQuality: 0,
    trendingWords: 0,
    historicalValue: 0,
    technicalMetrics: 0,
    total: 0,
    badges: [],
    reasoning: '',
  };
  
  // 1. NAME QUALITY (0-30 points)
  
  // Check for gibberish patterns (instant reject)
  const gibberishPatterns = [
    /^[bcdfghjklmnpqrstvwxyz]{5,}/i, // 5+ consonants
    /[xqz]{2,}/i, // Repeated rare letters
    /^\d+[a-z]+$/i, // Numbers then letters
    /^[a-z]+\d+$/i, // Letters then numbers
  ];
  
  for (const pattern of gibberishPatterns) {
    if (pattern.test(name)) {
      score.reasoning = 'Gibberish pattern detected';
      return score; // Return 0 score
    }
  }
  
  // Length scoring (requested buckets)
  if (length >= 2 && length <= 8) score.nameQuality += 18;
  else if (length >= 9 && length <= 12) score.nameQuality += 12;
  else if (length >= 13 && length <= 16) score.nameQuality += 6;
  else if (length >= 17) score.nameQuality -= 10;
  
  // Pronounceability (vowel ratio)
  const vowels = (name.match(/[aeiou]/gi) || []).length;
  const vowelRatio = vowels / length;
  if (vowelRatio >= 0.25 && vowelRatio <= 0.6) {
    score.nameQuality += 10;
  }
  
  // No numbers/hyphens
  if (!/\d/.test(name)) score.nameQuality += 5;
  else score.nameQuality -= 5;
  
  if (!/-/.test(name)) score.nameQuality += 5;
  else score.nameQuality -= 5;
  
  score.nameQuality = Math.max(0, Math.min(30, score.nameQuality));
  
  // 2. TRENDING WORDS (0-25 points)
  
  for (const [keyword, points] of Object.entries(TRENDING_KEYWORDS)) {
    if (name.includes(keyword)) {
      score.trendingWords += points;
      if (points >= 20) {
        score.badges.push('🔥 Trending');
      }
    }
  }
  score.trendingWords = Math.min(25, score.trendingWords);
  
  // 3. HISTORICAL VALUE (0-25 points)
  
  // Short domain premium
  if (length <= 5 && ['com', 'io', 'ai'].includes(tld)) {
    score.historicalValue += 15;
  }
  
  // Valuable patterns
  if (/ai$|labs$|hub$|pro$/i.test(name)) {
    score.historicalValue += 10;
  }
  
  score.historicalValue = Math.min(25, score.historicalValue);
  
  // 4. TECHNICAL METRICS (0-20 points)
  
  const tldScores = {
    com: 10, io: 8, ai: 9, app: 7,
    dev: 7, co: 6, net: 5, org: 5,
  };
  score.technicalMetrics += tldScores[tld] || 3;
  
  // Dictionary word bonus
  const commonWords = ['get', 'my', 'go', 'use', 'find', 'make', 'build'];
  if (commonWords.some(word => name.startsWith(word) || name.endsWith(word))) {
    score.technicalMetrics += 5;
  }
  
  // Clean characters
  if (!/[^a-z]/.test(name)) {
    score.technicalMetrics += 5;
  }

  // Penalize very long names so they cannot score unrealistically high
  if (length >= 17) score.technicalMetrics -= 12;
  else if (length >= 13) score.technicalMetrics -= 5;
  
  score.technicalMetrics = Math.max(-12, Math.min(20, score.technicalMetrics));
  
  // CALCULATE TOTAL
  score.total = Math.max(0, Math.min(100, score.nameQuality + score.trendingWords + score.historicalValue + score.technicalMetrics));
  
  // Add badges
  if (score.nameQuality >= 25) score.badges.push('💎 Premium');
  if (score.historicalValue >= 20) score.badges.push('📈 High Value');
  if (length <= 5) score.badges.push('⚡ Short');
  
  // Reasoning
  if (score.total >= 80) score.reasoning = 'Exceptional domain';
  else if (score.total >= 60) score.reasoning = 'Strong domain';
  else if (score.total >= 40) score.reasoning = 'Decent domain';
  else if (score.total >= 20) score.reasoning = 'Average domain';
  else score.reasoning = 'Low quality domain';
  
  return score;
}

// ============================================================================
// WHOIS VALIDATION
// ============================================================================

function parseWhoisDate(value) {
  if (!value) return null;
  const parsed = new Date(Array.isArray(value) ? value[0] : value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getWhoisValue(result, keys) {
  for (const key of keys) {
    if (result?.[key]) return result[key];
  }
  return null;
}

function isWhoisClearlyRegistered(result) {
  const statusRaw = [
    result?.status,
    result?.domainStatus,
    result?.domain_status,
    result?.['Domain Status'],
  ].flat().filter(Boolean).join(' ').toLowerCase();

  if (/(^|\s)(ok|active|client|server|registered)(\s|$)/.test(statusRaw)) {
    console.log(`   ℹ️  WHOIS indicates active status: ${statusRaw}`);
    return true;
  }

  const creationDate = parseWhoisDate(getWhoisValue(result, ['creationDate', 'createdDate', 'created', 'Creation Date']));
  if (creationDate) {
    const daysSinceCreation = Math.floor((Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`   ℹ️  WHOIS creation age: ${daysSinceCreation} days`);
    if (daysSinceCreation <= 30) return true;
  }

  const registrar = getWhoisValue(result, ['registrar', 'Registrar Name', 'sponsoringRegistrar']);
  if (registrar && String(registrar).trim() !== '-') {
    console.log(`   ℹ️  WHOIS registrar present: ${registrar}`);
    return true;
  }

  return false;
}

async function isActuallyExpiring(domainName, context = null) {
  if (!ENABLE_WHOIS_CHECK) return true; // Skip if disabled

  if (context) {
    context.hadWhoisError = false;
  }

  const progressLabel = context
    ? `[${context.currentIndex}/${context.totalDomains}] `
    : '';

  const statusCheckOrder = DOMAIN_STATUS_SOURCE === 'whois'
    ? ['whois', 'namecheap']
    : ['namecheap', 'whois'];

  console.log(`   ℹ️  Status check priority: ${statusCheckOrder.join(' -> ')}`);

  if (statusCheckOrder[0] === 'namecheap') {
    const namecheapStatus = await getNamecheapStatus(domainName);

    if (namecheapStatus === 'available') {
      return true;
    }

    if (namecheapStatus === 'taken') {
      return false;
    }

    console.log('   ⚠️  Namecheap status unknown, falling back to WHOIS...');
  }
  
  try {
    console.log(`   🔍 ${progressLabel}Checking WHOIS for ${domainName}...`);
    const result = await queryWhoisWithRetry(domainName);

    if (!result || Object.keys(result).length === 0) {
      console.log('   ⚠️  WHOIS returned no data. Rejecting to avoid false positives.');
      return false;
    }

    if (isWhoisClearlyRegistered(result)) {
      console.log('   ⚠️  WHOIS indicates domain is currently registered.');
      return false;
    }

    const expiryDate = parseWhoisDate(getWhoisValue(result, [
      'expirationDate',
      'expiresDate',
      'registryExpiryDate',
      'Registry Expiry Date',
      'paid_till',
    ]));

    if (!expiryDate) {
      console.log(`   🧪 WHOIS fields available: ${Object.keys(result).slice(0, 25).join(', ')}`);
      console.log('   ⚠️  WHOIS has no parseable expiry date. Rejecting to avoid accepting taken domains.');
      return false;
    }

    const now = new Date();
    if (expiryDate > now) {
      console.log(`   ⚠️  Still registered until ${expiryDate.toLocaleDateString()}`);
      return false;
    }
    
    // Check drop window (60-80 days after expiry)
    const daysSinceExpiry = Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceExpiry < 60 || daysSinceExpiry > 80) {
      console.log(`   ⚠️  Outside drop window (${daysSinceExpiry} days since expiry)`);
      return false;
    }
    
    console.log(`   ✅ Confirmed expiring (${daysSinceExpiry} days since expiry)`);
    return true;
    
  } catch (error) {
    if (context) {
      context.hadWhoisError = true;
    }

    console.log(`   ⚠️  WHOIS check failed: ${error.message}`);

    if (statusCheckOrder[0] === 'whois') {
      console.log('   ⚠️  WHOIS failed, falling back to Namecheap...');
      const namecheapStatus = await getNamecheapStatus(domainName);
      return namecheapStatus === 'available';
    }

    const dnsStatus = await quickDomainCheck(domainName);
    console.log(`   ℹ️  DNS fallback status: ${dnsStatus}`);
    // Conservative strategy: do not accept domains when WHOIS fails.
    return false;
  }
}

// Quick DNS check (faster, less accurate)
async function quickDomainCheck(domainName) {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domainName}&type=A`);
    const data = await response.json();
    
    // If DNS records exist, domain is registered
    if (data.Answer && data.Answer.length > 0) {
      return 'registered';
    }
    
    return 'available';
  } catch (error) {
    return 'unknown';
  }
}

// ============================================================================
// MAIN INGESTION PIPELINE
// ============================================================================

async function scoreAndFilterDomains(domains) {
  const accepted = [];
  const rejected = {
    lowScore: 0,
    stillRegistered: 0,
  };
  
  console.log(`\n📊 Processing ${domains.length} domains...\n`);
  console.log(`🔧 Domain status source: ${DOMAIN_STATUS_SOURCE}`);
  
  let consecutiveWhoisFailures = 0;

  for (let index = 0; index < domains.length; index++) {
    const domain = domains[index];
    const currentIndex = index + 1;
    console.log(`\n🔍 Processing [${currentIndex}/${domains.length}]: ${domain.domainName}`);
    
    // Step 1: Score the domain
    const score = calculateDomainScore(domain.domainName);
    
    if (score.total < MIN_SCORE) {
      console.log(`   ❌ Score: ${score.total}/100 - REJECTED (${score.reasoning})`);
      rejected.lowScore++;
      continue;
    }
    
    console.log(`   ✅ Score: ${score.total}/100 - ${score.reasoning}`);
    
    // Step 2: WHOIS validation
    const whoisContext = {
      currentIndex,
      totalDomains: domains.length,
      hadWhoisError: false,
    };
    const isExpiring = await isActuallyExpiring(domain.domainName, whoisContext);
    
    if (!isExpiring) {
      console.log(`   ❌ WHOIS validation failed - Still registered`);
      rejected.stillRegistered++;
      if (whoisContext.hadWhoisError) {
        consecutiveWhoisFailures++;
      } else {
        consecutiveWhoisFailures = 0;
      }

      if (ENABLE_WHOIS_CHECK && consecutiveWhoisFailures > 0 && consecutiveWhoisFailures % WHOIS_FAILURE_COOLDOWN_AFTER === 0) {
        console.log(`   ⏳ Cooling down WHOIS checks for ${WHOIS_FAILURE_COOLDOWN_MS}ms after ${consecutiveWhoisFailures} consecutive failures...`);
        await sleep(WHOIS_FAILURE_COOLDOWN_MS);
      }

      continue;
    }

    consecutiveWhoisFailures = 0;
    
    // ACCEPTED!
    const badge = score.badges[0] || '📋';
    console.log(`   ✅ ACCEPTED ${badge}`);
    
    accepted.push({
      ...domain,
      score,
    });
    
    // Rate limit: Wait 2 seconds between WHOIS checks
    if (ENABLE_WHOIS_CHECK) {
      await sleep(WHOIS_REQUEST_DELAY_MS);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 FILTERING RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Accepted:           ${accepted.length}`);
  console.log(`❌ Low Score:          ${rejected.lowScore}`);
  console.log(`❌ Still Registered:   ${rejected.stillRegistered}`);
  console.log(`📊 Pass Rate:          ${(accepted.length / domains.length * 100).toFixed(0)}%`);
  console.log('='.repeat(80) + '\n');
  
  // Sort by score
  return accepted.sort((a, b) => b.score.total - a.score.total);
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function upsertDomain(domain) {
  const dropDate = new Date(domain.expiryDate);
  dropDate.setDate(dropDate.getDate() + 75);
  
  const daysUntilDrop = Math.ceil(
    (dropDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  // Auto-categorize
  const name = domain.domainName.toLowerCase();
  let category = 'general';
  if (name.includes('ai') || name.includes('quantum')) category = 'ai';
  else if (name.includes('climate') || name.includes('carbon')) category = 'climate';
  else if (name.includes('bio') || name.includes('health')) category = 'health';
  else if (name.includes('crypto') || name.includes('defi')) category = 'crypto';
  else if (name.includes('shop') || name.includes('market')) category = 'ecommerce';
  
  const slug = domain.domainName.replace(/\./g, '-');
  
  const { error } = await supabase
    .from('domains')
    .upsert({
      domain_name: domain.domainName,
      tld: domain.domainName.split('.')[1],
      expiry_date: domain.expiryDate,
      drop_date: dropDate.toISOString().split('T')[0],
      days_until_drop: daysUntilDrop,
      popularity_score: domain.score.total,
      category,
      registrar: domain.registrar,
      status: daysUntilDrop >= 0 ? 'pending_delete' : 'dropped',
      slug,
      title: `${domain.domainName} - Premium Domain Dropping in ${daysUntilDrop} Days`,
      last_updated: new Date().toISOString(),
      metadata: {
        nameQuality: domain.score.nameQuality,
        trendingWords: domain.score.trendingWords,
        historicalValue: domain.score.historicalValue,
        technicalMetrics: domain.score.technicalMetrics,
        badges: domain.score.badges,
        reasoning: domain.score.reasoning,
      },
    }, {
      onConflict: 'domain_name',
    });
  
  if (error) {
    console.error(`❌ Failed to upsert ${domain.domainName}:`, error.message);
  } else {
    console.log(`✅ Saved: ${domain.domainName}`);
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 DOMAIN INGESTION - Advanced Scoring + WHOIS Validation');
  console.log('='.repeat(80));
  console.log(`⚙️  Min Score:        ${MIN_SCORE}/100`);
  console.log(`⚙️  WHOIS Check:      ${ENABLE_WHOIS_CHECK ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`⚙️  WHOIS Delay:      ${WHOIS_REQUEST_DELAY_MS}ms`);
  console.log(`⚙️  WHOIS Retries:    ${WHOIS_RETRY_ATTEMPTS}`);
  console.log(`⚙️  NameBio API:      ${NAMEBIO_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
  console.log('='.repeat(80) + '\n');
  
  try {
    const domains = await fetchDropCatchDomains();

    if (domains.length === 0) {
      console.log('⚠️  No domains fetched from DropCatch.');
      return;
    }

    // Step 1: Score and filter
    const qualityDomains = await scoreAndFilterDomains(domains);
    
    if (qualityDomains.length === 0) {
      console.log('⚠️  No domains passed validation!');
      return;
    }
    
    // Step 2: Save to database
    console.log('💾 Saving to database...\n');
    
    for (const domain of qualityDomains) {
      await upsertDomain(domain);
    }
    
    console.log('\n✅ Ingestion complete!\n');
    
    // Step 3: Summary
    console.log('📊 Quality Distribution:');
    const premium = qualityDomains.filter(d => d.score.total >= 75).length;
    const good = qualityDomains.filter(d => d.score.total >= 50 && d.score.total < 75).length;
    const average = qualityDomains.filter(d => d.score.total >= 30 && d.score.total < 50).length;
    
    console.log(`   💎 Premium (75+):  ${premium}`);
    console.log(`   ✨ Good (50-74):   ${good}`);
    console.log(`   📋 Average (30-49): ${average}\n`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
