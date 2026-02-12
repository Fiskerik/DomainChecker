/**
 * Advanced Domain Scoring Engine
 * Filters out gibberish domains and ranks quality domains higher
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DomainScore {
  totalScore: number; // 0-100
  breakdown: {
    nameQuality: number; // 0-30 (pronounceability, brandability)
    trendingWords: number; // 0-25 (matches current trends)
    historicalValue: number; // 0-25 (similar domains sold for high prices)
    technicalMetrics: number; // 0-20 (length, SEO, character quality)
  };
  badges: string[]; // ["🔥 Trending", "💎 Premium", "📈 High Value"]
  reasoning: string;
}

export interface DomainMetrics {
  domain_name: string;
  tld: string;
  length: number;
  hasNumbers: boolean;
  hasHyphens: boolean;
  consonantClusters: number;
  vowelRatio: number;
  isPronnounceable: boolean;
  isBrandable: boolean;
}

// ============================================================================
// TRENDING WORDS DATABASE
// Updated monthly via cron job or manually
// ============================================================================

export const TRENDING_KEYWORDS_2025 = {
  // AI & Tech (very hot in 2025)
  ai: { score: 25, category: 'ai', trend: 'rising' },
  quantum: { score: 24, category: 'tech', trend: 'rising' },
  neural: { score: 23, category: 'ai', trend: 'stable' },
  llm: { score: 22, category: 'ai', trend: 'rising' },
  agent: { score: 21, category: 'ai', trend: 'rising' },
  autonomous: { score: 20, category: 'ai', trend: 'rising' },
  synthetic: { score: 19, category: 'ai', trend: 'stable' },
  
  // Crypto & Web3
  defi: { score: 22, category: 'crypto', trend: 'stable' },
  nft: { score: 18, category: 'crypto', trend: 'declining' },
  web3: { score: 21, category: 'crypto', trend: 'stable' },
  blockchain: { score: 19, category: 'crypto', trend: 'stable' },
  token: { score: 17, category: 'crypto', trend: 'stable' },
  
  // Climate & Sustainability
  climate: { score: 23, category: 'climate', trend: 'rising' },
  carbon: { score: 21, category: 'climate', trend: 'rising' },
  renewable: { score: 20, category: 'climate', trend: 'stable' },
  solar: { score: 19, category: 'climate', trend: 'stable' },
  sustainable: { score: 18, category: 'climate', trend: 'stable' },
  
  // Health & Wellness
  longevity: { score: 24, category: 'health', trend: 'rising' },
  biohack: { score: 22, category: 'health', trend: 'rising' },
  wellness: { score: 20, category: 'health', trend: 'stable' },
  mental: { score: 19, category: 'health', trend: 'rising' },
  therapy: { score: 18, category: 'health', trend: 'stable' },
  
  // E-commerce & Business
  shop: { score: 16, category: 'ecommerce', trend: 'stable' },
  marketplace: { score: 17, category: 'ecommerce', trend: 'stable' },
  direct: { score: 15, category: 'ecommerce', trend: 'stable' },
  
  // Generic valuable terms
  pro: { score: 18, category: 'generic', trend: 'stable' },
  hub: { score: 17, category: 'generic', trend: 'stable' },
  labs: { score: 19, category: 'generic', trend: 'stable' },
  studio: { score: 16, category: 'generic', trend: 'stable' },
  academy: { score: 15, category: 'generic', trend: 'stable' },
} as const;

// Common English words that make domains pronounceable/brandable
export const PRONOUNCEABLE_PATTERNS = [
  /^[a-z]{3,}$/i, // No numbers
  /^[bcdfghjklmnpqrstvwxyz]*[aeiou][bcdfghjklmnpqrstvwxyz]*[aeiou]/i, // Vowel pattern
];

// Gibberish detection patterns
export const GIBBERISH_PATTERNS = [
  /^[bcdfghjklmnpqrstvwxyz]{5,}/i, // 5+ consonants in a row
  /[xqz]{2,}/i, // Repeated rare letters
  /^[0-9]+[a-z]+$/i, // Numbers then letters (usually spam)
  /^[a-z]+[0-9]+$/i, // Letters then numbers (usually spam)
];

// ============================================================================
// HISTORICAL PRICING DATA
// This would ideally come from NameBio API
// ============================================================================

export interface HistoricalSale {
  domain: string;
  price: number;
  date: string;
  marketplace: string;
}

// Sample data - in production, fetch from NameBio API
export const HIGH_VALUE_PATTERNS = {
  // Short domains (3-5 chars)
  shortDomains: {
    '.com': { 3: 50000, 4: 10000, 5: 3000 },
    '.io': { 3: 15000, 4: 5000, 5: 1500 },
    '.ai': { 3: 25000, 4: 8000, 5: 2000 },
  },
  
  // Keyword combinations that sold well historically
  valuablePatterns: [
    { pattern: /ai$/i, avgPrice: 8000, category: 'ai-suffix' },
    { pattern: /^get[a-z]+/i, avgPrice: 5000, category: 'get-prefix' },
    { pattern: /labs$/i, avgPrice: 4500, category: 'labs-suffix' },
    { pattern: /hub$/i, avgPrice: 4000, category: 'hub-suffix' },
    { pattern: /pro$/i, avgPrice: 3500, category: 'pro-suffix' },
  ],
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate technical quality metrics
 */
