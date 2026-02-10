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
    godaddy: '$25',
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
    // Use Impact.com template (recommended - better tracking)
    // Template should be: https://namecheap.pxf.io/c/XXXXX/XXXXX/5618?u={url}
    return impactTemplate.replace('{url}', encodeURIComponent(searchUrl));
  }
  
  // Fallback to direct affiliate link
  const affId = process.env.NEXT_PUBLIC_NAMECHEAP_AFF_ID || 'PzjyBN';
  return `${searchUrl}&aff=${affId}`;
}

/**
 * Get DropCatch affiliate URL
 * Use this instead of SnapNames!
 */
export function getDropCatchAffiliateUrl(domainName: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_DROPCATCH_AFF_ID || '';
  
  // DropCatch domain backorder page
  return `https://www.dropcatch.com/domain/${encodeURIComponent(domainName)}${affiliateId ? `?aff=${affiliateId}` : ''}`;
}

/**
 * Get GoDaddy affiliate URL
 */
export function getGoDaddyAffiliateUrl(domainName: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_GODADDY_AFF_ID || '';
  
  // GoDaddy domain search
  return `https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${encodeURIComponent(domainName)}${affiliateId ? `&tmskey=${affiliateId}` : ''}`;
}

/**
 * Get DynaDot affiliate URL
 */
export function getDynaDotAffiliateUrl(domainName: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_DYNADOT_AFF_ID || '';
  
  // DynaDot domain search
  return `https://www.dynadot.com/domain/search.html?domain=${encodeURIComponent(domainName)}${affiliateId ? `&aff_id=${affiliateId}` : ''}`;
}

/**
 * Legacy SnapNames support (keep for backward compatibility)
 */
export function getSnapNamesAffiliateUrl(domainName: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_SNAPNAMES_AFF_ID || '';
  return `https://www.snapnames.com/search?query=${encodeURIComponent(domainName)}${affiliateId ? `&aff=${affiliateId}` : ''}`;
}
