'use client';

import { useState } from 'react';
import { ExternalLink, TrendingUp, Calendar, BarChart3 } from 'lucide-react';

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
}

export function DomainCard({ domain }: DomainCardProps) {
  const [isTracking, setIsTracking] = useState(false);

  const handleAffiliateClick = async (type: 'namecheap' | 'snapnames') => {
    // Track the click
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

    // Build affiliate URL
    const affiliateUrls = {
      namecheap: `https://www.namecheap.com/domains/registration/results/?domain=${domain.domain_name}&aff=${process.env.NEXT_PUBLIC_NAMECHEAP_AFF_ID || ''}`,
      snapnames: `https://www.snapnames.com/search?query=${domain.domain_name}&aff=${process.env.NEXT_PUBLIC_SNAPNAMES_AFF_ID || ''}`,
    };

    // Open in new tab
    window.open(affiliateUrls[type], '_blank');
  };

  // Track view when card is clicked
  const handleCardClick = async () => {
    try {
      await fetch('/api/track/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain_id: domain.id }),
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  // Urgency color
  const urgencyColor = 
    domain.days_until_drop <= 5 ? 'bg-red-500' :
    domain.days_until_drop <= 10 ? 'bg-yellow-500' :
    'bg-green-500';

  const urgencyText = 
    domain.days_until_drop <= 5 ? 'text-red-700 bg-red-50' :
    domain.days_until_drop <= 10 ? 'text-yellow-700 bg-yellow-50' :
    'text-green-700 bg-green-50';

  return (
    <div 
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header with domain name */}
      <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <h3 className="text-xl font-bold text-gray-900 mb-2 break-all">
          {domain.domain_name}
        </h3>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            .{domain.tld}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {domain.category}
          </span>
          {domain.popularity_score >= 70 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              🔥 Hot
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-5">
        {/* Drop countdown */}
        <div className={`mb-4 p-3 rounded-lg ${urgencyText}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} />
              <span className="font-semibold">Drops in {domain.days_until_drop} days</span>
            </div>
            <span className={`${urgencyColor} w-3 h-3 rounded-full animate-pulse`}></span>
          </div>
          <p className="text-xs mt-1">
            {new Date(domain.drop_date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </p>
        </div>

        {/* Popularity Score */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600 flex items-center gap-1">
              <TrendingUp size={16} />
              Popularity
            </span>
            <span className="text-sm font-semibold">{domain.popularity_score}/100</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
              style={{ width: `${domain.popularity_score}%` }}
            />
          </div>
        </div>

        {/* Analytics */}
        {(domain.view_count > 0 || domain.click_count_total > 0) && (
          <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <BarChart3 size={14} />
              {domain.view_count} views
            </span>
            {domain.click_count_total > 0 && (
              <span>
                {domain.click_count_total} clicks
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAffiliateClick('snapnames');
            }}
            disabled={isTracking}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            🎯 Backorder on SnapNames
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAffiliateClick('namecheap');
            }}
            disabled={isTracking}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg border-2 border-gray-300 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ExternalLink size={18} />
            Check on Namecheap
          </button>
        </div>

        {/* Registrar info */}
        {domain.registrar && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Currently at {domain.registrar}
          </p>
        )}
      </div>
    </div>
  );
}
