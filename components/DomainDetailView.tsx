'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, TrendingUp, Share2, ArrowLeft, ExternalLink } from 'lucide-react';
import { 
  getNamecheapAffiliateUrl, 
  getDropCatchAffiliateUrl, 
  getEstimatedValue,
  getDomainRoot
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
  expiry_date: string;
  view_count: number;
  click_count_total: number;
}

interface CleanDomainDetailViewProps {
  domain: Domain;
  similarDomains: Domain[];
}

export function CleanDomainDetailView({ domain, similarDomains }: CleanDomainDetailViewProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isTracking, setIsTracking] = useState(false);

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const dropDate = new Date(domain.drop_date);
      const diff = dropDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Dropped');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeLeft(`${days}d ${hours}h`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [domain.drop_date]);

  const handleAffiliateClick = async (type: 'namecheap' | 'dropcatch') => {
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

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: domain.domain_name,
          text: `Check out ${domain.domain_name} - dropping in ${domain.days_until_drop} days!`,
          url,
        });
      } catch (error) {}
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const urgencyColor =
    domain.days_until_drop <= 5 ? 'bg-red-500' :
    domain.days_until_drop <= 10 ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700">
            <ArrowLeft size={16} className="mr-1" />
            Back
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Main Card */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 break-all">
                {domain.domain_name}
              </h1>
              <button
                onClick={handleShare}
                className="p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
              >
                <Share2 size={20} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
              <span className="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 rounded">.{domain.tld}</span>
              <span className="bg-blue-50 text-blue-700 px-2 sm:px-3 py-1 rounded capitalize">{domain.category}</span>
              {domain.popularity_score >= 70 && (
                <span className="bg-red-50 text-red-700 px-2 sm:px-3 py-1 rounded">🔥 Hot</span>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 border-b border-gray-100">
            <div className="p-3 sm:p-6 text-center border-r border-gray-100">
              <div className={`w-3 h-3 ${urgencyColor} rounded-full mx-auto mb-2`}></div>
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{timeLeft}</div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Until Drop</div>
            </div>

            <div className="p-3 sm:p-6 text-center border-r border-gray-100">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{domain.popularity_score}</div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Score</div>
            </div>

            <div className="p-3 sm:p-6 text-center">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{getEstimatedValue(domain)}</div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Est. Value</div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 sm:p-6 space-y-3">
            <button
              onClick={() => handleAffiliateClick('dropcatch')}
              disabled={isTracking}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 sm:py-4 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              🎯 Backorder on DropCatch ($59)
            </button>

            <button
              onClick={() => handleAffiliateClick('namecheap')}
              disabled={isTracking}
              className="w-full border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 sm:py-4 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              Check on Namecheap
            </button>
          </div>

          {/* Details */}
          <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100">
            <h2 className="text-base sm:text-lg font-bold mb-3">Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:text-sm">
              <div>
                <dt className="text-gray-600">Registrar</dt>
                <dd className="font-medium mt-1">{domain.registrar || 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Expires</dt>
                <dd className="font-medium mt-1">{new Date(domain.expiry_date).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Drops</dt>
                <dd className="font-medium mt-1">{new Date(domain.drop_date).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Interest</dt>
                <dd className="font-medium mt-1">{domain.view_count} views</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Similar Domains */}
        {similarDomains.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Similar Domains</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {similarDomains.slice(0, 4).map((similar) => (
                <Link
                  key={similar.id}
                  href={`/domain/${similar.slug}`}
                  className="bg-white border border-gray-200 hover:border-blue-400 rounded-lg p-3 sm:p-4 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-900 group-hover:text-blue-600 truncate">
                        {similar.domain_name}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        Drops in {similar.days_until_drop} days
                      </p>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-blue-600 ml-2">
                      {similar.popularity_score}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DomainDetailView;
