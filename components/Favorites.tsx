'use client';

import { useState, useEffect } from 'react';
import { Heart, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Domain {
  id: number;
  domain_name: string;
  slug: string;
  days_until_drop: number;
  popularity_score: number;
  tld: string;
}

interface FavoriteItem {
  id: number;
  domain_name: string;
  slug: string;
  addedAt: string;
}

export function FavoriteButton({ domain }: { domain: Domain }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const favorites = getFavorites();
    setIsFavorite(favorites.some(f => f.id === domain.id));
  }, [domain.id]);

  const toggleFavorite = () => {
    const favorites = getFavorites();
    
    if (isFavorite) {
      // Remove from favorites
      const updated = favorites.filter(f => f.id !== domain.id);
      saveFavorites(updated);
      setIsFavorite(false);
    } else {
      // Add to favorites
      const newFavorite: FavoriteItem = {
        id: domain.id,
        domain_name: domain.domain_name,
        slug: domain.slug,
        addedAt: new Date().toISOString(),
      };
      saveFavorites([...favorites, newFavorite]);
      setIsFavorite(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  };

  return (
    <>
      <button
        onClick={toggleFavorite}
        className={`p-3 rounded-lg border-2 transition-all ${
          isFavorite
            ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
            : 'bg-white border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600'
        }`}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>

      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up">
          ✅ Added to favorites! <Link href="/favorites" className="underline ml-2">View all</Link>
        </div>
      )}
    </>
  );
}

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    const favItems = getFavorites();
    setFavorites(favItems);

    if (favItems.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch full domain data
    try {
      const ids = favItems.map(f => f.id).join(',');
      // Note: You'll need to create this API endpoint
      const response = await fetch(`/api/domains/by-ids?ids=${ids}`);
      const data = await response.json();
      setDomains(data.domains || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = (id: number) => {
    const updated = favorites.filter(f => f.id !== id);
    saveFavorites(updated);
    setFavorites(updated);
    setDomains(domains.filter(d => d.id !== id));
  };

  const clearAll = () => {
    if (confirm('Remove all favorites?')) {
      saveFavorites([]);
      setFavorites([]);
      setDomains([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="text-red-600" size={32} fill="currentColor" />
              <div>
                <h1 className="text-3xl font-bold">My Favorites</h1>
                <p className="text-gray-600 mt-1">
                  {favorites.length} {favorites.length === 1 ? 'domain' : 'domains'} saved
                </p>
              </div>
            </div>

            {favorites.length > 0 && (
              <button
                onClick={clearAll}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {favorites.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="mx-auto text-gray-300 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-gray-700 mb-2">No favorites yet</h2>
            <p className="text-gray-600 mb-6">
              Start adding domains to your favorites to track them easily
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Browse Domains
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {domains.map((domain) => (
              <div key={domain.id} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg break-all">{domain.domain_name}</h3>
                    <button
                      onClick={() => removeFavorite(domain.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Remove from favorites"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                      .{domain.tld}
                    </span>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">
                      {domain.popularity_score}/100
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">
                    Drops in <strong>{domain.days_until_drop} days</strong>
                  </p>

                  <Link
                    href={`/domain/${domain.slug}`}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Details
                    <ExternalLink size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions for localStorage
function getFavorites(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('domain-favorites');
  return stored ? JSON.parse(stored) : [];
}

function saveFavorites(favorites: FavoriteItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('domain-favorites', JSON.stringify(favorites));
}

export default FavoritesPage;
