/**
 * Domain utility functions
 */

export interface DomainLike {
  domain_name: string;
  tld: string;
  popularity_score: number;
}

/**
 * Get estimated domain value
 */
export function getEstimatedValue(domain: DomainLike): string {
  const baseByTld: Record<string, { min: number; max: number }> = {
    com: { min: 500, max: 2000 },
    io: { min: 200, max: 1000 },
    ai: { min: 300, max: 1500 },
    app: { min: 150, max: 800 },
    dev: { min: 150, max: 700 },
    co: { min: 200, max: 900 },
    org: { min: 150, max: 800 },
    net: { min: 120, max: 700 },
  };
  
  const fallback = { min: 100, max: 500 };
  const tldRange = baseByTld[domain.tld] ?? fallback;
  const nameWithoutTld = domain.domain_name.replace(`.${domain.tld}`, '');
  const length = nameWithoutTld.length;
  const hasKeyword = /(shop|tech|ai|cloud|app|data|pay|crypto|dev|game|health)/i.test(nameWithoutTld);
  
  const lengthMultiplier =
    length <= 5 ? 1.6 :
    length <= 8 ? 1.25 :
    length <= 12 ? 1 :
    0.75;
  
  const keywordMultiplier = hasKeyword ? 1.2 : 1;
  
  const min = Math.round(tldRange.min * lengthMultiplier * keywordMultiplier);
  const max = Math.round(tldRange.max * lengthMultiplier * keywordMultiplier);
  
  return `$${min.toLocaleString()}-$${max.toLocaleString()}`;
}

/**
 * Get domain root (name without TLD)
 */
export function getDomainRoot(domainName: string): string {
  const parts = domainName.split('.');
  return (parts.length > 1 ? parts.slice(0, -1).join('.') : domainName).toLowerCase();
}

/**
 * Get backorder prices
 */
export function getBackorderPrice(provider: 'dropcatch' | 'snapnames' | 'godaddy'): string {
  const prices = {
    dropcatch: '$59',
    snapnames: '$69',
    godaddy: '$24.99',
  };
  return prices[provider] || '$59';
}

/**
 * Get Namecheap affiliate URL with Impact.com support
 */
export function getNamecheapAffiliateUrl(domainName: string): string {
  const searchUrl = `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domainName)}`;
  const impactTemplate = process.env.NEXT_PUBLIC_NAMECHEAP_IMPACT_LINK_TEMPLATE;
  
  if (impactTemplate) {
    return impactTemplate.replace('{url}', encodeURIComponent(searchUrl));
  }
  
  const affId = process.env.NEXT_PUBLIC_NAMECHEAP_AFF_ID || 'PzjyBN';
  return `${searchUrl}&aff=${affId}`;
}

/**
 * Get DropCatch affiliate URL
 */
export function getDropCatchAffiliateUrl(domainName: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_DROPCATCH_AFF_ID || '';
  const baseUrl = `https://www.dropcatch.com/domain/${encodeURIComponent(domainName)}`;
  return affiliateId ? `${baseUrl}?aff=${affiliateId}` : baseUrl;
}

/**
 * Get DynaDot affiliate URL
 * Uses all-in-one tracking link with domain parameter
 */
export function getDynaDotAffiliateUrl(domainName: string): string {
  return `https://www.dynadot.com/?rsc=domainchecker&rsctrn=domainchecker&rscreg=domainchecker&rsceh=domainchecker&rscsb=domainchecker&rscco=domainchecker&rscbo=domainchecker&domain=${encodeURIComponent(domainName)}`;
}

/**
 * Get GoDaddy affiliate URL via CJ
 * IMPORTANT: Goes directly to GoDaddy with domain pre-searched and CJ tracking
 */
export function getGoDaddyAffiliateUrl(domainName: string): string {
  // Your CJ details
  const publisherId = '7870539';
  const advertiserName = 'EA Consulting';
  const aid = '15060776';
  const campaignId = 'xx-xx_corp_affiliate_15060776_001';
  
  // Build GoDaddy search URL with domain already filled in
  const baseUrl = 'https://www.godaddy.com/domainsearch/find';
  
  // All parameters for GoDaddy + CJ tracking
  const params = new URLSearchParams({
    checkAvail: '1',
    domainToCheck: domainName,
    isc: 'cjcdbs',
    utm_source: 'cj',
    utm_medium: 'affiliate',
    utm_campaign: campaignId,
    utm_content: `${advertiserName}_${publisherId}`,
    AID: aid,
    PID: publisherId,
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Get all affiliate options for price comparison
 */
export interface AffiliateOption {
  name: string;
  price: string;
  url: string;
  type: 'backorder' | 'register';
  commission?: string;
}

export function getAllAffiliateOptions(domainName: string): AffiliateOption[] {
  return [
    {
      name: 'GoDaddy',
      price: '$24.99',
      url: getGoDaddyAffiliateUrl(domainName),
      type: 'backorder',
      commission: '~$5-25',
    },
    {
      name: 'Namecheap',
      price: '$10-15',
      url: getNamecheapAffiliateUrl(domainName),
      type: 'register',
      commission: '$2-5',
    },
    {
      name: 'DynaDot',
      price: '$9.99',
      url: getDynaDotAffiliateUrl(domainName),
      type: 'register',
      commission: '$1-3',
    },
    {
      name: 'DropCatch',
      price: '$59',
      url: getDropCatchAffiliateUrl(domainName),
      type: 'backorder',
      commission: '~$9 (15%)',
    }
  ];
}

/**
 * Get urgency level
 */
export function getUrgencyLevel(daysUntilDrop: number): 'high' | 'medium' | 'low' {
  if (daysUntilDrop <= 5) return 'high';
  if (daysUntilDrop <= 10) return 'medium';
  return 'low';
}

/**
 * Get similar domains by category
 */
export function getSimilarDomainKeywords(category: string): string[] {
  const keywords: Record<string, string[]> = {
    tech: ['app', 'dev', 'tech', 'code', 'cloud', 'data', 'api', 'software', 'digital', 'web'],
    finance: ['pay', 'coin', 'crypto', 'bank', 'invest', 'fund', 'trade', 'finance', 'money', 'cash'],
    ecommerce: ['shop', 'store', 'buy', 'market', 'sell', 'deal', 'cart', 'retail', 'merch', 'goods'],
    health: ['health', 'fit', 'med', 'care', 'wellness', 'bio', 'pharma', 'clinic', 'therapy', 'vita'],
    gaming: ['game', 'play', 'esport', 'stream', 'gaming', 'player', 'battle', 'quest', 'arena', 'guild'],
    education: ['learn', 'edu', 'course', 'teach', 'school', 'study', 'tutor', 'academy', 'class', 'training'],
  };
  
  return keywords[category] || [];
}
