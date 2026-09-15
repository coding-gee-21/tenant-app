import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  MapPinned,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import HostelDirectoryMap from '../components/HostelDirectoryMap';
import { estimateCampusTravel } from '../lib/campusDistance';
import {
  DISTANCE_BANDS,
  HOSTEL_AREAS,
  WALKING_TIME_BANDS,
  matchesArea,
  matchesNumericBand,
} from '../lib/hostelSearchConfig';
import { supabase } from '../lib/supabaseClient';

function hasCoordinates(property) {
  const lat = Number(property?.latitude);
  const lng = Number(property?.longitude);

  return (
    property?.latitude !== null &&
    property?.latitude !== undefined &&
    property?.longitude !== null &&
    property?.longitude !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function rentFor(property) {
  return Number(
    property.semester_rent ?? property.price ?? property.rent ?? 0
  );
}

function verifiedProperty(property) {
  return (
    (property.is_verified === true ||
      property.verification_status === 'verified') &&
    !property.is_flagged &&
    !property.flagged &&
    property.status !== 'flagged'
  );
}

export default function HostelMapPage() {
  const [properties, setProperties] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
  const [houseType, setHouseType] = useState('');
  const [maximumRent, setMaximumRent] = useState('');
  const [walkingBand, setWalkingBand] = useState('');
  const [distanceBand, setDistanceBand] = useState('');
  const [sortBy, setSortBy] = useState('distance');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProperties() {
      setLoadError('');

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('listing_status', 'approved')
        .order('created_at', { ascending: false });

      if (!active) return;

      if (error) {
        setLoadError(error.message);
        setProperties([]);
        return;
      }

      setProperties(data || []);
    }

    loadProperties();
    return () => {
      active = false;
    };
  }, []);

  const mappedProperties = useMemo(
    () =>
      (properties || [])
        .filter(hasCoordinates)
        .map((property) => ({
          ...property,
          campus_estimate: estimateCampusTravel(
            property.latitude,
            property.longitude
          ),
        })),
    [properties]
  );

  const houseTypes = useMemo(
    () =>
      [...new Set(mappedProperties.map((property) => property.house_type))]
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second)),
    [mappedProperties]
  );

  const filteredProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return mappedProperties
      .filter((property) => {
        const searchableText = `${property.title || ''}`.toLowerCase();

        return (
          (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
          matchesArea(property, area) &&
          (!houseType || property.house_type === houseType) &&
          (!maximumRent || rentFor(property) <= Number(maximumRent)) &&
          matchesNumericBand(
            property.campus_estimate?.walkingMinutes ?? Number.POSITIVE_INFINITY,
            walkingBand,
            WALKING_TIME_BANDS
          ) &&
          matchesNumericBand(
            property.campus_estimate?.distanceKm ?? Number.POSITIVE_INFINITY,
            distanceBand,
            DISTANCE_BANDS
          ) &&
          (!availableOnly || Number(property.vacant_rooms ?? 0) > 0) &&
          (!verifiedOnly || verifiedProperty(property))
        );
      })
      .sort((first, second) => {
        if (sortBy === 'rent') return rentFor(first) - rentFor(second);
        if (sortBy === 'name') {
          return (first.title || '').localeCompare(second.title || '');
        }

        return (
          (first.campus_estimate?.distanceKm ?? Number.POSITIVE_INFINITY) -
          (second.campus_estimate?.distanceKm ?? Number.POSITIVE_INFINITY)
        );
      });
  }, [
    area,
    availableOnly,
    distanceBand,
    houseType,
    mappedProperties,
    maximumRent,
    query,
    sortBy,
    verifiedOnly,
    walkingBand,
  ]);

  const missingCoordinateCount = Math.max(
    0,
    (properties?.length || 0) - mappedProperties.length
  );

  function resetFilters() {
    setQuery('');
    setArea('');
    setHouseType('');
    setMaximumRent('');
    setWalkingBand('');
    setDistanceBand('');
    setSortBy('distance');
    setAvailableOnly(true);
    setVerifiedOnly(false);
  }

  return (
    <>
      <Head>
        <title>Hostel Map | CUEAF</title>
        <meta
          name="description"
          content="Explore approved student hostels around Chuka University on an interactive map."
        />
      </Head>

      <div className="space-y-7 pb-24 text-white">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-400">
              <MapPinned size={17} />
              CUEAF hostel directory
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Find hostels around Chuka University
            </h1>
            <p className="mt-2 max-w-3xl leading-7 text-gray-400">
              Compare approximate campus distance and walking time, select a
              hostel and open the actual walking route in Google Maps. Always
              visit and verify the exact property before paying.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#18181B] px-4 py-3">
              <p className="text-xs text-gray-500">On the map</p>
              <p className="mt-1 text-xl font-bold text-blue-400">
                {mappedProperties.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#18181B] px-4 py-3">
              <p className="text-xs text-gray-500">Available</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">
                {
                  mappedProperties.filter(
                    (property) => Number(property.vacant_rooms ?? 0) > 0
                  ).length
                }
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-white/10 bg-[#18181B] px-4 py-3 sm:col-span-1">
              <p className="text-xs text-gray-500">Verified</p>
              <p className="mt-1 text-xl font-bold text-amber-400">
                {mappedProperties.filter(verifiedProperty).length}
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#18181B] p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101013] px-3">
              <Search size={17} className="shrink-0 text-gray-500" />
              <span className="sr-only">Search hostels</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search hostel by name"
                className="w-full border-0 bg-transparent py-3 text-sm shadow-none outline-none focus:ring-0"
              />
            </label>

            <label>
              <span className="sr-only">Hostel area</span>
              <select
                value={area}
                onChange={(event) => setArea(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm"
              >
                <option value="">All locations</option>
                {HOSTEL_AREAS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Walking time from Gate A</span>
              <select value={walkingBand} onChange={(event) => setWalkingBand(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm">
                <option value="">Any walking time</option>
                {WALKING_TIME_BANDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span className="sr-only">Distance from Gate A</span>
              <select value={distanceBand} onChange={(event) => setDistanceBand(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm">
                <option value="">Any campus distance</option>
                {DISTANCE_BANDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span className="sr-only">Sort mapped hostels</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm"
              >
                <option value="distance">Closest to campus</option>
                <option value="rent">Lowest semester rent</option>
                <option value="name">Hostel name</option>
              </select>
            </label>

            <label>
              <span className="sr-only">House type</span>
              <select
                value={houseType}
                onChange={(event) => setHouseType(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm"
              >
                <option value="">All house types</option>
                {houseTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Maximum semester rent</span>
              <select
                value={maximumRent}
                onChange={(event) => setMaximumRent(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm"
              >
                <option value="">Any semester rent</option>
                <option value="15000">Up to KSh 15,000</option>
                <option value="20000">Up to KSh 20,000</option>
                <option value="25000">Up to KSh 25,000</option>
                <option value="30000">Up to KSh 30,000</option>
                <option value="40000">Up to KSh 40,000</option>
              </select>
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-[#101013] px-4 py-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(event) => setAvailableOnly(event.target.checked)}
              />
              <Building2 size={15} className="text-emerald-400" />
              Available rooms only
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-[#101013] px-4 py-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
              />
              <ShieldCheck size={15} className="text-blue-400" />
              Verified properties only
            </label>
          </div>
        </section>

        {loadError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
            Unable to load mapped properties: {loadError}
          </div>
        )}

        {properties === null ? (
          <div className="h-[42rem] animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ) : (
          <HostelDirectoryMap properties={filteredProperties} />
        )}

        {missingCoordinateCount > 0 && (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
            {missingCoordinateCount}{' '}
            {missingCoordinateCount === 1 ? 'approved listing is' : 'approved listings are'}{' '}
            not shown because an exact map location has not yet been saved.
          </p>
        )}

        <p className="text-center text-xs leading-5 text-gray-500">
          Device location is used only to position this map during your visit. It
          is not written to the CUEAF database.
        </p>
      </div>
    </>
  );
}
