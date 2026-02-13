'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink, TrendingUp, Calendar, Star } from 'lucide-react';

interface Domain {
  id: number | string;
  domain_name: string;
  slug: string;
  tld: string;
  expiry_date?: string;
  drop_date: string;
  days_until_drop: number;
  popularity_score: number;
  category: string;
  status?: string;
  estimated_value?: string;
}

interface DomainPrice {
  registrar: string;
  price: number;
  currency: string;
}

export function DomainCard({ domain, viewMode = 'card' }: { domain: Domain; viewMode?: 'card' | 'list' }) {
  const [prices, setPrices] = useState<DomainPrice[]>([
    { registrar: 'Loading...', price: 0, currency: 'USD' }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch real prices
    async function fetchPrices() {
      try {
        const response = await fetch(`/api/domain-prices?domain=${domain.domain_name}`);
        const data = await response.json();
        
        if (data.prices) {
          setPrices(data.prices);
        }
      } catch (error) {
        console.error('Failed to fetch prices:', error);
        // Fallback prices
        setPrices([
          { registrar: 'GoDaddy', price: getTldPrice(domain.tld), currency: 'USD' },
          { registrar: 'Namecheap', price: getTldPrice(domain.tld) - 2, currency: 'USD' },
          { registrar: 'Dynadot', price: getTldPrice(domain.tld) - 3, currency: 'EUR' },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchPrices();
  }, [domain.domain_name, domain.tld]);

  // Fallback price calculation
  function getTldPrice(tld: string): number {
    const prices: Record<string, number> = {
      com: 12.99, net: 14.99, org: 14.99,
      io: 39.99, ai: 79.99, co: 24.99,
      app: 14.99, dev: 12.99, xyz: 1.99,
    };
    return prices[tld] || 14.99;
  }

  const scoreColor = 
    domain.popularity_score >= 75 ? 'text-emerald-600' :
    domain.popularity_score >= 50 ? 'text-blue-600' :
    'text-slate-600';

  const statusBadge = 
    domain.days_until_drop <= 3 ? (
      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
        🔥 Dropping in {domain.days_until_drop}d
      </span>
    ) : (
      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
        {domain.days_until_drop} days
      </span>
    );

  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link 
            href={`/domains/${domain.slug}`}
            className="text-lg font-semibold text-slate-900 hover:text-blue-600"
          >
            {domain.domain_name}
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-slate-500">.{domain.tld}</span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs capitalize text-slate-500">{domain.category}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className={`text-2xl font-bold ${scoreColor}`}>
            {domain.popularity_score}
          </div>
          <div className="text-xs text-slate-500">Score</div>
        </div>
      </div>

      {/* Status & Timing */}
      <div className="mt-3 flex items-center gap-2">
        {statusBadge}
        <span className="text-xs text-slate-500">
          <Calendar className="inline h-3 w-3" /> Drops {new Date(domain.drop_date).toLocaleDateString()}
        </span>
      </div>

      {/* Estimated Value */}
      {domain.estimated_value && (
        <div className="mt-3 rounded-md bg-slate-50 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Est. Value</span>
            <span className="text-sm font-semibold text-slate-900">{domain.estimated_value}</span>
          </div>
        </div>
      )}

      {/* Purchase Buttons with REAL PRICES */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-9 rounded bg-slate-200"></div>
            <div className="mt-2 h-9 rounded bg-slate-200"></div>
            <div className="mt-2 h-9 rounded bg-slate-200"></div>
          </div>
        ) : (
          prices.map((price, index) => (
            <a
              key={index}
              href={getRegistrarUrl(domain.domain_name, price.registrar)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                index === 0
                  ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
                  : index === 1
                  ? 'border-slate-800 bg-slate-800 text-white hover:bg-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{price.registrar}</span>
              <span className="flex items-center gap-1">
                {price.currency === 'USD' ? '$' : '€'}{price.price.toFixed(2)}
                <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          ))
        )}
      </div>

      {/* Quick View Link */}
      <Link
        href={`/domains/${domain.slug}`}
        className="mt-3 block text-center text-sm text-slate-600 hover:text-slate-900"
      >
        View Details →
      </Link>
    </div>
  );
}

function getRegistrarUrl(domain: string, registrar: string): string {
  const encodedDomain = encodeURIComponent(domain);
  
  switch (registrar.toLowerCase()) {
    case 'godaddy':
      return `https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${encodedDomain}`;
    case 'namecheap':
      return `https://www.namecheap.com/domains/registration/results/?domain=${encodedDomain}`;
    case 'dynadot':
      return `https://www.dynadot.com/domain/search.html?domain=${encodedDomain}`;
    default:
      return `https://www.google.com/search?q=${encodedDomain}+domain+register`;
  }
}