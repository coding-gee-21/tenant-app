import { Star } from 'lucide-react';

export default function ReviewCard({ review }) {
  return (
    <div className="bg-[#242427]/40 p-4 rounded-xl border border-white/5 space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-white">{review.profiles?.full_name || 'Anonymous Student'}</span>
        <span className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</span>
      </div>
      <div className="flex text-yellow-400 text-sm">
        {Array.from({ length: review.rating }).map((_, i) => (
          <Star key={i} size={14} fill="currentColor" />
        ))}
      </div>
      <p className="text-sm text-gray-300">{review.comment}</p>
      {review.image_url && (
        <div className="mt-2">
          <a href={review.image_url} target="_blank" rel="noopener noreferrer">
            <img
              src={review.image_url}
              alt="Review evidence"
              className="w-32 h-32 object-cover rounded-md border border-white/10 hover:opacity-90 transition"
            />
          </a>
        </div>
      )}
    </div>
  );
}
