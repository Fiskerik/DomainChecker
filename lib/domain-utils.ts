export interface DomainLike {
  domain_name: string;
  tld: string;
  popularity_score: number;
}

export function getEstimatedValue(domain: DomainLike): string {
  const baseByTld: Record<string, { min: number; max: number }> = {
    com: { min: 500, max: 2000 },
    io: { min: 200, max: 1000 },
    ai: { min: 300, max: 1500 },
    org: { min: 150, max: 800 },
    net: { min: 120, max: 700 },
  };

  const fallback = { min: 100, max: 500 };
  const tldRange = baseByTld[domain.tld] ?? fallback;
  const nameWithoutTld = domain.domain_name.replace(`.${domain.tld}`, '');
  const length = nameWithoutTld.length;
  const hasKeyword = /(shop|tech|ai|cloud|app|data|pay|crypto|dev)/i.test(nameWithoutTld);

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

export function getDomainRoot(domainName: string): string {
  const parts = domainName.split('.');
  return (parts.length > 1 ? parts.slice(0, -1).join('.') : domainName).toLowerCase();
}

export function getBackorderPrice(provider: 'snapnames' | 'dropcatch'): string {
  return provider === 'snapnames' ? '$69' : '$59';
}
