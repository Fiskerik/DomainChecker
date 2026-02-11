'use client';

import { useState } from 'react';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import { getAllAffiliateOptions, AffiliateOption } from '@/lib/domain-utils';

interface PriceComparisonProps {
  domainName: string;
  domainId: number;
}

export function PriceComparison({ domainName, domainId }: PriceComparisonProps) {
  const [tracking, setTracking] = useState<string | null>(null);
  const options = getAllAffiliateOptions(domainName);

  const backorderOptions = options.filter(o => o.type === 'backorder');
  const registerOptions = options.filter(o => o.type === 'register');

  const handleClick = async (optionName: string, url: string) => {
    setTracking(optionName);
    
    try {
      await fetch('/api/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: domainId,
          affiliate_type: optionName.toLowerCase(),
        }),
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    } finally {
      setTracking(null);
    }

    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-4">💰 Backorder Services (Recommended)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Backorder services use automated bots to register domains the instant they become available. 
          This is the most reliable way to acquire expiring domains.
        </p>

        <div className="grid gap-3">
          {backorderOptions.map((option) => (
            <button
              key={option.name}
              onClick={() => handleClick(option.name, option.url)}
              disabled={tracking === option.name}
              className="w-full border-2 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-lg">{option.name}</h4>
                    {option.name === 'DropCatch' && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Best Value
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-2xl font-bold text-blue-600">{option.price}</span>
                    {option.commission && (
                      <span className="text-xs text-gray-500">
                        Our commission: {option.commission}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="text-gray-400" size={20} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">🎲 Manual Registration (Not Recommended)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Try to register manually when domain drops. Success rate: ~1% due to automated competition.
        </p>

        <div className="grid gap-3">
          {registerOptions.map((option) => (
            <button
              key={option.name}
              onClick={() => handleClick(option.name, option.url)}
              disabled={tracking === option.name}
              className="w-full border rounded-xl p-4 hover:border-gray-400 hover:bg-gray-50 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-bold">{option.name}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-lg font-semibold text-gray-700">{option.price}</span>
                    {option.commission && (
                      <span className="text-xs text-gray-500">
                        Our commission: {option.commission}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="text-gray-400" size={20} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">💡 Pro Tip</p>
            <p>
              For valuable domains, use a backorder service. They have automated systems that register 
              domains within milliseconds of availability. Manual registration rarely succeeds for 
              popular domains.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PriceComparison;
