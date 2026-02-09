import { Heart, ExternalLink } from 'lucide-react';

export default function DomainCard({ domain }) {
  const daysUntilDrop = Math.floor((new Date(domain.estimated_drop_date).getTime() - Date.now()) / (1000 * 3600 * 24));

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md transition-all group">
      <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
        <span className="text-white font-bold text-xl break-all px-2 text-center">{domain.domain_name}</span>
      </div>
      
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold uppercase text-gray-400">{domain.tld}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-bold ${daysUntilDrop <= 5 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
          {daysUntilDrop} dagar kvar
        </span>
      </div>

      <div className="flex gap-2 mt-4">
        <button className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
          Bevaka 🔔
        </button>
        <button className="p-2 border rounded-lg hover:bg-gray-50">
          <Heart size={18} className="text-gray-400 group-hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}
