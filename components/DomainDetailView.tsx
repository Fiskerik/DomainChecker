'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, TrendingUp, Clock, Share2, ExternalLink, AlertCircle } from 'lucide-react';
import { 
  getNamecheapAffiliateUrl, 
  getDropCatchAffiliateUrl, 
  getEstimatedValue,
  getBackorderPrice,
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
  created_at: string;
}

interface DomainDetailViewProps {
  domain: Domain;
  similarDomains: Domain[];
}

export function DomainDetailView({ domain, similarDomains }: DomainDetailViewProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const dropDate = new Date(domain.drop_date);
      const diff = dropDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Domain has dropped!');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

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
          title: `${domain.domain_name} - Expiring Soon`,
          text: `Check out this premium domain dropping in ${domain.days_until_drop} days!`,
          url,
        });
      } catch (error) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const urgencyColor =
    domain.days_until_drop <= 5 ? 'bg-red-50 border-red-200 text-red-900' :
    domain.days_until_drop <= 10 ? 'bg-amber-50 border-amber-200 text-amber-900' :
    'bg-emerald-50 border-emerald-200 text-emerald-900';

  const urgencyBadge =
    domain.days_until_drop <= 5 ? 'bg-red-500' :
    domain.days_until_drop <= 10 ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            ← Back to all domains
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Domain Name Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-4 break-all">{domain.domain_name}</h1>
                <div className="flex flex-wrap gap-3">
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                    .{domain.tld}
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                    {domain.category}
                  </span>
                  {domain.popularity_score >= 70 && (
                    <span className="bg-red-500 px-3 py-1 rounded-full text-sm font-semibold">
                      🔥 High Demand
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleShare}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-3 rounded-lg transition-colors"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>

          {/* Countdown Section */}
          <div className={`border-b px-8 py-6 ${urgencyColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${urgencyBadge} animate-pulse`}></div>
                  <h2 className="text-2xl font-bold">
                    {domain.days_until_drop <= 5 ? '🚨 Dropping Very Soon!' : 
                     domain.days_until_drop <= 10 ? '⚠️ Dropping Soon' : 
                     '📅 Drop Date Approaching'}
                  </h2>
                </div>
                <p className="text-lg font-mono font-semibold">{timeLeft}</p>
                <p className="text-sm mt-1">
                  Drops: {new Date(domain.drop_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <Clock size={48} className="opacity-50" />
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 py-8 border-b">
            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <TrendingUp size={18} />
                <span className="text-sm font-semibold">Popularity</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{domain.popularity_score}</span>
                <span className="text-gray-500">/100</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                  style={{ width: `${domain.popularity_score}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Calendar size={18} />
                <span className="text-sm font-semibold">Days Until Drop</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{domain.days_until_drop}</span>
                <span className="text-gray-500">days</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <ExternalLink size={18} />
                <span className="text-sm font-semibold">Interest</span>
              </div>
              <div className="text-sm space-y-1">
                <p>{domain.view_count} views</p>
                <p>{domain.click_count_total} clicks</p>
              </div>
            </div>
          </div>

          {/* Estimated Value */}
          <div className="px-8 py-6 bg-amber-50 border-b border-amber-200">
            <h3 className="text-lg font-bold text-amber-900 mb-2">💰 Estimated Value</h3>
            <p className="text-3xl font-bold text-amber-800">{getEstimatedValue(domain)}</p>
            <p className="text-sm text-amber-700 mt-2">
              Based on TLD, length, keywords, and market trends
            </p>
          </div>

          {/* How to Get This Domain */}
          <div className="px-8 py-8">
            <h2 className="text-2xl font-bold mb-6">How to Get This Domain</h2>

            <div className="space-y-4">
              {/* Option 1: Backorder */}
              <div className="border-2 border-blue-600 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-blue-900">🎯 Option 1: Backorder (Recommended)</h3>
                    <p className="text-gray-600 mt-1">
                      The safest way to secure this domain. Drop-catch services use automated bots that register domains in milliseconds.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <button
                    onClick={() => handleAffiliateClick('dropcatch')}
                    disabled={isTracking}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Backorder on DropCatch ({getBackorderPrice('dropcatch')})
                  </button>

                  <button
                    onClick={() => handleAffiliateClick('namecheap')}
                    disabled={isTracking}
                    className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Check on Namecheap
                  </button>
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>How it works:</strong> You pay a backorder fee. If no one else backorders, you get the domain for the fee. 
                    If multiple people backorder, it goes to a private auction.
                  </p>
                </div>
              </div>

              {/* Option 2: Manual Registration */}
              <div className="border rounded-xl p-6 bg-gray-50">
                <h3 className="text-xl font-bold mb-2">⚡ Option 2: Manual Registration</h3>
                <p className="text-gray-600">
                  Try to register it manually when it drops. <strong>Success rate: ~1%</strong> due to automated competition.
                </p>
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={20} className="text-amber-700 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      <strong>Not recommended:</strong> Professional drop-catch services have bots that register domains within milliseconds. 
                      Manual registration rarely succeeds for valuable domains.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Domain Details */}
          <div className="px-8 py-8 bg-gray-50 border-t">
            <h2 className="text-2xl font-bold mb-6">Domain Details</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Registration Info</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Current Registrar:</dt>
                    <dd className="font-medium">{domain.registrar || 'Unknown'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Expiry Date:</dt>
                    <dd className="font-medium">{new Date(domain.expiry_date).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Drop Date:</dt>
                    <dd className="font-medium">{new Date(domain.drop_date).toLocaleDateString()}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Classification</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Category:</dt>
                    <dd className="font-medium capitalize">{domain.category}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">TLD:</dt>
                    <dd className="font-medium">.{domain.tld}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Length:</dt>
                    <dd className="font-medium">{getDomainRoot(domain.domain_name).length} characters</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Similar Domains */}
          {similarDomains.length > 0 && (
            <div className="px-8 py-8 border-t">
              <h2 className="text-2xl font-bold mb-6">Similar Domains Also Expiring</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {similarDomains.map((similar) => (
                  <Link
                    key={similar.id}
                    href={`/domain/${similar.slug}`}
                    className="border rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg">{similar.domain_name}</h3>
                        <p className="text-sm text-gray-600">Drops in {similar.days_until_drop} days</p>
                      </div>
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {similar.popularity_score}/100
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Share Success Toast */}
        {copied && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
            ✅ Link copied to clipboard!
          </div>
        )}
      </div>
    </div>
  );
}
