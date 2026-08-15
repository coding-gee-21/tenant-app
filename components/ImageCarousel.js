import React, { useState } from 'react';

const isVideo = (url) => {
  if (!url || typeof url !== 'string') return false;
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.avi', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

// Helper to ensure Supabase storage paths convert to valid public URLs
const getImageUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // If it's a relative Supabase storage path, construct the public URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    // Adjust 'property-images' if your bucket name is different
    return `${supabaseUrl}/storage/v1/object/public/property-images/${url.replace(/^\/+/, '')}`;
  }
  return url;
};

export default function ImageCarousel({ images = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  // Filter out invalid entries and normalize URLs
  const validImages = Array.isArray(images) 
    ? images.filter(img => img && typeof img === 'string' && img.trim() !== '')
    : [];

  if (validImages.length === 0) {
    return (
      <div className="w-full h-64 md:h-96 bg-gray-800 flex items-center justify-center text-gray-400 rounded-lg">
        No images available
      </div>
    );
  }

  const currentMedia = validImages[currentIndex];
  const formattedUrl = getImageUrl(currentMedia);

  const nextMedia = () => {
    setImgError(false);
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
  };

  const prevMedia = () => {
    setImgError(false);
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
  };

  return (
    <div className="relative w-full">
      {/* Main Display View */}
      <div className="relative w-full h-64 md:h-96 lg:h-[32rem] bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
        {isVideo(currentMedia) ? (
          <video src={formattedUrl} controls className="w-full h-full object-contain" />
        ) : imgError ? (
          <div className="text-gray-400 text-center p-4">
            <p>Failed to load image</p>
            <span className="text-xs text-gray-600 break-all">{formattedUrl}</span>
          </div>
        ) : (
          <img 
            src={formattedUrl} 
            alt={`Property media ${currentIndex + 1}`} 
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}

        {/* Navigation Arrows */}
        {validImages.length > 1 && (
          <>
            <button 
              onClick={prevMedia} 
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black text-p p-2 rounded-full text-white transition"
            >
              ◀
            </button>
            <button 
              onClick={nextMedia} 
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black text-p p-2 rounded-full text-white transition"
            >
              ▶
            </button>
          </>
        )}

        {/* Counter Badge */}
        <div className="absolute bottom-3 right-3 bg-black/70 px-3 py-1 rounded-full text-xs text-white">
          {currentIndex + 1} / {validImages.length}
        </div>
      </div>

      {/* Thumbnails Row */}
      {validImages.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {validImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => { setCurrentIndex(idx); setImgError(false); }}
              className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition ${
                currentIndex === idx ? 'border-blue-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img 
                src={getImageUrl(img)} 
                alt={`Thumbnail ${idx + 1}`} 
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}