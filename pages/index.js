import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ChevronDown,
  Clock3,
  Droplets,
  Filter,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Tag,
  Wifi
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { estimateCampusTravel } from '../lib/campusDistance';
import {
  DISTANCE_BANDS,
  HOSTEL_AREAS,
  WALKING_TIME_BANDS,
  matchesNumericBand,
  optionLabel,
} from '../lib/hostelSearchConfig';
import PropertyCard from '../components/PropertyCard';
import StudentSafetyWarning from '../components/StudentSafetyWarning';

const heroImages = [
  '/assets/hero/hero1.jpg',
  '/assets/hero/hero2.jpg',
  '/assets/hero/hero3.jpg'
];

const quickFilterOptions = [
  {
    key: 'availableNow',
    label: 'Available now',
    icon: Building2
  },
  {
    key: 'under25',
    label: 'Under KSh 25,000',
    icon: Tag
  },
  {
    key: 'within10',
    label: 'Within 10 min',
    icon: Clock3
  },
  {
    key: 'reliableWater',
    label: 'Reliable water',
    icon: Droplets
  },
  {
    key: 'wifi',
    label: 'Wi-Fi',
    icon: Wifi
  },
  {
    key: 'highlyRated',
    label: 'Highly rated',
    icon: Star
  },
  {
    key: 'verified',
    label: 'Verified',
    icon: ShieldCheck
  }
];

const initialQuickFilters = {
  availableNow: false,
  under25: false,
  within10: false,
  reliableWater: false,
  wifi: false,
  highlyRated: false,
  verified: false
};

function walkingMinutesFromCampus(property) {
  const calculated = estimateCampusTravel(
    property.latitude,
    property.longitude
  );

  return calculated?.walkingMinutes ?? Number.POSITIVE_INFINITY;
}

/*
 * These terms allow older listings that stored their location inside
 * landmark or campus_landmark to work with the new standardized filter.
 */
const LEGACY_AREA_TERMS = {
  mungoni: ['mungoni'],
  ndagani: ['ndagani'],
  lowlands: ['lowlands', 'low lands'],
  marine: ['marine'],
  landmark: ['landmark'],
  slaughterhouse: ['slaughterhouse', 'slaughter house'],
  juverus: ['juverus'],
  'university-gates': [
    'around chuka university',
    'chuka university',
    'university gate',
    'campus gate',
    'gate a',
    'gate b',
    'gate c',
  ],
};

