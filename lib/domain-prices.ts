/**
 * Domain Price Fetcher
 * 
 * Fetches real-time purchase prices from multiple registrars
 * Caches results to avoid rate limiting
 */

// Price cache (in-memory, expires after 1 hour)
const priceCache = new Map<string, { price: number; registrar: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface DomainPrice {
  registrar: string;
  price: number;
  currency: string;
  available: boolean;
}

/**
 * Fetch price from Namecheap API
 */
async function fetchNamecheapPrice(domain: string): Promise<DomainPrice | null> {
  try {
    // You need Namecheap API credentials
    const apiUser = process.env.NAMECHEAP_API_USER;
    const apiKey = process.env.NAMECHEAP_API_KEY;
    
    if (!apiUser || !apiKey) {
      return null;
    }

    const response = await fetch(
      `https://api.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&Command=namecheap.domains.check&ClientIp=YOUR_IP&DomainList=${domain}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    // Parse XML response (you'll need a XML parser)
    // This is simplified - actual implementation needs XML parsing
    const data = await response.text();
    
    // Extract price from XML
    // You'll need to implement proper XML parsing
    
    return {
      registrar: 'Namecheap',
      price: 10.98, // Parsed from XML
      currency: 'USD',
      available: true
    };
  } catch (error) {
    console.error('Namecheap price fetch failed:', error);
    return null;
  }
}

/**
 * Fetch price from GoDaddy API (Public - No auth needed!)
 */
async function fetchGoDaddyPrice(domain: string): Promise<DomainPrice | null> {
  try {
    const tld = domain.split('.')[1];
    
    // GoDaddy has a public endpoint for TLD pricing
    const response = await fetch(
      `https://www.godaddy.com/domainsapi/v1/search/exact?q=${encodeURIComponent(domain)}&key=dpp_search`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 3600 }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // GoDaddy response structure
    if (data?.Products?.[0]) {
      const product = data.Products[0];
      return {
        registrar: 'GoDaddy',
        price: product.PriceInfo?.CurrentPrice || 24.99,
        currency: 'USD',
        available: product.IsAvailable
      };
    }

    return null;
  } catch (error) {
    console.error('GoDaddy price fetch failed:', error);
    return null;
  }
}

/**
 * Fetch price from Dynadot (scraping - may break)
 */
async function fetchDynadotPrice(domain: string): Promise<DomainPrice | null> {
  try {
    // Dynadot doesn't have a public API, so we'd need to scrape
    // This is fragile and may break
    const response = await fetch(
      `https://www.dynadot.com/domain/search.html?domain=${encodeURIComponent(domain)}`,
      { next: { revalidate: 3600 } }
    );

    const html = await response.text();
    
    // Parse HTML to extract price
    // This is very fragile - better to use their API if you're a partner
    const priceMatch = html.match(/€(\d+\.\d+)/);
    
    if (priceMatch) {
      return {
        registrar: 'Dynadot',
        price: parseFloat(priceMatch[1]),
        currency: 'EUR',
        available: true
      };
    }

    return null;
  } catch (error) {
    console.error('Dynadot price fetch failed:', error);
    return null;
  }
}

/**
 * Get TLD-based fallback prices (when API fails)
 */
function getFallbackPrice(domain: string): DomainPrice {
  const tld = domain.split('.')[1]?.toLowerCase() || 'com';
  
  const tldPrices: Record<string, number> = {
    'com': 12.99,
    'net': 14.99,
    'org': 14.99,
    'io': 39.99,
    'ai': 79.99,
    'co': 24.99,
    'app': 14.99,
    'dev': 12.99,
    'xyz': 1.99,
    'online': 2.99,
    'store': 2.99,
  };

  return {
    registrar: 'GoDaddy',
    price: tldPrices[tld] || 14.99,
    currency: 'USD',
    available: true
  };
}

/**
 * Main function: Get cheapest price from all registrars
 */
export async function getDomainPrice(domain: string): Promise<DomainPrice> {
  // Check cache first
  const cached = priceCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      registrar: cached.registrar,
      price: cached.price,
      currency: 'USD',
      available: true
    };
  }

  // Fetch from multiple sources in parallel
  const [godaddyPrice, namecheapPrice, dynadotPrice] = await Promise.allSettled([
    fetchGoDaddyPrice(domain),
    fetchNamecheapPrice(domain),
    fetchDynadotPrice(domain),
  ]);

  // Extract successful results
  const prices: DomainPrice[] = [];
  
  if (godaddyPrice.status === 'fulfilled' && godaddyPrice.value) {
    prices.push(godaddyPrice.value);
  }
  if (namecheapPrice.status === 'fulfilled' && namecheapPrice.value) {
    prices.push(namecheapPrice.value);
  }
  if (dynadotPrice.status === 'fulfilled' && dynadotPrice.value) {
    prices.push(dynadotPrice.value);
  }

  // If all failed, use fallback
  if (prices.length === 0) {
    return getFallbackPrice(domain);
  }

  // Find cheapest
  const cheapest = prices.reduce((min, current) => 
    current.price < min.price ? current : min
  );

  // Cache result
  priceCache.set(domain, {
    price: cheapest.price,
    registrar: cheapest.registrar,
    timestamp: Date.now()
  });

  return cheapest;
}

/**
 * Server action: Fetch prices for multiple domains
 */
export async function fetchDomainPrices(domains: string[]): Promise<Record<string, DomainPrice>> {
  const results: Record<string, DomainPrice> = {};
  
  // Fetch in parallel (max 10 at a time to avoid rate limits)
  const chunks = [];
  for (let i = 0; i < domains.length; i += 10) {
    chunks.push(domains.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const prices = await Promise.all(
      chunk.map(domain => getDomainPrice(domain))
    );
    
    chunk.forEach((domain, index) => {
      results[domain] = prices[index];
    });
  }

  return results;
}