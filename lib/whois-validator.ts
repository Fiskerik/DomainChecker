/**
 * WHOIS Validator
 * Checks if domains are actually expiring or already registered
 * 
 * Install: npm install whois-json
 */

// For Node.js environment (ingestion scripts)
export async function isActuallyExpiring(domainName: string): Promise<boolean> {
  try {
    // Dynamic import for Node.js environment only
    const whois = (await import('whois-json')).default;
    
    const result = await whois(domainName);
    
    // Check if domain is registered
    if (!result || !result.expirationDate) {
      // No expiration date = likely available or error
      return false;
    }
    
    const expiryDate = new Date(result.expirationDate);
    const now = new Date();
    
    // Domain should have already expired for it to be "dropping"
    // Typically domains drop 75 days after expiry
    if (expiryDate > now) {
      console.log(`${domainName} still registered until ${expiryDate.toLocaleDateString()}`);
      return false;
    }
    
    // Check if it's in the 60-75 day window after expiry (pending delete period)
    const daysSinceExpiry = Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceExpiry < 60 || daysSinceExpiry > 80) {
      console.log(`${domainName} outside drop window (${daysSinceExpiry} days since expiry)`);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error(`WHOIS check failed for ${domainName}:`, error);
    // On error, assume it might be expiring (don't filter out)
    return true;
  }
}

/**
 * Batch validate multiple domains
 * Filters out domains that are still registered
 */
export async function filterExpiring(domains: Array<{ domain_name: string }>): Promise<Array<{ domain_name: string }>> {
  const results = await Promise.all(
    domains.map(async (domain) => {
      const isExpiring = await isActuallyExpiring(domain.domain_name);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      return isExpiring ? domain : null;
    })
  );
  
  return results.filter(d => d !== null) as Array<{ domain_name: string }>;
}

/**
 * Quick check without full WHOIS (for API/frontend)
 * Just checks if domain resolves (indicates it's registered)
 */
export async function quickDomainCheck(domainName: string): Promise<'available' | 'registered' | 'unknown'> {
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