function normalizeArea(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesPropertyArea(property, selectedArea) {
  if (!selectedArea) return true;

  const normalizedSelection = normalizeArea(selectedArea);
  const storedArea = normalizeArea(property.area);

  /*
   * This supports correctly standardized listings and older rows that
   * accidentally stored "Ndagani" instead of "ndagani".
   */
  if (storedArea === normalizedSelection) return true;

  const legacyLocation = normalizeArea(
    `${property.custom_area || ''} ${property.landmark || ''} ${
      property.campus_landmark || ''
    }`
  );

  const selectedTerms = LEGACY_AREA_TERMS[selectedArea] || [];

  if (selectedTerms.some((term) => legacyLocation.includes(term))) {
    return true;
  }

  if (selectedArea !== 'other') return false;
  if (storedArea === 'other') return true;

  const matchesKnownArea = Object.values(LEGACY_AREA_TERMS).some((terms) =>
    terms.some((term) => legacyLocation.includes(term))
  );

  /*
   * A legacy location that does not match any standard location is
   * treated as "Other".
   */
  return !storedArea && Boolean(legacyLocation) && !matchesKnownArea;
}

export default function Home() {
  const [properties, setProperties] = useState(null);
  const [areaFilter, setAreaFilter] = useState('');
  const [houseTypeFilter, setHouseTypeFilter] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [walkingTimeBand, setWalkingTimeBand] = useState('');
  const [distanceBand, setDistanceBand] = useState('');
  const [sortBy, setSortBy] = useState('bestMatch');

  const [quickFilters, setQuickFilters] = useState(initialQuickFilters);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [minimumRating, setMinimumRating] = useState('');
  const [minimumWaterRating, setMinimumWaterRating] = useState('');
  const [minimumSecurityRating, setMinimumSecurityRating] = useState('');
  const [freshVacanciesOnly, setFreshVacanciesOnly] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [referenceTime] = useState(() => Date.now());

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('listing_status', 'approved')
          .order('created_at', { ascending: false });

        if (propertyError) throw propertyError;

        const propertyIds = (propertyData || []).map(
          (property) => property.id
        );

        let reviewData = [];

        if (propertyIds.length > 0) {
          const { data: reviews, error: reviewError } = await supabase
            .from('reviews')
            .select(
              'property_id, rating, water_rating, security_rating, would_recommend'
            )
            .in('property_id', propertyIds);

          if (reviewError) throw reviewError;

          reviewData = reviews || [];
        }

        const reviewGroups = propertyIds.reduce((groups, propertyId) => {
          groups[propertyId] = [];
          return groups;
        }, {});

        for (const review of reviewData) {
          if (!review.property_id) continue;

          if (!reviewGroups[review.property_id]) {
            reviewGroups[review.property_id] = [];
          }

          reviewGroups[review.property_id].push(review);
        }

        const propertiesWithStudentScores = (propertyData || []).map(
          (property) => {
            const propertyReviews = reviewGroups[property.id] || [];

            const average = (field) => {
              const values = propertyReviews
                .map((review) => Number(review[field]))
                .filter((value) => value > 0);

              if (!values.length) return 0;

              return (
                values.reduce((total, value) => total + value, 0) /
                values.length
              );
            };

            const recommendationCount = propertyReviews.filter(
              (review) => review.would_recommend === true
            ).length;

            return {
              ...property,
              average_rating: average('rating'),
              average_water_rating: average('water_rating'),
              average_security_rating: average('security_rating'),
              recommendation_percentage:
                propertyReviews.length > 0
                  ? Math.round(
                      (recommendationCount / propertyReviews.length) * 100
                    )
                  : 0,
              review_count: propertyReviews.length
            };
          }
        );

        setProperties(propertiesWithStudentScores);
      } catch (error) {
        console.error('Error fetching properties:', error.message);
        setProperties([]);
      }
    };

    fetchProperties();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex(
        (previousIndex) => (previousIndex + 1) % heroImages.length
      );
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const loading = properties === null;

  const isVacancyFresh = (dateValue) => {
    if (!dateValue) return false;

    const vacancyTime = new Date(dateValue).getTime();

    if (Number.isNaN(vacancyTime)) return false;

    return referenceTime - vacancyTime <= 7 * 24 * 60 * 60 * 1000;
  };

  const filteredProperties = (properties || [])
    .filter((property) => {
      const matchesSelectedArea = matchesPropertyArea(
        property,
        areaFilter
      );

      const matchesType =
        houseTypeFilter === '' ||
        property.house_type === houseTypeFilter;

      const propertyPrice = Number(
        property.semester_rent ||
          property.price ||
          property.rent ||
          0
      );

      const matchesBudget =
        maxBudget === '' || propertyPrice <= Number(maxBudget);

      const campusTravel = estimateCampusTravel(
        property.latitude,
        property.longitude
      );

      const walkMinutes =
        campusTravel?.walkingMinutes ?? Number.POSITIVE_INFINITY;

      const distanceKm =
        campusTravel?.distanceKm ?? Number.POSITIVE_INFINITY;

      const matchesWalkingTime = matchesNumericBand(
        walkMinutes,
        walkingTimeBand,
        WALKING_TIME_BANDS
      );

      const matchesDistance = matchesNumericBand(
        distanceKm,
        distanceBand,
        DISTANCE_BANDS
      );

      const matchesRating =
        minimumRating === '' ||
        Number(property.average_rating || 0) >=
          Number(minimumRating);

      const matchesWaterRating =
        minimumWaterRating === '' ||
        Number(property.average_water_rating || 0) >=
          Number(minimumWaterRating);

      const matchesSecurityRating =
        minimumSecurityRating === '' ||
        Number(property.average_security_rating || 0) >=
          Number(minimumSecurityRating);

      const verified =
        property.is_verified === true ||
        property.verification_status === 'verified';

      const matchesQuickFilters =
        (!quickFilters.availableNow ||
          Number(property.vacant_rooms || 0) > 0) &&
        (!quickFilters.under25 || propertyPrice <= 25000) &&
        (!quickFilters.within10 || walkMinutes <= 10) &&
        (!quickFilters.reliableWater ||
          Number(property.average_water_rating || 0) >= 4) &&
        (!quickFilters.wifi ||
          property.wifi_available === true) &&
        (!quickFilters.highlyRated ||
          Number(property.average_rating || 0) >= 4) &&
        (!quickFilters.verified || verified);

      const matchesFreshness =
        !freshVacanciesOnly ||
        isVacancyFresh(property.last_vacancy_update);

      return (
        matchesSelectedArea &&
        matchesType &&
        matchesBudget &&
        matchesWalkingTime &&
        matchesDistance &&
        matchesRating &&
        matchesWaterRating &&
        matchesSecurityRating &&
        matchesQuickFilters &&
        matchesFreshness
      );
    })
    .sort((first, second) => {
      if (sortBy === 'lowestRent') {
        return (
          Number(
            first.semester_rent ||
              first.price ||
              first.rent ||
              0
          ) -
          Number(
            second.semester_rent ||
              second.price ||
              second.rent ||
              0
          )
        );
      }

      if (sortBy === 'closest') {
        return (
          walkingMinutesFromCampus(first) -
          walkingMinutesFromCampus(second)
        );
      }

      if (sortBy === 'highestRated') {
        return (
          Number(second.average_rating || 0) -
          Number(first.average_rating || 0)
        );
      }

      if (sortBy === 'freshestVacancy') {
        return (
          new Date(
            second.last_vacancy_update || 0
          ).getTime() -
          new Date(
            first.last_vacancy_update || 0
          ).getTime()
        );
      }

      const bestMatchScore = (property) => {
        let score = 0;

        if (Number(property.vacant_rooms || 0) > 0) {
          score += 30;
        }

        if (
          property.is_verified === true ||
          property.verification_status === 'verified'
        ) {
          score += 20;
        }

        score += Number(property.average_rating || 0) * 8;
        score +=
          Number(property.recommendation_percentage || 0) * 0.15;

        if (walkingMinutesFromCampus(property) <= 10) {
          score += 15;
        }

        if (isVacancyFresh(property.last_vacancy_update)) {
          score += 15;
        }

        return score;
      };

      return bestMatchScore(second) - bestMatchScore(first);
    });

  const toggleQuickFilter = (filterKey) => {
    setQuickFilters((current) => ({
      ...current,
      [filterKey]: !current[filterKey]
    }));
  };

  const resetFilters = () => {
    setAreaFilter('');
    setHouseTypeFilter('');
    setMaxBudget('');
    setWalkingTimeBand('');
    setDistanceBand('');
    setMinimumRating('');
    setMinimumWaterRating('');
    setMinimumSecurityRating('');
    setFreshVacanciesOnly(false);
    setQuickFilters(initialQuickFilters);
    setSortBy('bestMatch');
  };

  const selectedPriorities = [
    areaFilter && optionLabel(HOSTEL_AREAS, areaFilter),
    houseTypeFilter && houseTypeFilter,
    maxBudget &&
      `Under KSh ${Number(maxBudget).toLocaleString()}`,
    walkingTimeBand &&
      optionLabel(WALKING_TIME_BANDS, walkingTimeBand),
    distanceBand &&
      optionLabel(DISTANCE_BANDS, distanceBand),
    quickFilters.availableNow && 'Available now',
    quickFilters.under25 && 'Under KSh 25,000',
    quickFilters.within10 && 'Within 10 minutes',
    quickFilters.reliableWater && 'Reliable water',
    quickFilters.wifi && 'Wi-Fi',
    quickFilters.highlyRated && 'Highly rated',
    quickFilters.verified && 'Verified'
  ].filter(Boolean);

  const handleSearch = () => {
    const listingsSection = document.getElementById('listings');

    if (listingsSection) {
      listingsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-24 pb-16">
      {/* Hero section */}
      <div className="relative left-[50%] -mt-8 flex min-h-screen w-screen -translate-x-[50%] items-center justify-center overflow-hidden bg-[#121215] md:-mt-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 z-10 bg-black/50" />

          {heroImages.map((image, index) => (
            <img
              key={image}
              src={image}
              alt={`Hero slide ${index + 1}`}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                index === currentImageIndex
                  ? 'opacity-100'
                  : 'opacity-0'
              }`}
            />
          ))}
        </div>

        <div className="relative z-20 mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center">
          <span className="mb-6 inline-block rounded-full border border-blue-500/30 bg-blue-500/20 px-4 py-1.5 text-xs font-semibold text-blue-400">
            Chuka University Off-Campus Housing
          </span>

          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Find Your Next Student Home <br />

            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Direct & Verified
            </span>
          </h1>

          <p className="mb-8 max-w-2xl text-base text-gray-300 md:text-lg">
            Connect directly with trusted landlords around Ndagani and
            campus. No brokers, no hidden fees.
          </p>

          <div className="mb-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/rentals"
              className="rounded-xl bg-blue-600 px-8 py-3.5 font-medium text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
            >
              Browse Listings
            </Link>

            <Link
              href="/landlord"
              className="rounded-xl border border-white/10 bg-[#242427] px-8 py-3.5 font-medium text-white transition hover:bg-[#2e2e33]"
            >
              List Your Property
            </Link>
          </div>

          {/* Student search filters */}
          <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#18181B]/95 p-4 text-left shadow-2xl backdrop-blur-md">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
              {/* Location */}
              <label className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-[#0D0E12] px-4 py-3">
                <MapPin
                  size={18}
                  className="shrink-0 text-sky-400"
                />

                <select
                  value={areaFilter}
                  onChange={(event) =>
                    setAreaFilter(event.target.value)
                  }
                  aria-label="Location"
                  className="w-full appearance-none bg-transparent pr-6 text-sm text-white outline-none"
                >
                  <option
                    value=""
                    className="bg-[#121215]"
                  >
                    Location
                  </option>

                  {HOSTEL_AREAS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-[#121215]"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 text-gray-500"
                />
              </label>

              {/* House type */}
              <label className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-[#0D0E12] px-4 py-3">
                <Building2
                  size={18}
                  className="shrink-0 text-emerald-400"
                />

                <select
                  value={houseTypeFilter}
                  onChange={(event) =>
                    setHouseTypeFilter(event.target.value)
                  }
                  aria-label="House Type"
                  className="w-full appearance-none bg-transparent pr-6 text-sm text-white outline-none"
                >
                  <option
                    value=""
                    className="bg-[#121215]"
                  >
                    House Type
                  </option>

                  <option
                    value="Bedsitter"
                    className="bg-[#121215]"
                  >
                    Bedsitter
                  </option>

                  <option
                    value="Single room"
                    className="bg-[#121215]"
                  >
                    Single room
                  </option>

                  <option
                    value="1 Bedroom"
                    className="bg-[#121215]"
                  >
                    1 Bedroom
                  </option>

                  <option
                    value="2 Bedroom"
                    className="bg-[#121215]"
                  >
                    2 Bedroom
                  </option>
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 text-gray-500"
                />
              </label>

              {/* Rent price */}
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0D0E12] px-4 py-3">
                <Tag
                  size={18}
                  className="shrink-0 text-amber-400"
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Rent Price"
                  value={maxBudget}
                  onChange={(event) =>
                    setMaxBudget(event.target.value)
                  }
                  aria-label="Maximum rent price"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                />
              </label>

              {/* Walk time */}
              <label className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-[#0D0E12] px-4 py-3">
                <Clock3
                  size={18}
                  className="shrink-0 text-purple-400"
                />

                <select
                  value={walkingTimeBand}
                  onChange={(event) =>
                    setWalkingTimeBand(event.target.value)
                  }
                  aria-label="Walk Time"
                  className="w-full appearance-none bg-transparent pr-6 text-sm text-white outline-none"
                >
                  <option
                    value=""
                    className="bg-[#121215]"
                  >
                    Walk Time
                  </option>

                  {WALKING_TIME_BANDS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-[#121215]"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 text-gray-500"
                />
              </label>

              {/* Distance */}
              <label className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-[#0D0E12] px-4 py-3">
                <Route
                  size={18}
                  className="shrink-0 text-cyan-400"
                />

                <select
                  value={distanceBand}
                  onChange={(event) =>
                    setDistanceBand(event.target.value)
                  }
                  aria-label="Distance"
                  className="w-full appearance-none bg-transparent pr-6 text-sm text-white outline-none"
                >
                  <option
                    value=""
                    className="bg-[#121215]"
                  >
                    Distance
                  </option>

                  {DISTANCE_BANDS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-[#121215]"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 text-gray-500"
                />
              </label>

              <button
                type="button"
                onClick={handleSearch}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <Search size={17} />
                Search
              </button>
            </div>

            {/* Quick filters */}
            <div className="mt-4 flex flex-wrap gap-2">
              {quickFilterOptions.map((option) => {
                const Icon = option.icon;
                const active = quickFilters[option.key];

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      toggleQuickFilter(option.key)
                    }
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
                      active
                        ? 'border-blue-500/40 bg-blue-500/20 text-blue-200'
                        : 'border-white/10 bg-[#0D0E12] text-gray-400 hover:text-white'
                    }`}
                  >
                    <Icon size={14} />
                    {option.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  setShowAdvancedFilters(
                    (currentValue) => !currentValue
                  )
                }
                className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0D0E12] px-3 py-2 text-xs font-medium text-gray-300 transition hover:text-white"
              >
                <Filter size={14} />
                More filters

                <ChevronDown
                  size={14}
                  className={`transition ${
                    showAdvancedFilters ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Advanced filters */}
            {showAdvancedFilters && (
              <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-400">
                    Student rating
                  </label>

                  <select
                    value={minimumRating}
                    onChange={(event) =>
                      setMinimumRating(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0D0E12] px-3 py-3 text-sm text-white outline-none"
                  >
                    <option value="">Any rating</option>
                    <option value="3">3.0 and above</option>
                    <option value="4">4.0 and above</option>
                    <option value="4.5">
                      4.5 and above
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-400">
                    Water reliability
                  </label>

                  <select
                    value={minimumWaterRating}
                    onChange={(event) =>
                      setMinimumWaterRating(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0D0E12] px-3 py-3 text-sm text-white outline-none"
                  >
                    <option value="">Any rating</option>
                    <option value="3">3.0 and above</option>
                    <option value="4">4.0 and above</option>
                    <option value="4.5">
                      4.5 and above
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-400">
                    Security rating
                  </label>

                  <select
                    value={minimumSecurityRating}
                    onChange={(event) =>
                      setMinimumSecurityRating(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0D0E12] px-3 py-3 text-sm text-white outline-none"
                  >
                    <option value="">Any rating</option>
                    <option value="3">3.0 and above</option>
                    <option value="4">4.0 and above</option>
                    <option value="4.5">
                      4.5 and above
                    </option>
                  </select>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#0D0E12] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={freshVacanciesOnly}
                    onChange={(event) =>
                      setFreshVacanciesOnly(
                        event.target.checked
                      )
                    }
                  />

                  <span>
                    <strong className="block text-xs text-white">
                      Recently confirmed
                    </strong>

                    <span className="text-[11px] text-gray-500">
                      Updated within 7 days
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trust highlights */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-[#18181B] p-6">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-400">
            <ShieldCheck size={24} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">
              Verified Landlords
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              Direct contact with authentic caretakers around Chuka
              University.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-[#18181B] p-6">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
            <Building2 size={24} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">
              Transparent Pricing
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              Clear semester rent with zero agent markup or surprise
              broker fees.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-[#18181B] p-6">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-purple-400">
            <MessageSquare size={24} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">
              Instant WhatsApp Connect
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              Inquire and schedule viewings with a single tap on mobile
              or desktop.
            </p>
          </div>
        </div>
      </section>

      {/* Homepage warning stays in the original warning position */}
      <StudentSafetyWarning />

      {/* Property listings */}
      <section id="listings" className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[#18181B] p-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-blue-500/15 p-2 text-blue-400">
                  <Building2 size={18} />
                </div>

                <span className="font-semibold text-white">
                  {filteredProperties.length}
                </span>

                <span className="text-sm text-gray-400">
                  matching properties
                </span>
              </div>

              {selectedPriorities.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-l border-white/10 pl-4">
                  <span className="text-xs text-gray-500">
                    Your priorities:
                  </span>

                  {selectedPriorities
                    .slice(0, 4)
                    .map((priority) => (
                      <span
                        key={priority}
                        className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300"
                      >
                        {priority}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <SlidersHorizontal
                size={16}
                className="text-gray-500"
              />

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value)
                }
                className="rounded-xl border border-white/10 bg-[#101013] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="bestMatch">Best match</option>
                <option value="lowestRent">
                  Lowest semester rent
                </option>
                <option value="closest">
                  Closest to campus
                </option>
                <option value="highestRated">
                  Highest student rating
                </option>
                <option value="freshestVacancy">
                  Newest vacancies
                </option>
              </select>

              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-gray-500 hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between border-b border-white/10 pb-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Available Housing
            </h2>

            <p className="mt-1 text-gray-400">
              Explore verified rentals near campus.
            </p>
          </div>

          <span className="mt-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm text-blue-400 md:mt-0">
            {filteredProperties.length} Properties Available
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((number) => (
              <div
                key={number}
                className="h-80 animate-pulse rounded-2xl border border-white/5 bg-[#18181B]"
              />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#18181B] p-12 text-center">
            <p className="text-lg font-medium text-gray-300">
              No properties match your current search.
            </p>

            <p className="text-sm text-gray-500">
              Try clearing your filters to see all listings.
            </p>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties
              .slice(0, 5)
              .map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                />
              ))}
          </div>
        )}

        {!loading && filteredProperties.length >= 5 && (
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 p-6 text-center">
            <h3 className="text-xl font-bold text-white">
              There are more student rentals to explore
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              Open the complete listings page to use comparison, saved
              searches and advanced sorting.
            </p>

            <Link
              href="/rentals"
              className="mt-4 inline-flex rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              View all rentals
            </Link>
          </div>
        )}
      </section>

      {/* Support section */}
      <section className="space-y-6 rounded-3xl border border-white/10 bg-[#18181B] p-8 text-center md:p-12">
        <div className="mx-auto max-w-2xl space-y-3">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Need Help Finding Housing?
          </h2>

          <p className="text-gray-400">
            Have questions about a listing or want to register as a
            landlord? Get in touch directly with our support team.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 pt-4">
          <a
            href="mailto:chukarentalssupport@gmail.com"
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#242427] px-6 py-3.5 text-gray-200 transition hover:bg-[#2c2c30] hover:text-white"
          >
            <Mail className="text-blue-400" size={20} />

            <span className="font-medium">
              chukarentalssupport@gmail.com
            </span>
          </a>

          <a
            href="https://wa.me/254708797271"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#242427] px-6 py-3.5 text-gray-200 transition hover:bg-[#2c2c30] hover:text-white"
          >
            <Phone
              className="text-emerald-400"
              size={20}
            />

            <span className="font-medium">
              +254 708 797 271
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}