export function calculateDomainMetrics(domainName: string): DomainMetrics {
  const nameWithoutTld = domainName.split('.')[0].toLowerCase();
  const length = nameWithoutTld.length;
  
  // Check for numbers and hyphens
  const hasNumbers = /\d/.test(nameWithoutTld);
  const hasHyphens = /-/.test(nameWithoutTld);
  
  // Count consonant clusters (bad for pronunciation)
  const consonantClusters = (nameWithoutTld.match(/[bcdfghjklmnpqrstvwxyz]{3,}/gi) || []).length;
  
  // Calculate vowel ratio
  const vowels = (nameWithoutTld.match(/[aeiou]/gi) || []).length;
  const vowelRatio = vowels / length;
  
  // Pronounceability check
  const isPronnounceable = 
    !hasNumbers &&
    !hasHyphens &&
    consonantClusters === 0 &&
    vowelRatio >= 0.25 &&
    vowelRatio <= 0.6;
  
  // Brandability (short, pronounceable, no weird chars)
  const isBrandable = 
    length >= 4 &&
    length <= 12 &&
    isPronnounceable &&
    !/[0-9\-_]/.test(nameWithoutTld);
  
  return {
    domain_name: domainName,
    tld: domainName.split('.')[1] || 'com',
    length,
    hasNumbers,
    hasHyphens,
    consonantClusters,
    vowelRatio,
    isPronnounceable,
    isBrandable,
  };
}

/**
 * Score based on name quality (pronounceability, brandability)
 * Max: 30 points
 */
export function scoreNameQuality(metrics: DomainMetrics): number {
  let score = 0;
  const name = metrics.domain_name.split('.')[0].toLowerCase();
  
  // Check if it's gibberish
  for (const pattern of GIBBERISH_PATTERNS) {
    if (pattern.test(name)) {
      return 0; // Instant reject
    }
  }
  
  // Length scoring (sweet spot: 5-8 chars)
  if (metrics.length <= 4) score += 10; // Ultra premium
  else if (metrics.length <= 8) score += 8;
  else if (metrics.length <= 12) score += 5;
  else score += 2;
  
  // Pronounceability
  if (metrics.isPronnounceable) score += 10;
  else if (metrics.consonantClusters === 0) score += 5;
  
  // Brandability
  if (metrics.isBrandable) score += 10;
  
  // Penalties
  if (metrics.hasNumbers) score -= 5;
  if (metrics.hasHyphens) score -= 5;
  if (metrics.consonantClusters > 0) score -= metrics.consonantClusters * 3;
  
  return Math.max(0, Math.min(30, score));
}

/**
 * Score based on trending words
 * Max: 25 points
 */
export function scoreTrendingWords(domainName: string): number {
  const name = domainName.split('.')[0].toLowerCase();
  let score = 0;
  const matches: string[] = [];
  
  // Check for exact keyword matches
  for (const [keyword, data] of Object.entries(TRENDING_KEYWORDS_2025)) {
    if (name.includes(keyword)) {
      score += data.score;
      matches.push(keyword);
    }
  }
  
  // Bonus for multiple trending words
  if (matches.length >= 2) {
    score += 5;
  }
  
  return Math.min(25, score);
}

/**
 * Score based on historical sales data
 * Max: 25 points
 */
export function scoreHistoricalValue(domainName: string, tld: string): number {
  const name = domainName.split('.')[0].toLowerCase();
  const length = name.length;
  let score = 0;
  
  // Short domain premium
  const shortDomainValues = HIGH_VALUE_PATTERNS.shortDomains[`.${tld}` as keyof typeof HIGH_VALUE_PATTERNS.shortDomains];
  if (shortDomainValues && length <= 5) {
    const value = shortDomainValues[length as keyof typeof shortDomainValues];
    if (value) {
      // Convert price to score (logarithmic scale)
      score += Math.min(15, Math.log10(value) * 3);
    }
  }
  
  // Pattern matching
  for (const { pattern, avgPrice } of HIGH_VALUE_PATTERNS.valuablePatterns) {
    if (pattern.test(name)) {
      score += Math.min(10, Math.log10(avgPrice) * 2.5);
      break; // Only count once
    }
  }
  
  return Math.min(25, Math.round(score));
}

/**
 * Score technical SEO & other metrics
 * Max: 20 points
 */
export function scoreTechnicalMetrics(domainName: string, tld: string): number {
  const name = domainName.split('.')[0].toLowerCase();
  let score = 0;
  
  // TLD premium
  const tldScores: Record<string, number> = {
    com: 10,
    io: 8,
    ai: 9,
    app: 7,
    dev: 7,
    co: 6,
    net: 5,
    org: 5,
  };
  score += tldScores[tld] || 3;
  
  // Dictionary word bonus (simple check)
  const commonWords = ['get', 'my', 'the', 'go', 'be', 'use', 'find', 'make', 'build', 'learn'];
  if (commonWords.some(word => name.startsWith(word) || name.endsWith(word))) {
    score += 5;
  }
  
  // No special characters
  if (!/[^a-z]/.test(name)) {
    score += 5;
  }
  
  return Math.min(20, score);
}

