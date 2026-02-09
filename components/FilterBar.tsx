'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4 mb-8 justify-center">
      <select 
        onChange={(e) => updateFilter('tld', e.target.value)}
        className="bg-white border rounded-full px-6 py-2 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Alla TLDs</option>
        <option value="com">.com</option>
        <option value="io">.io</option>
        <option value="ai">.ai</option>
        <option value="app">.app</option>
      </select>

      <select 
        onChange={(e) => updateFilter('status', e.target.value)}
        className="bg-white border rounded-full px-6 py-2 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Alla Statusar</option>
        <option value="pending_delete">Pending Delete (Snart fria!)</option>
        <option value="redemption_period">Redemption Period</option>
        <option value="grace_period">Grace Period</option>
      </select>
    </div>
  );
}
