'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface Domain {
  id: number;
  domain_name: string;
  tld: string;
  days_until_drop: number;
  popularity_score: number;
  category: string;
  slug: string;
}

interface RelatedDomainsProps {
  currentDomainId: number;
  category: string;
  tld: string;
}

export function RelatedDomains({ currentDomainId, category, tld }: RelatedDomainsProps) {
  const [relatedDomains, setRelatedDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRelatedDomains();
  }, [currentDomainId, category]);

  const fetchRelatedDomains = async () => {
    try {
      // Fetch domains in same category
      const response = await fetch(
        `/api/domains?category=${category}&limit=6&sort=popularity_score&order=desc`
      );
      const data = await response.json();

      // Filter out current domain
      const filtered = (data.domains || []).filter(
        (d: Domain) => d.id !== currentDomainId
      ).slice(0, 6);

      setRelatedDomains(filtered);
    } catch (error) {
      console.error('Error fetching related domains:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (relatedDomains.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="text-blue-600" size={24} />
        <h2 className="text-2xl font-bold">Related {category} Domains</h2>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatedDomains.map((domain) => (
          <Link
            key={domain.id}
            href={`/domain/${domain.slug}`}
            className="group border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors break-all">
                {domain.domain_name}
              </h3>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2">
                {domain.popularity_score}/100
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Drops in {domain.days_until_drop} days
              </span>
              <span className="text-blue-600 font-medium group-hover:underline">
                View →
              </span>
            </div>

            <div className="mt-2 flex gap-2">
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                .{domain.tld}
              </span>
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded capitalize">
                {domain.category}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default RelatedDomains;
