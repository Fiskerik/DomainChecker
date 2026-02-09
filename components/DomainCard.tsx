'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';

export default function DomainCard({ domain, isInitiallyFavorited = false }: { domain: any, isInitiallyFavorited?: boolean }) {
  const [isFavorited, setIsFavorited] = useState(isInitiallyFavorited);

  const daysUntilDrop = Math.floor(
    (new Date(domain.estimated_drop_date).getTime() - Date.now()) / (1000 * 3600 * 24)
  );

  const toggleFavorite = async () => {
    const res = await fetch('/api/favourites/toggle', { // Notera: 'favourites' matchar din mappstruktur i Bild 4
      method: 'POST',
      body: JSON.stringify({ domainId: domain.id }),
    });
    
    if (res.ok) {
      setIsFavorited(!isFavorited);
    } else {
      alert('Du måste vara inloggad för att spara domäner!');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md transition-all group">
      <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 text-center px-2">
        <span className="text-white font-bold text-lg break-all">{domain.domain_name}</span>
      </div>
      
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold uppercase text-gray-400">{domain.tld}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-bold ${daysUntilDrop <= 5 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
          {daysUntilDrop} dagar kvar
        </span>
      </div>

      <div className="flex gap-2 mt-4">
        <button className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          Bevaka 🔔
        </button>
        <button 
          onClick={toggleFavorite}
          className={`p-2 border rounded-lg transition-colors ${isFavorited ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50'}`}
        >
          <Heart size={18} className={isFavorited ? 'text-red-500 fill-red-500' : 'text-gray-400'} />
        </button>
      </div>
    </div>
  );
}
