'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { 
  getEstimatedValue, 
  getDomainRoot,
  getNamecheapAffiliateUrl,
  getGoDaddyAffiliateUrl,
  getDynaDotAffiliateUrl
} from '@/lib/domain-utils';

interface Domain {
  id: number;
  domain_name: string;
  tld: string;
  drop_date: string;
  days_until_drop: number;
  popularity_score: number;
  category: string;
  registrar?: string;
  view_count: number;
  click_count_total: number;
}

interface DomainCardProps {
  domain: Domain;
  viewMode: 'card' | 'list';
}

export function DomainCard({ domain, viewMode }: DomainCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const handleAffiliateClick = async (type: 'namecheap' | 'godaddy' | 'dynadot', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsTracking(true);
    try {
      await fetch('/api/track/click', {
        // - Notering: Denna endpoint bör finnas i din backend för att logga klick
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: domain.id,
          affiliate_type: type,
        }),
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    } finally {
      setIsTracking(false);
    }

    const affiliateUrls = {
      namecheap: getNamecheapAffiliateUrl(domain.domain_name),
      godaddy: getGoDaddyAffiliateUrl(domain.domain_name),
      dynadot: getDynaDotAffiliateUrl(domain.domain_name),
    };

    window.open(affiliateUrls[type], '_blank');
  };

  const urgencyColor =
    domain.days_until_drop <= 5 ? 'text-red-600' :
    domain.days_until_drop <= 10 ? 'text-amber-600' :
    'text-emerald-600';

  const domainSlug = `${getDomainRoot(domain.domain_name)}-${domain.tld}`;

  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 hover:border-blue-400 rounded-lg transition-all">
        <div className="flex items-center gap-3 p-3 sm:p-4">
          <Link 
            href={`/domain/${domainSlug}`}
            className="flex-1 min-w-0"
          >
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate hover:text-blue-600">
              {domain.domain_name}
            </h3>
          </Link>

          <div className="hidden sm:flex items-center gap-4 text-xs text-gray-600">
            <span className={`font-medium ${urgencyColor} w-8 text-right`}>
              {domain.days_until_drop}d
            </span>
            <span className="font-semibold w-8 text-right">{domain.popularity_score}</span>
            <span className="capitalize text-gray-500 w-20">{domain.category}</span>
            <span className="font-semibold text-green-600 w-24 text-right">{getEstimatedValue(domain)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 p-3 sm:p-4 space-y-3 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={(e) => handleAffiliateClick('godaddy', e)}
                disabled={isTracking}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50"
              >
                GoDaddy $24.99
              </button>
              <button
                onClick={(e) => handleAffiliateClick('dynadot', e)}
                disabled={isTracking}
                className="flex-1 bg-gray-800 hover:bg-black text-white text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50"
              >
                DynaDot $9.99
              </button>
              <button
                onClick={(e) => handleAffiliateClick('namecheap', e)}
                disabled={isTracking}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50"
              >
                Namecheap
              </button>
              <Link
                href={`/domain/${domainSlug}`}
                className="flex-1 sm:flex-none border border-blue-500 text-blue-600 hover:bg-blue-50 text-sm font-medium py-2 px-3 rounded transition-colors text-center"
              >
                Details
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 hover:border-blue-400 hover:shadow-md rounded-lg transition-all overflow-hidden">
      <div className="p-3 sm:p-4">
        <Link href={`/domain/${domainSlug}`}>
          <h3 className="font-semibold text-sm sm:text-base text-gray-900 hover:text-blue-600 mb-2 break-all">
            {domain.domain_name}
          </h3>
        </Link>

        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-2 text-xs">
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">.{domain.tld}</span>
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded capitalize">{domain.category}</span>
          </div>
          <span className={`text-xs font-semibold ${urgencyColor}`}>
            {domain.days_until_drop}d
          </span>
        </div>

        <div className="mb-3 text-xs">
          <span className="text-gray-600">Est: </span>
          <span className="font-semibold text-green-600">{getEstimatedValue(domain)}</span>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600">Score</span>
            <span className="font-semibold">{domain.popularity_score}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
              style={{ width: `${domain.popularity_score}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 py-1"
        >
          {expanded ? (
            <>Less <ChevronUp size={14} /></>
          ) : (
            <>More <ChevronDown size={14} /></>
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-3 sm:p-4 space-y-2 bg-gray-50">
          <button
            onClick={(e) => handleAffiliateClick('godaddy', e)}
            disabled={isTracking}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50"
          >
            GoDaddy $24.99
          </button>
          <button
            onClick={(e) => handleAffiliateClick('dynadot', e)}
            disabled={isTracking}
            className="w-full bg-gray-800 hover:bg-black text-white text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50"
          >
            DynaDot $9.99
          </button>
          <button
            onClick={(e) => handleAffiliateClick('namecheap', e)}
            disabled={isTracking}
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50"
          >
            Namecheap
          </button>
          <Link
            href={`/domain/${domainSlug}`}
            className="block w-full border border-blue-500 text-blue-600 hover:bg-blue-50 text-sm font-medium py-2 px-3 rounded transition-colors text-center"
          >
            View Details
          </Link>
        </div>
      )}
    </div>
  );
}

export default DomainCard;
