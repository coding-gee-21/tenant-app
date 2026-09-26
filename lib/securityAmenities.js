export const SECURITY_AMENITY_OPTIONS = Object.freeze([
  { value: 'Security Guard', label: 'Security Guard' },
  { value: 'Gated Compound', label: 'Gated Compound' },
  { value: 'Biometric Access', label: 'Biometrics' },
]);

const SECURITY_AMENITY_VALUES = new Set(
  SECURITY_AMENITY_OPTIONS.map((option) => option.value)
);

function normalizeSecurityAmenity(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'security guard') return 'Security Guard';
  if (normalized === 'gated compound') return 'Gated Compound';
  if (normalized === 'biometrics' || normalized === 'biometric access') {
    return 'Biometric Access';
  }

  return '';
}

export function normalizeSecurityAmenities(values) {
  const source = Array.isArray(values)
    ? values
    : String(values || '').split(/[,;|]/);

  return [...new Set(source.map(normalizeSecurityAmenity).filter(Boolean))]
    .filter((value) => SECURITY_AMENITY_VALUES.has(value));
}

export function securityAmenitiesFromProperty(property) {
  const storedAmenities = normalizeSecurityAmenities(
    property?.security_amenities
  );

  if (storedAmenities.length) return storedAmenities;
  return normalizeSecurityAmenities(property?.security_system);
}

export function serializeSecurityAmenities(values) {
  const normalized = normalizeSecurityAmenities(values);
  return normalized.length ? normalized.join(', ') : null;
}

export function formatSecurityAmenities(propertyOrValues) {
  const values = Array.isArray(propertyOrValues)
    ? normalizeSecurityAmenities(propertyOrValues)
    : securityAmenitiesFromProperty(propertyOrValues);

  if (values.length) {
    return values
      .map(
        (value) =>
          SECURITY_AMENITY_OPTIONS.find((option) => option.value === value)
            ?.label || value
      )
      .join(' • ');
  }

  const legacyValue = Array.isArray(propertyOrValues)
    ? ''
    : String(propertyOrValues?.security_system || '').trim();

  return legacyValue || 'Not supplied';
}
