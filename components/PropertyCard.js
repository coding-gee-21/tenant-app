// components/PropertyCard.js
import Link from 'next/link';
import { MapPin, Phone, CheckCircle, Clock } from 'lucide-react';
import { handleWhatsAppClick } from '../utils/trackLead';

const getCardImage = (property) => {
  let imgPath = '';
  if (Array.isArray(property.images) && property.images.length > 0) {
    imgPath = property.images[0];
  } else if (typeof property.images === 'string' && property.images.trim() !== '') {
    try {
      const parsed = JSON.parse(property.images);
      imgPath = Array.isArray(parsed) ? parsed[0] : property.images;
    } catch {
      imgPath = property.images;
    }
  } else {
    imgPath = property.image || property.image_url || '';
  }

  if (!imgPath || typeof imgPath !== 'string') return '';

  if (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:')) {
    return imgPath;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/property-images/${imgPath.replace(/^\/+/, '')}`;
  }

  return imgPath;
};

export default function PropertyCard({ property }) {
  const { 
    id, 
    title, 
    house_type: type, 
    semester_rent, 
    price, 
    rent, 
    landmark, 
    walk_mins: walk_time, 
    whatsapp, 
    images, 
    vacant_rooms,
    is_verified,
    is_flagged,
    flagged,
    status 
  } = property;

  // Ensure flagged or test properties do NOT show the verified badge
  const isActuallyVerified = is_verified && !is_flagged && !flagged && status !== 'flagged';

  const imageUrl = getCardImage(property) || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';

  const cleanPhone = whatsapp ? whatsapp.replace(/[^0-9]/g, '') : '';
  const displayPrice = semester_rent ?? price ?? rent ?? 0;

  const onWhatsAppClick = (e) => {
    e.preventDefault();
    handleWhatsAppClick(id, whatsapp || '');
  };

  return (
    <div className="group bg-[#18181B] border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/40 transition duration-300 flex flex-col justify-between">
      <div>
        {/* Card Header Media */}
        <div className="relative h-48 w-full bg-gray-900 overflow-hidden">
          <img 
            src={imageUrl} 
            alt={title || 'Property image'} 
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            onError={(e) => {
              e.target.src = '/placeholder-image.jpg';
            }}
          />
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs px-2.5 py-1 rounded-full font-medium">
            {type || 'Bedsitter'}
          </div>

          {/* Conditional Verified Badge */}
          {isActuallyVerified && (
            <div className="absolute top-3 right-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow-md">
              <CheckCircle size={12} /> Verified
            </div>
          )}

          <div className={`absolute top-3 right-3 ${isActuallyVerified ? 'mt-8' : ''}`}>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-md ${vacant_rooms > 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {vacant_rooms > 0 ? `${vacant_rooms} Rooms Vacant` : 'Fully Booked'}
            </span>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-5 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition line-clamp-1">
              {title}
            </h3>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-400">Ksh {Number(displayPrice).toLocaleString()}</span>
              <span className="text-xs text-gray-400 block">/semester</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
            <div className="flex items-center gap-1">
              <MapPin size={14} className="text-blue-400" />
              <span>{landmark || 'Ndagani'}</span>
            </div>
            {walk_time && (
              <div className="flex items-center gap-1">
                <Clock size={14} className="text-amber-400" />
                <span>{walk_time} min walk</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 pt-0 grid grid-cols-2 gap-2 mt-2">
        <Link 
          href={`/properties/${id}`} 
          className="py-2.5 px-3 bg-[#242427] hover:bg-[#2c2c30] text-gray-200 text-xs font-semibold rounded-xl text-center border border-white/5 transition"
        >
          View Details
        </Link>
        {cleanPhone ? (
          <button 
            onClick={onWhatsAppClick}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl text-center transition flex items-center justify-center gap-1"
          >
            <Phone size={14} /> WhatsApp
          </button>
        ) : (
          <button disabled className="py-2.5 px-3 bg-gray-800 text-gray-500 text-xs rounded-xl cursor-not-allowed">
            No Contact
          </button>
        )}
      </div>
    </div>
  );
}