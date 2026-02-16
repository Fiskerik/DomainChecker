/**
 * IMPROVED Domain Scoring Engine v2.0 (TypeScript)
 * 
 * More intelligent scoring that rewards:
 * - Real dictionary words
 * - Geographic names (cities, countries)
 * - Brand names and concepts
 * - Pronounceable, meaningful domains
 * - Professional/business terms
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ScoreBreakdown {
  nameQuality: number;
  meaningfulness: number;
  trendingBonus: number;
  technicalQuality: number;
}

export interface DomainScore {
  totalScore: number;
  breakdown: ScoreBreakdown;
  badges: string[];
  reasoning: string;
}

// ============================================================================
// DICTIONARIES & WORD LISTS
// ============================================================================

// High-value dictionary words (common, brandable, memorable)
const PREMIUM_WORDS: readonly string[] = [
  // Business & Professional
  'pro', 'expert', 'master', 'elite', 'prime', 'best', 'top', 'smart', 'quick', 'fast',
  'easy', 'simple', 'super', 'mega', 'ultra', 'power', 'plus', 'max', 'hub', 'center',
  'zone', 'spot', 'place', 'space', 'world', 'global', 'cloud', 'digital', 'online',
  'web', 'net', 'tech', 'data', 'info', 'media', 'news', 'post', 'blog', 'site',
  
  // Actions (verbs that make sense for domains)
  'get', 'find', 'buy', 'sell', 'make', 'build', 'create', 'design', 'learn', 'teach',
  'share', 'connect', 'link', 'join', 'meet', 'chat', 'talk', 'send', 'pay', 'shop',
  'book', 'plan', 'manage', 'track', 'view', 'watch', 'play', 'stream', 'download',
  
  // Valuable industry terms
  'seo', 'marketing', 'analytics', 'insights', 'metrics', 'stats', 'reports', 'tools',
  'software', 'platform', 'system', 'solution', 'service', 'network', 'portal',
  'dashboard', 'console', 'admin', 'studio', 'labs', 'works', 'group', 'team',
  
  // Emotional/aspirational
  'love', 'care', 'happy', 'joy', 'dream', 'hope', 'trust', 'true', 'real', 'pure',
  'fresh', 'new', 'next', 'future', 'smart', 'wise', 'bright', 'clear', 'cool'
] as const;

// Current trends (2025) - but don't over-weight these
const TRENDING_KEYWORDS: Readonly<Record<string, number>> = {
  // AI & Tech (moderate bonus, not excessive)
  'ai': 10, 'agent': 8, 'gpt': 8, 'llm': 8, 'ml': 6, 'quantum': 8,
  'automation': 6, 'automate': 6, 'neural': 6,
  
  // Other trends
  'climate': 8, 'carbon': 6, 'solar': 6, 'green': 6, 'eco': 6,
  'crypto': 6, 'blockchain': 6, 'web3': 6, 'defi': 6, 'nft': 4,
  'wellness': 6, 'mental': 6, 'therapy': 6, 'coach': 6
} as const;

// Major world cities (high value for geo-targeting)
const MAJOR_CITIES: readonly string[] = [
  'london', 'paris', 'tokyo', 'sydney', 'newyork', 'losangeles', 'chicago', 'miami',
  'berlin', 'madrid', 'rome', 'milan', 'barcelona', 'amsterdam', 'dublin', 'edinburgh',
  'singapore', 'hongkong', 'dubai', 'bangkok', 'mumbai', 'delhi', 'beijing', 'shanghai',
  'toronto', 'vancouver', 'montreal', 'seattle', 'boston', 'austin', 'denver', 'portland',
  'stockholm', 'copenhagen', 'oslo', 'helsinki', 'zurich', 'geneva', 'vienna', 'prague'
] as const;

// Countries (high value)
const COUNTRIES: readonly string[] = [
  'usa', 'uk', 'canada', 'australia', 'germany', 'france', 'spain', 'italy', 'japan',
  'china', 'india', 'brazil', 'mexico', 'russia', 'korea', 'sweden', 'norway', 'denmark',
  'netherlands', 'belgium', 'switzerland', 'austria', 'poland', 'ireland', 'singapore',
  'thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines'
] as const;

// Known brands/concepts (don't include trademarked terms, but generic concepts)
const VALUABLE_CONCEPTS: readonly string[] = [
  'knowledge', 'wisdom', 'science', 'research', 'study', 'guide', 'academy', 'university',
  'school', 'college', 'course', 'training', 'workshop', 'seminar', 'conference',
  'market', 'marketplace', 'store', 'shop', 'mall', 'boutique', 'outlet', 'deals',
  'travel', 'hotel', 'booking', 'flight', 'vacation', 'tour', 'trip', 'journey',
  'health', 'fitness', 'nutrition', 'diet', 'exercise', 'workout', 'yoga', 'medical',
  'finance', 'money', 'invest', 'trading', 'stock', 'fund', 'bank', 'credit', 'loan',
  'insurance', 'property', 'real', 'estate', 'home', 'house', 'apartment', 'rent'
] as const;

const PREFERRED_TLDS: Readonly<Record<string, number>> = {
  'com': 15,
  'io': 10,
  'ai': 10,
  'co': 8,
  'net': 7,
  'org': 7,
  'app': 8,
  'dev': 8
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if string contains a dictionary word
 */
