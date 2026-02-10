/**
 * Domain utility functions
 * Helper functions for domain cards and pages
 */

/**
 * Get the domain root (everything before the TLD)
 * Example: "techstart.io" -> "techstart"
 */
export function getDomainRoot(domainName: string): string {
  return domainName.split('.')[0];
}

/**
 * Get Namecheap affiliate URL with domain pre-filled
 * This is the CORRECT format that will show the domain on Namecheap
 */
export function getNamecheapAffiliateUrl(domainName: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_NAMECHEAP_AFF_ID || 'PzjyBN';
  
  // IMPORTANT: This URL format shows the domain search results on Namecheap
  // The user will see if the domain is available or in auction
  return `https://www.namecheap.com/domains/registration/results/?domain=${domainName}&aff=${affiliateId}`;
}

/**
 * Get SnapNames affiliate URL
 */
export function getSnapNamesAffiliateUrl(domainName: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_SNAPNAMES_AFF_ID || '';
  return `https://www.snapnames.com/search?query=${domainName}&aff=${affiliateId}`;
}

/**
 * Get GoDaddy affiliate URL
 */
export function getGoDaddyAffiliateUrl(domainName: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_GODADDY_AFF_ID || '';
  
  // GoDaddy domain search with affiliate tracking
  return `https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${domainName}&tmskey=${affiliateId}`;
}

/**
 * Calculate estimated domain value based on characteristics
 */
export function getEstimatedValue(domain: { tld: string; domain_name: string; popularity_score: number }): string {
  const name = domain.domain_name.split('.')[0];
  const length = name.length;
  
  // Base value by TLD
  let minValue = 100;
  let maxValue = 500;
  
  switch (domain.tld.toLowerCase()) {
    case 'com':
      minValue = 500;
      maxValue = 2000;
      break;
    case 'io':
      minValue = 200;
      maxValue = 1000;
      break;
    case 'ai':
      minValue = 300;
      maxValue = 1500;
      break;
    case 'app':
      minValue = 150;
      maxValue = 800;
      break;
    case 'dev':
      minValue = 150;
      maxValue = 700;
      break;
    case 'co':
      minValue = 200;
      maxValue = 900;
      break;
  }
  
  // Adjust for length (shorter = more valuable)
  if (length <= 5) {
    minValue *= 3;
    maxValue *= 3;
  } else if (length <= 8) {
    minValue *= 1.5;
    maxValue *= 1.5;
  }
  
  // Adjust for popularity score
  if (domain.popularity_score >= 80) {
    minValue *= 2;
    maxValue *= 2;
  } else if (domain.popularity_score >= 70) {
    minValue *= 1.5;
    maxValue *= 1.5;
  }
  
  // Format as range
  return `$${Math.round(minValue).toLocaleString()}-$${Math.round(maxValue).toLocaleString()}`;
}

/**
 * Get backorder prices for different services
 */
export function getBackorderPrice(service: 'snapnames' | 'dropcatch' | 'godaddy'): string {
  const prices = {
    snapnames: '$69',
    dropcatch: '$59',
    godaddy: '$24.99',
  };
  
  return prices[service];
}

/**
 * Calculate urgency level based on days until drop
 */
export function getUrgencyLevel(daysUntilDrop: number): 'high' | 'medium' | 'low' {
  if (daysUntilDrop <= 5) return 'high';
  if (daysUntilDrop <= 10) return 'medium';
  return 'low';
}

/**
 * Get urgency color classes
 */
export function getUrgencyColorClasses(daysUntilDrop: number): string {
  const level = getUrgencyLevel(daysUntilDrop);
  
  const classes = {
    high: 'text-red-700 bg-red-50 border-red-100',
    medium: 'text-amber-700 bg-amber-50 border-amber-100',
    low: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  };
  
  return classes[level];
}

/**
 * Format drop date for display
 */
export function formatDropDate(dropDate: string): string {
  return new Date(dropDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Check if domain is expiring soon (within 7 days)
 */
export function isExpiringSoon(daysUntilDrop: number): boolean {
  return daysUntilDrop <= 7;
}

/**
 * Check if domain is high value (score >= 70)
 */
export function isHighValue(popularityScore: number): boolean {
  return popularityScore >= 70;
}
