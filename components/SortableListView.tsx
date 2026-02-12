'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { 
  getEstimatedValue, 
  getDomainRoot,
  getNamecheapAffiliateUrl,
  getDropCatchAffiliateUrl 
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

interface SortableListViewProps {
  domains: Domain[];
  onSort: (field: string) => void;
  sortField: string;
  sortOrder: 'asc' | 'desc';
}

export function SortableListView({ domains, onSort, sortField, sortOrder }: SortableListViewProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const handleAffiliateClick = async (domain: Domain, type: 'namecheap' | 'dropcatch', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsTracking(true);
    try {
      await fetch('/api/track/click', {
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
      dropcatch: getDropCatchAffiliateUrl(domain.domain_name),
    };

    window.open(affiliateUrls[type], '_blank');
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUp className="text-gray-300" size={14} />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="text-blue-600" size={14} /> : 
      <ArrowDown className="text-blue-600" size={14} />;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header Row - Desktop only */}
      <div className="hidden sm:grid sm:grid-cols-12 gap-3 p-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">
        <button
          onClick={() => onSort('domain_name')}
          className="col-span-4 flex items-center gap-1 hover:text-blue-600 transition-colors"
        >
          Domain <SortIcon field="domain_name" />
        </button>
        <button
          onClick={() => onSort('days_until_drop')}
          className="col-span-1 flex items-center gap-1 hover:text-blue-600 transition-colors"
        >
          Days <SortIcon field="days_until_drop" />
        </button>
        <button
          onClick={() => onSort('popularity_score')}
          className="col-span-1 flex items-center gap-1 hover:text-blue-600 transition-colors"
        >
          Score <SortIcon field="popularity_score" />
        </button>
        <button
          onClick={() => onSort('category')}
          className="col-span-2 flex items-center gap-1 hover:text-blue-600 transition-colors"
        >
          Category <SortIcon field="category" />
        </button>
        <div className="col-span-2 flex items-center gap-1">
          Est. Value
        </div>
        <div className="col-span-2 text-center">Actions</div>
      </div>

      {/* Domain Rows */}
      <div className="divide-y divide-gray-100">
        {domains.map((domain) => {
          const urgencyColor =
            domain.days_until_drop <= 5 ? 'text-red-600 font-semibold' :
            domain.days_until_drop <= 10 ? 'text-amber-600 font-semibold' :
            'text-emerald-600';
          
          const domainSlug = `${getDomainRoot(domain.domain_name)}-${domain.tld}`;
          const isExpanded = expandedId === domain.id;

          return (
            <div key={domain.id} className="hover:bg-gray-50 transition-colors">
              {/* Main Row */}
              <div className="grid grid-cols-12 gap-3 p-3 items-center text-xs sm:text-sm">
                {/* Domain Name - Mobile: Full width, Desktop: 4 cols */}
                <Link 
                  href={`/domain/${domainSlug}`}
                  className="col-span-12 sm:col-span-4 font-semibold text-gray-900 hover:text-blue-600 truncate"
                >
                  {domain.domain_name}
                </Link>

                {/* Stats - Mobile: Show in row, Desktop: Individual columns */}
                <div className="col-span-12 sm:col-span-1 flex sm:block">
                  <span className="sm:hidden text-gray-600 mr-2">Days:</span>
                  <span className={urgencyColor}>{domain.days_until_drop}d</span>
                </div>

                <div className="col-span-12 sm:col-span-1 flex sm:block">
                  <span className="sm:hidden text-gray-600 mr-2">Score:</span>
                  <span className="font-semibold">{domain.popularity_score}</span>
                </div>

                <div className="col-span-12 sm:col-span-2 flex sm:block">
                  <span className="sm:hidden text-gray-600 mr-2">Category:</span>
                  <span className="capitalize text-gray-700">{domain.category}</span>
                </div>

                <div className="col-span-12 sm:col-span-2 flex sm:block">
                  <span className="sm:hidden text-gray-600 mr-2">Est. Value:</span>
                  <span className="font-semibold text-green-600">{getEstimatedValue(domain)}</span>
                </div>

                {/* Actions */}
                <div className="col-span-12 sm:col-span-2 flex gap-2">
                  <button
                    onClick={(e) => handleAffiliateClick(domain, 'dropcatch', e)}
                    disabled={isTracking}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 px-2 rounded transition-colors disabled:opacity-50"
                  >
                    $59
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : domain.id)}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded Section */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={(e) => handleAffiliateClick(domain, 'dropcatch', e)}
                      disabled={isTracking}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50"
                    >
                      Backorder on DropCatch ($59)
                    </button>
                    <button
                      onClick={(e) => handleAffiliateClick(domain, 'namecheap', e)}
                      disabled={isTracking}
                      className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50"
                    >
                      Check on Namecheap
                    </button>
                    <Link
                      href={`/domain/${domainSlug}`}
                      className="flex-1 sm:flex-none border border-blue-500 text-blue-600 hover:bg-blue-50 text-sm font-medium py-2 px-3 rounded transition-colors text-center"
                    >
                      Full Details
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SortableListView;
