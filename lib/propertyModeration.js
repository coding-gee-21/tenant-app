export function isPublicProperty(property) {
  if (!property) return false;

  return (
    property.listing_status === 'approved' &&
    property.is_flagged !== true &&
    property.flagged !== true &&
    property.status !== 'flagged' &&
    (property.moderation_status || 'public') === 'public'
  );
}