function containsWord(name: string, wordList: readonly string[]): boolean {
  return wordList.some((word: string) => {
    if (name === word) return true;
    if (name.startsWith(word) || name.endsWith(word)) return true;
    return false;
  });
}

/**
 * Check if domain is pronounceable (has good vowel/consonant distribution)
 */
function isPronounceableWord(name: string): boolean {
  // Must have at least one vowel
  if (!/[aeiou]/i.test(name)) return false;
  
  // Calculate vowel ratio
  const vowels = (name.match(/[aeiou]/gi) || []).length;
  const ratio = vowels / name.length;
  
  // Good ratio is between 25% and 60%
  if (ratio < 0.25 || ratio > 0.6) return false;
  
  // No more than 3 consonants in a row
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(name)) return false;
  
  // No more than 3 same letters in a row
  if (/(.)\1{3,}/.test(name)) return false;
  
  return true;
}

/**
 * Check if domain contains meaningful parts
 */
function hasMeaningfulParts(name: string): boolean {
  // Split on common separators (even if not present, this helps)
  const parts = name.split(/[-_]/).filter((p: string) => p.length > 0);
  
  // Check each part
  for (const part of parts) {
    if (part.length >= 3) {
      // Check if it's a known word
      if (containsWord(part, PREMIUM_WORDS)) return true;
      if (containsWord(part, MAJOR_CITIES)) return true;
      if (containsWord(part, COUNTRIES)) return true;
      if (containsWord(part, VALUABLE_CONCEPTS)) return true;
    }
  }
  
  return false;
}

// ============================================================================
// SCORING ALGORITHM
// ============================================================================

/**
 * Calculate comprehensive domain score (0-100)
 */