/**
 * Master scoring function
 */
export function calculateDomainScore(domainName: string): DomainScore {
  const metrics = calculateDomainMetrics(domainName);
  const tld = metrics.tld;
  
  // Calculate individual scores
  const nameQuality = scoreNameQuality(metrics);
  const trendingWords = scoreTrendingWords(domainName);
  const historicalValue = scoreHistoricalValue(domainName, tld);
  const technicalMetrics = scoreTechnicalMetrics(domainName, tld);
  
  const totalScore = nameQuality + trendingWords + historicalValue + technicalMetrics;
  
  // Generate badges
  const badges: string[] = [];
  if (trendingWords >= 20) badges.push('🔥 Trending');
  if (nameQuality >= 25) badges.push('💎 Premium');
  if (historicalValue >= 20) badges.push('📈 High Value');
  if (metrics.length <= 5) badges.push('⚡ Short');
  if (metrics.isBrandable) badges.push('🎯 Brandable');
  
  // Generate reasoning
  let reasoning = '';
  if (totalScore >= 80) {
    reasoning = 'Exceptional domain with high marketability';
  } else if (totalScore >= 60) {
    reasoning = 'Strong domain with good potential';
  } else if (totalScore >= 40) {
    reasoning = 'Decent domain worth considering';
  } else if (totalScore >= 20) {
    reasoning = 'Average domain with limited appeal';
  } else {
    reasoning = 'Low quality - likely gibberish or poor brandability';
  }
  
  return {
    totalScore: Math.round(totalScore),
    breakdown: {
      nameQuality: Math.round(nameQuality),
      trendingWords: Math.round(trendingWords),
      historicalValue: Math.round(historicalValue),
      technicalMetrics: Math.round(technicalMetrics),
    },
    badges,
    reasoning,
  };
}

// ============================================================================
// INTEGRATION WITH NAMEBIO API (OPTIONAL)
// ============================================================================

/**
 * Fetch similar domain sales from NameBio
 * Requires API key: https://namebio.com/api
 */
export async function fetchHistoricalSales(
  domainName: string,
  apiKey?: string
): Promise<HistoricalSale[]> {
  if (!apiKey) {
    console.warn('NameBio API key not provided, using estimated values');
    return [];
  }
  
  try {
    const name = domainName.split('.')[0];
    const response = await fetch(
      `https://namebio.com/api/json.php?key=${apiKey}&search=${encodeURIComponent(name)}&mode=domain`
    );
    
    const data = await response.json();
    
    return data.results.map((result: any) => ({
      domain: result.domain,
      price: parseInt(result.price),
      date: result.date,
      marketplace: result.marketplace,
    }));
  } catch (error) {
    console.error('Error fetching NameBio data:', error);
    return [];
  }
}

/**
 * Enhanced scoring with real historical data
 */
export async function calculateEnhancedScore(
  domainName: string,
  nameBioApiKey?: string
): Promise<DomainScore> {
  const baseScore = calculateDomainScore(domainName);
  
  // Fetch historical sales
  const sales = await fetchHistoricalSales(domainName, nameBioApiKey);
  
  if (sales.length > 0) {
    // Calculate average sale price of similar domains
    const avgPrice = sales.reduce((sum, sale) => sum + sale.price, 0) / sales.length;
    
    // Boost historical value score based on real data
    const realDataBoost = Math.min(10, Math.log10(avgPrice) * 2);
    baseScore.breakdown.historicalValue = Math.min(
      25,
      baseScore.breakdown.historicalValue + realDataBoost
    );
    
    baseScore.totalScore = Object.values(baseScore.breakdown).reduce((a, b) => a + b, 0);
    
    if (avgPrice > 10000) {
      baseScore.badges.push('💰 High Historical Value');
    }
  }
  
  return baseScore;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Filter out gibberish domains
 */
export function isGibberish(domainName: string): boolean {
  const score = calculateDomainScore(domainName);
  return score.totalScore < 15 || score.breakdown.nameQuality === 0;
}

/**
 * Get quality tier
 */
export function getQualityTier(score: number): 'premium' | 'good' | 'average' | 'poor' {
  if (score >= 75) return 'premium';
  if (score >= 50) return 'good';
  if (score >= 25) return 'average';
  return 'poor';
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Score multiple domains at once
 */
export function scoreBatch(domains: string[]): Map<string, DomainScore> {
  const results = new Map<string, DomainScore>();
  
  for (const domain of domains) {
    results.set(domain, calculateDomainScore(domain));
  }
  
  return results;
}

/**
 * Filter and sort domains by score
 */
export function filterAndSort(
  domains: string[],
  minScore: number = 30
): Array<{ domain: string; score: DomainScore }> {
  return domains
    .map(domain => ({
      domain,
      score: calculateDomainScore(domain),
    }))
    .filter(item => item.score.totalScore >= minScore)
    .sort((a, b) => b.score.totalScore - a.score.totalScore);
}