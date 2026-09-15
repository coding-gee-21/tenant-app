import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  GitCompareArrows,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import PropertyCard from '../components/PropertyCard';
import { useToast } from '../components/Toast';
import { estimateCampusTravel } from '../lib/campusDistance';
import {
  DISTANCE_BANDS,
  HOSTEL_AREAS,
  WALKING_TIME_BANDS,
  matchesArea,
  matchesNumericBand,
  optionLabel,
} from '../lib/hostelSearchConfig';
import { supabase } from '../lib/supabaseClient';

const LISTINGS_PER_PAGE = 12;

function propertyPrice(property) {
  return Number(
    property.semester_rent ??
      property.price ??
      property.rent ??
      0
  );
}

function propertyTravel(property) {
  return estimateCampusTravel(
    property.latitude,
    property.longitude
  );
}

function paginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1
    );
  }

  const visiblePages = [
    ...new Set([
      1,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      totalPages,
    ]),
  ]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);

  return visiblePages.reduce((items, page, index) => {
    const previousPage = visiblePages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push(`ellipsis-${previousPage}`);
    }

    items.push(page);
    return items;
  }, []);
}

export default function Rentals() {
  const router = useRouter();
  const { showToast } = useToast();

  const [properties, setProperties] = useState(null);
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('');
  const [walkingBand, setWalkingBand] = useState('');
  const [distanceBand, setDistanceBand] = useState('');
  const [available, setAvailable] = useState(true);
  const [sort, setSort] = useState('match');
  const [currentPage, setCurrentPage] = useState(1);
  const [compareIds, setCompareIds] = useState([]);

  useEffect(() => {
    const load = async () => {
      const stored = JSON.parse(
        localStorage.getItem('chuka-compare') || '[]'
      );

      setCompareIds(Array.isArray(stored) ? stored : []);

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('listing_status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        showToast(error.message, 'error');
        setProperties([]);
        return;
      }

      const propertyIds = (data || []).map(
        (property) => property.id
      );

      const { data: reviews } = propertyIds.length
        ? await supabase
            .from('reviews')
            .select(
              'property_id,rating,water_rating,security_rating,would_recommend'
            )
            .in('property_id', propertyIds)
            .eq('status', 'approved')
        : { data: [] };

      setProperties(
        (data || []).map((property) => {
          const propertyReviews = (reviews || []).filter(
            (review) => review.property_id === property.id
          );

          const average = (field) => {
            const values = propertyReviews
              .map((review) => Number(review[field]))
              .filter(Boolean);

            if (!values.length) return 0;

            return (
              values.reduce(
                (total, value) => total + value,
                0
              ) / values.length
            );
          };

          return {
            ...property,
            average_rating: average('rating'),
            average_water_rating: average('water_rating'),
            average_security_rating:
              average('security_rating'),
            recommendation_percentage:
              propertyReviews.length > 0
                ? Math.round(
                    (propertyReviews.filter(
                      (review) => review.would_recommend
                    ).length /
                      propertyReviews.length) *
                      100
                  )
                : 0,
            review_count: propertyReviews.length,
          };
        })
      );
    };

    Promise.resolve().then(load);
  }, [showToast]);

  const results = useMemo(() => {
    return (properties || [])
      .filter((property) => {
        const normalizedQuery = query.trim().toLowerCase();

        const searchableText = String(
          property.title || ''
        ).toLowerCase();

        const travel = propertyTravel(property);

        const matchesName =
          !normalizedQuery ||
          searchableText.includes(normalizedQuery);

        const matchesLocation = matchesArea(
          property,
          area
        );

        const matchesHouseType =
          !type || property.house_type === type;

        const matchesBudget =
          !budget ||
          propertyPrice(property) <= Number(budget);

        const matchesWalkingTime = matchesNumericBand(
          travel?.walkingMinutes ??
            Number.POSITIVE_INFINITY,
          walkingBand,
          WALKING_TIME_BANDS
        );

        const matchesDistance = matchesNumericBand(
          travel?.distanceKm ??
            Number.POSITIVE_INFINITY,
          distanceBand,
          DISTANCE_BANDS
        );

        const matchesAvailability =
          !available ||
          Number(property.vacant_rooms || 0) > 0;

        return (
          matchesName &&
          matchesLocation &&
          matchesHouseType &&
          matchesBudget &&
          matchesWalkingTime &&
          matchesDistance &&
          matchesAvailability
        );
      })
      .sort((first, second) => {
        if (sort === 'price') {
          return (
            propertyPrice(first) -
            propertyPrice(second)
          );
        }

        if (sort === 'distance') {
          return (
            (propertyTravel(first)?.distanceKm ??
              Number.POSITIVE_INFINITY) -
            (propertyTravel(second)?.distanceKm ??
              Number.POSITIVE_INFINITY)
          );
        }

        if (sort === 'rating') {
          return (
            Number(second.average_rating || 0) -
            Number(first.average_rating || 0)
          );
        }

        return 0;
      });
  }, [
    area,
    available,
    budget,
    distanceBand,
    properties,
    query,
    sort,
    type,
    walkingBand,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(results.length / LISTINGS_PER_PAGE)
  );

  const activePage = Math.min(
    currentPage,
    totalPages
  );

  const pageStart =
    (activePage - 1) * LISTINGS_PER_PAGE;

  const visibleResults = results.slice(
    pageStart,
    pageStart + LISTINGS_PER_PAGE
  );

  const visiblePageItems = paginationItems(
    activePage,
    totalPages
  );

  const updateFilter = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };

  const goToPage = (requestedPage) => {
    const nextPage = Math.min(
      Math.max(requestedPage, 1),
      totalPages
    );

    setCurrentPage(nextPage);

    window.requestAnimationFrame(() => {
      document
        .getElementById('rental-results')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    });
  };

  const toggleCompare = (property) => {
    const next = compareIds.includes(property.id)
      ? compareIds.filter(
          (propertyId) => propertyId !== property.id
        )
      : [...compareIds, property.id];

    if (next.length > 3) {
      showToast(
        'You can compare up to three properties.',
        'error'
      );
      return;
    }

    setCompareIds(next);

    localStorage.setItem(
      'chuka-compare',
      JSON.stringify(next)
    );
  };

  const saveProperty = async (property) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth?returnTo=/rentals');
      return;
    }

    const { error } = await supabase
      .from('bookmarks')
      .upsert(
        {
          user_id: user.id,
          property_id: property.id,
        },
        {
          onConflict: 'user_id,property_id',
        }
      );

    showToast(
      error
        ? error.message
        : 'Property saved to your shortlist.',
      error ? 'error' : 'success'
    );
  };

  const saveSearch = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth?returnTo=/rentals');
      return;
    }

    const name = [
      area
        ? optionLabel(HOSTEL_AREAS, area)
        : 'All areas',
      type || 'All rooms',
      budget &&
        `under KSh ${Number(
          budget
        ).toLocaleString()}`,
      walkingBand &&
        optionLabel(
          WALKING_TIME_BANDS,
          walkingBand
        ),
      distanceBand &&
        optionLabel(
          DISTANCE_BANDS,
          distanceBand
        ),
    ]
      .filter(Boolean)
      .join(' · ');

    const { error } = await supabase
      .from('saved_searches')
      .insert({
        user_id: user.id,
        name,
        filters: {
          query,
          area,
          type,
          budget,
          walkingBand,
          distanceBand,
          available,
        },
      });

    showToast(
      error
        ? error.message
        : 'Search saved. You can revisit it from your account.',
      error ? 'error' : 'success'
    );
  };

  const resetFilters = () => {
    setQuery('');
    setArea('');
    setType('');
    setBudget('');
    setWalkingBand('');
    setDistanceBand('');
    setAvailable(true);
    setSort('match');
    setCurrentPage(1);
  };

  const selectClass =
    'rounded-xl border border-white/10 bg-[#101013] p-3 text-sm';

  return (
    <div className="space-y-7 pb-24 text-white">
      <div>
        <p className="text-sm font-semibold text-blue-400">
          Student housing discovery
        </p>

        <h1 className="mt-1 text-3xl font-bold">
          All rentals near Chuka University
        </h1>

        <p className="mt-2 text-gray-400">
          Filter, save and compare properties before
          contacting a landlord. Walking estimates use
          each property&apos;s saved map location.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white/10 bg-[#18181B] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101013] px-3">
            <Search
              size={17}
              className="text-gray-500"
            />

            <span className="sr-only">
              Search properties
            </span>

            <input
              value={query}
              onChange={(event) =>
                updateFilter(
                  setQuery,
                  event.target.value
                )
              }
              placeholder="Search hostel by name"
              className="w-full bg-transparent py-3 text-sm outline-none"
            />
          </label>

          <select
            aria-label="Hostel location"
            value={area}
            onChange={(event) =>
              updateFilter(
                setArea,
                event.target.value
              )
            }
            className={selectClass}
          >
            <option value="">Location</option>

            {HOSTEL_AREAS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <select
            aria-label="House type"
            value={type}
            onChange={(event) =>
              updateFilter(
                setType,
                event.target.value
              )
            }
            className={selectClass}
          >
            <option value="">House Type</option>
            <option value="Bedsitter">
              Bedsitter
            </option>
            <option value="Single room">
              Single room
            </option>
            <option value="1 Bedroom">
              1 Bedroom
            </option>
            <option value="2 Bedroom">
              2 Bedroom
            </option>
          </select>

          <select
            aria-label="Maximum semester rent"
            value={budget}
            onChange={(event) =>
              updateFilter(
                setBudget,
                event.target.value
              )
            }
            className={selectClass}
          >
            <option value="">Rent Price</option>

            <option value="20000">
              Under KSh 20,000
            </option>

            <option value="25000">
              Under KSh 25,000
            </option>

            <option value="30000">
              Under KSh 30,000
            </option>

            <option value="40000">
              Under KSh 40,000
            </option>
          </select>

          <select
            aria-label="Walking time from Gate A"
            value={walkingBand}
            onChange={(event) =>
              updateFilter(
                setWalkingBand,
                event.target.value
              )
            }
            className={selectClass}
          >
            <option value="">Walk Time</option>

            {WALKING_TIME_BANDS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Distance from Gate A"
            value={distanceBand}
            onChange={(event) =>
              updateFilter(
                setDistanceBand,
                event.target.value
              )
            }
            className={selectClass}
          >
            <option value="">Distance</option>

            {DISTANCE_BANDS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={saveSearch}
            className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-300"
          >
            <BookmarkPlus size={17} />
            Save search
          </button>

          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300"
          >
            <RotateCcw size={17} />
            Reset filters
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={available}
              onChange={(event) =>
                updateFilter(
                  setAvailable,
                  event.target.checked
                )
              }
            />

            Available now
          </label>

          <div className="flex items-center gap-2">
            <SlidersHorizontal
              size={16}
              className="text-gray-500"
            />

            <select
              value={sort}
              onChange={(event) =>
                updateFilter(
                  setSort,
                  event.target.value
                )
              }
              className="rounded-lg border border-white/10 bg-[#101013] px-3 py-2 text-sm"
            >
              <option value="match">
                Best match
              </option>

              <option value="price">
                Lowest rent
              </option>

              <option value="distance">
                Closest
              </option>

              <option value="rating">
                Highest rated
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div
        id="rental-results"
        className="scroll-mt-24 flex flex-wrap justify-between gap-2"
      >
        <p className="text-sm text-gray-400">
          <strong className="text-white">
            {results.length}
          </strong>{' '}
          matching properties
        </p>

        {results.length > 0 && (
          <p className="text-sm text-gray-500">
            Showing {pageStart + 1}–
            {Math.min(
              pageStart + LISTINGS_PER_PAGE,
              results.length
            )}{' '}
            of {results.length}
          </p>
        )}
      </div>

      {/* Listings */}
      {properties === null ? (
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((number) => (
            <div
              key={number}
              className="h-80 animate-pulse rounded-2xl bg-white/5"
            />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleResults.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onSave={saveProperty}
              onToggleCompare={toggleCompare}
              compareSelected={compareIds.includes(
                property.id
              )}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#18181B] p-12 text-center text-gray-400">
          No rentals match these filters. Try another
          location, distance or walking range.
        </div>
      )}

      {/* Pagination */}
      {properties !== null &&
        results.length > LISTINGS_PER_PAGE && (
          <nav
            aria-label="Rental listing pages"
            className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#18181B] p-4"
          >
            <button
              type="button"
              onClick={() =>
                goToPage(activePage - 1)
              }
              disabled={activePage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            {visiblePageItems.map((item) =>
              typeof item === 'string' ? (
                <span
                  key={item}
                  className="px-2 text-gray-600"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToPage(item)}
                  aria-current={
                    item === activePage
                      ? 'page'
                      : undefined
                  }
                  aria-label={`Go to page ${item}`}
                  className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    item === activePage
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() =>
                goToPage(activePage + 1)
              }
              disabled={activePage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </nav>
        )}

      {/* Comparison bar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-blue-500/30 bg-[#10131A]/95 px-5 py-3 shadow-2xl backdrop-blur-xl md:bottom-5">
          <GitCompareArrows className="text-blue-400" />

          <span className="text-sm">
            {compareIds.length} selected
          </span>

          <Link
            href="/compare"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold"
          >
            Compare
          </Link>

          <button
            type="button"
            onClick={() => {
              setCompareIds([]);
              localStorage.removeItem(
                'chuka-compare'
              );
            }}
            className="text-xs text-gray-400"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}