export function calculateDomainScore(domainName: string): DomainScore {
  const [name, tld] = domainName.toLowerCase().split('.');
  if (!name) {
    return {
      totalScore: 0,
      breakdown: {
        nameQuality: 0,
        meaningfulness: 0,
        trendingBonus: 0,
        technicalQuality: 0
      },
      badges: [],
      reasoning: 'Invalid domain name'
    };
  }
  
  const breakdown: ScoreBreakdown = {
    nameQuality: 0,
    meaningfulness: 0,
    trendingBonus: 0,
    technicalQuality: 0
  };
  
  // ========================================================================
  // 1. NAME QUALITY (0-35 points) - Base quality
  // ========================================================================
  
  // Length scoring (sweet spots)
  if (name.length >= 3 && name.length <= 6) {
    breakdown.nameQuality += 20; // Ultra premium short domains
  } else if (name.length >= 7 && name.length <= 10) {
    breakdown.nameQuality += 15; // Excellent length
  } else if (name.length >= 11 && name.length <= 15) {
    breakdown.nameQuality += 10; // Good length
  } else if (name.length >= 16 && name.length <= 20) {
    breakdown.nameQuality += 5; // Acceptable
  } else {
    breakdown.nameQuality -= 10; // Too short or too long
  }
  
  // Pronounceability bonus
  if (isPronounceableWord(name)) {
    breakdown.nameQuality += 15;
  } else {
    breakdown.nameQuality += 5; // Small bonus for trying
  }
  
  // Clean characters (no numbers, hyphens)
  if (!/[0-9]/.test(name)) {
    breakdown.nameQuality += 5;
  } else {
    breakdown.nameQuality -= 10; // Penalty for numbers
  }
  
  if (!/-/.test(name)) {
    breakdown.nameQuality += 5;
  } else {
    breakdown.nameQuality -= 5; // Small penalty for hyphens
  }
  
  // Cap at 35
  breakdown.nameQuality = Math.max(0, Math.min(35, breakdown.nameQuality));
  
  // ========================================================================
  // 2. MEANINGFULNESS (0-35 points) - Real words, concepts, places
  // ========================================================================
  
  // Premium dictionary words
  if (containsWord(name, PREMIUM_WORDS)) {
    breakdown.meaningfulness += 15;
  }
  
  // Geographic names (cities, countries)
  if (containsWord(name, MAJOR_CITIES)) {
    breakdown.meaningfulness += 12;
  }
  if (containsWord(name, COUNTRIES)) {
    breakdown.meaningfulness += 10;
  }
  
  // Valuable concepts
  if (containsWord(name, VALUABLE_CONCEPTS)) {
    breakdown.meaningfulness += 10;
  }
  
  // Has meaningful parts (even if combined)
  if (hasMeaningfulParts(name)) {
    breakdown.meaningfulness += 8;
  }
  
  // Brandability bonus (short + pronounceable + no numbers)
  if (name.length >= 5 && name.length <= 10 && 
      isPronounceableWord(name) && !/[0-9-]/.test(name)) {
    breakdown.meaningfulness += 10;
  }
  
  // Cap at 35
  breakdown.meaningfulness = Math.max(0, Math.min(35, breakdown.meaningfulness));
  
  // ========================================================================
  // 3. TRENDING BONUS (0-15 points) - Current market trends
  // ========================================================================
  
  // Check for trending keywords (moderate bonus)
  for (const [keyword, points] of Object.entries(TRENDING_KEYWORDS)) {
    if (name.includes(keyword)) {
      // Only count the keyword if it's a full word, not partial
      // "thai" should NOT trigger "ai"
      const regex = new RegExp(`\\b${keyword}\\b|^${keyword}|${keyword}$`);
      if (regex.test(name)) {
        breakdown.trendingBonus += points;
      }
    }
  }
  
  // Cap at 15 (don't over-weight trends)
  breakdown.trendingBonus = Math.min(15, breakdown.trendingBonus);
  
  // ========================================================================
  // 4. TECHNICAL QUALITY (0-15 points) - TLD, SEO, etc.
  // ========================================================================
  
  // TLD quality
  breakdown.technicalQuality += PREFERRED_TLDS[tld] || 3;
  
  // Cap at 15
  breakdown.technicalQuality = Math.min(15, breakdown.technicalQuality);
  
  // ========================================================================
  // CALCULATE TOTAL
  // ========================================================================
  
  const totalScore = Math.round(
    breakdown.nameQuality + 
    breakdown.meaningfulness + 
    breakdown.trendingBonus + 
    breakdown.technicalQuality
  );
  
  // Generate badges
  const badges: string[] = [];
  if (totalScore >= 85) badges.push('💎 Premium');
  if (totalScore >= 75) badges.push('⭐ Excellent');
  if (totalScore >= 65) badges.push('✨ Very Good');
  if (name.length <= 6) badges.push('⚡ Short');
  if (containsWord(name, MAJOR_CITIES) || containsWord(name, COUNTRIES)) {
    badges.push('🌍 Geographic');
  }
  if (breakdown.trendingBonus >= 8) badges.push('🔥 Trending');
  
  // Reasoning
  let reasoning = '';
  if (totalScore >= 80) reasoning = 'Exceptional domain with high commercial value';
  else if (totalScore >= 65) reasoning = 'Strong domain with good market potential';
  else if (totalScore >= 50) reasoning = 'Solid domain worth considering';
  else if (totalScore >= 35) reasoning = 'Average domain with limited appeal';
  else reasoning = 'Low quality - limited commercial value';
  
  return {
    totalScore: Math.min(100, Math.max(0, totalScore)),
    breakdown,
    badges,
    reasoning
  };
}

/**
 * Test the scoring on example domains
 */
export function testScoring(): void {
  const testDomains = [
    'knowmyseo.com',      // Should score high
    'london.com',         // Should score very high
    'getpaid.com',        // Should score high
    'smartai.com',        // Should score high
    'thai.com',           // Should NOT get AI bonus
    'xyzqpr.com',         // Should score low (gibberish)
    '12345.com',          // Should score low (numbers)
    'quick-tools.com',    // Should score decent
    'travelbooking.com',  // Should score high
  ];
  
  console.log('='.repeat(80));
  console.log('DOMAIN SCORING TESTS');
  console.log('='.repeat(80));
  
  for (const domain of testDomains) {
    const score = calculateDomainScore(domain);
    console.log(`\n${domain}`);
    console.log(`  Score: ${score.totalScore}/100`);
    console.log(`  Breakdown: Quality=${score.breakdown.nameQuality}, ` +
                `Meaning=${score.breakdown.meaningfulness}, ` +
                `Trending=${score.breakdown.trendingBonus}, ` +
                `Tech=${score.breakdown.technicalQuality}`);
    console.log(`  ${score.reasoning}`);
    if (score.badges.length > 0) {
      console.log(`  Badges: ${score.badges.join(' ')}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
}

// Export for use in ingestion scripts
export default calculateDomainScore;