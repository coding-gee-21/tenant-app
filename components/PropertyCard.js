// components/PropertyCard.js
import { useState } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  CheckCircle,
  Clock,
  Droplets,
  Flag,
  MapPin,
  Phone,
  Shield,
  Star,
  ThumbsUp
} from 'lucide-react';
import { GitCompareArrows, Heart } from 'lucide-react';
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

export default function PropertyCard({ property, compareSelected = false, onToggleCompare, onSave }) {
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
    vacant_rooms,
    is_verified,
    verification_status,
    is_flagged,
    flagged,
    status,
    last_vacancy_update,
    average_rating,
    average_water_rating,
    average_security_rating,
    recommendation_percentage,
    review_count
  } = property;

  const isActuallyVerified =
    (is_verified === true || verification_status === 'verified') &&
    !is_flagged &&
    !flagged &&
    status !== 'flagged';

  const imageUrl = getCardImage(property) || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';

  const cleanPhone = whatsapp ? whatsapp.replace(/[^0-9]/g, '') : '';
  const displayPrice = semester_rent ?? price ?? rent ?? 0;
  const [referenceTime] = useState(() => Date.now());

  const vacancyAgeInDays = last_vacancy_update
    ? Math.floor(
        (referenceTime - new Date(last_vacancy_update).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const vacancyFreshnessLabel =
    vacancyAgeInDays === null
      ? 'Availability not confirmed'
      : vacancyAgeInDays <= 0
      ? 'Vacancy confirmed today'
      : vacancyAgeInDays === 1
      ? 'Vacancy confirmed yesterday'
      : vacancyAgeInDays <= 7
      ? `Vacancy confirmed ${vacancyAgeInDays} days ago`
      : 'Availability needs confirmation';

  const vacancyFresh = vacancyAgeInDays !== null && vacancyAgeInDays <= 7;

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
          {onSave && <button type="button" onClick={() => onSave(property)} aria-label="Save property" className="absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/65 p-2 text-white backdrop-blur-md hover:bg-blue-600"><Heart size={17} /></button>}
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs px-2.5 py-1 rounded-full font-medium">
            {type || 'Bedsitter'}
          </div>

          <div className="absolute top-3 right-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-md ${vacant_rooms > 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {vacant_rooms > 0 ? `${vacant_rooms} Rooms Vacant` : 'Fully Booked'}
            </span>
          </div>

          {is_flagged ? (
            <div className="absolute top-12 left-3 z-20 bg-red-500/15 border border-red-500/40 text-red-300 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 backdrop-blur-md">
              <Flag size={12} />
              Flagged
            </div>
          ) : (
            isActuallyVerified && (
              <div className="absolute top-12 left-3 z-20 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 backdrop-blur-md">
                <CheckCircle size={12} />
                Verified
              </div>
            )
          )}
        </div>

        {/* Card Content */}
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {vacant_rooms > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  vacancyFresh
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                }`}
              >
                <BadgeCheck size={12} />
                {vacancyFreshnessLabel}
              </span>
            )}

            {recommendation_percentage > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300">
                <ThumbsUp size={12} />
                {recommendation_percentage}% recommended
              </span>
            )}
          </div>

          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition line-clamp-1">
                {title}
              </h3>
            </div>
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

          {review_count > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
                <Star size={12} fill="currentColor" />
                {Number(average_rating).toFixed(1)}
              </span>

              {average_water_rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] text-blue-300">
                  <Droplets size={12} />
                  Water {Number(average_water_rating).toFixed(1)}
                </span>
              )}

              {average_security_rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                  <Shield size={12} />
                  Security {Number(average_security_rating).toFixed(1)}
                </span>
              )}

              <span className="px-1 py-1 text-[11px] text-gray-500">
                {review_count} {review_count === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {onToggleCompare && <button type="button" onClick={() => onToggleCompare(property)} className={`mx-5 mb-2 flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition ${compareSelected ? 'border-blue-500 bg-blue-500/15 text-blue-300' : 'border-white/10 text-gray-400 hover:text-white'}`}><GitCompareArrows size={14} />{compareSelected ? 'Added to comparison' : 'Compare'}</button>}
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
