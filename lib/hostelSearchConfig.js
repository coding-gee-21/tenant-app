export const HOSTEL_AREAS = Object.freeze([
  { value: 'mungoni', label: 'Mungoni' },
  { value: 'ndagani', label: 'Ndagani' },
  { value: 'lowlands', label: 'Lowlands' },
  { value: 'marine', label: 'Marine' },
  { value: 'landmark', label: 'Landmark' },
  { value: 'slaughterhouse', label: 'Slaughterhouse' },
  { value: 'juverus', label: 'Juverus' },
  {
    value: 'university-gates',
    label: 'Around Chuka University (gates)',
  },
  { value: 'other', label: 'Other' },
]);

export const WALKING_TIME_BANDS = Object.freeze([
  { value: '0-5', label: '0–5 minutes', min: 0, max: 5 },
  { value: '6-10', label: '6–10 minutes', min: 6, max: 10 },
  { value: '11-15', label: '11–15 minutes', min: 11, max: 15 },
  { value: '16-20', label: '16–20 minutes', min: 16, max: 20 },
  { value: '21-30', label: '21–30 minutes', min: 21, max: 30 },
  { value: '31-plus', label: '31+ minutes', min: 31, max: null },
]);

export const DISTANCE_BANDS = Object.freeze([
  { value: '0-0.5', label: 'Within 500 m', min: 0, max: 0.5 },
  {
    value: '0.5-1',
    label: '500 m–1 km',
    min: 0.5,
    max: 1,
    minimumExclusive: true,
  },
  {
    value: '1-2',
    label: '1–2 km',
    min: 1,
    max: 2,
    minimumExclusive: true,
  },
  {
    value: '2-3',
    label: '2–3 km',
    min: 2,
    max: 3,
    minimumExclusive: true,
  },
  {
    value: '3-plus',
    label: 'More than 3 km',
    min: 3,
    max: null,
    minimumExclusive: true,
  },
]);

export function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || '';
}

function normalizeLocation(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const LEGACY_AREA_ALIASES = Object.freeze([
  { value: 'mungoni', aliases: ['mungoni'] },
  { value: 'ndagani', aliases: ['ndagani'] },
  { value: 'lowlands', aliases: ['lowlands', 'low lands'] },
  { value: 'marine', aliases: ['marine'] },
  { value: 'landmark', aliases: ['landmark'] },
  { value: 'slaughterhouse', aliases: ['slaughterhouse', 'slaughter house'] },
  { value: 'juverus', aliases: ['juverus'] },
  {
    value: 'university-gates',
    aliases: [
      'around chuka university',
      'chuka university',
      'university gate',
      'campus gate',
      'gate a',
      'gate b',
      'gate c',
    ],
  },
]);

function areaFromText(value) {
  const normalized = normalizeLocation(value);
  if (!normalized) return '';

  const directOption = HOSTEL_AREAS.find(
    (option) =>
      normalizeLocation(option.value) === normalized ||
      normalizeLocation(option.label) === normalized
  );
  if (directOption) return directOption.value;

  return (
    LEGACY_AREA_ALIASES.find((candidate) =>
      candidate.aliases.some((alias) => normalized.includes(alias))
    )?.value || ''
  );
}

export function propertyAreaValue(property) {
  const explicitArea = areaFromText(property?.area);
  if (explicitArea) return explicitArea;

  const legacyArea = areaFromText(
    `${property?.custom_area || ''} ${property?.landmark || ''} ${
      property?.campus_landmark || ''
    }`
  );
  if (legacyArea) return legacyArea;

  return property?.custom_area?.trim() ||
    property?.landmark?.trim() ||
    property?.campus_landmark?.trim()
    ? 'other'
    : '';
}

export function propertyAreaLabel(property) {
  const areaValue = propertyAreaValue(property);

  if (areaValue === 'other') {
    return (
      property?.custom_area?.trim() ||
      property?.landmark?.trim() ||
      property?.campus_landmark?.trim() ||
      'Other area'
    );
  }

  return optionLabel(HOSTEL_AREAS, areaValue);
}

export function propertyLocationLabel(property) {
  const areaLabel = propertyAreaLabel(property);
  const landmark =
    property?.landmark?.trim() || property?.campus_landmark?.trim() || '';

  if (!areaLabel) return landmark || 'Area not assigned';
  if (!landmark || normalizeLocation(areaLabel) === normalizeLocation(landmark)) {
    return areaLabel;
  }

  return `${areaLabel} · ${landmark}`;
}

export function matchesArea(property, selectedArea) {
  return !selectedArea || propertyAreaValue(property) === selectedArea;
}

export function matchesNumericBand(value, selectedBand, bands) {
  if (!selectedBand) return true;
  if (!Number.isFinite(value)) return false;

  const band = bands.find((candidate) => candidate.value === selectedBand);
  if (!band) return true;

  const meetsMinimum = band.minimumExclusive
    ? value > band.min
    : value >= band.min;
  const meetsMaximum = band.max === null || value <= band.max;

  return meetsMinimum && meetsMaximum;
}
