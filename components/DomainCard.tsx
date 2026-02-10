// In your DomainCard.tsx, update the handleAffiliateClick function:

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

// Then update the button:

<button
  onClick={(event) => {
    event.stopPropagation();
    handleAffiliateClick('dropcatch'); // Changed from 'snapnames'
  }}
  disabled={isTracking}
  className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
>
  Backorder on DropCatch {/* Changed button text */}
</button>
