/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import {
  BadgeCheck,
  Building2,
  Clock3,
  Crosshair,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  School,
} from 'lucide-react';
import AdvancedMapMarker from './AdvancedMapMarker';
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_MAP_ID,
} from '../lib/googleMapsConfig';
import {
  campusDirectionsUrl,
  CHUKA_UNIVERSITY_REFERENCE,
  estimateCampusTravel,
  formatDistance,
} from '../lib/campusDistance';
import { propertyLocationLabel } from '../lib/hostelSearchConfig';

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
};

function coordinatesFor(property) {
  const lat = Number(property?.latitude);
  const lng = Number(property?.longitude);

  if (
    property?.latitude === null ||
    property?.latitude === undefined ||
    property?.longitude === null ||
    property?.longitude === undefined ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
}

function propertyRent(property) {
  return Number(
    property.semester_rent ?? property.price ?? property.rent ?? 0
  );
}

function propertyImage(property) {
  let path = '';

  if (Array.isArray(property.images)) {
    path = property.images.find(
      (image) => typeof image === 'string' && image.trim()
    );
  } else if (typeof property.images === 'string' && property.images.trim()) {
    try {
      const parsed = JSON.parse(property.images);
      path = Array.isArray(parsed) ? parsed[0] : property.images;
    } catch {
      path = property.images;
    }
  }

  path = path || property.image || property.image_url || '';

  if (!path || typeof path !== 'string') {
    return '/cueaf-housing-mark.png';
  }

  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:')
  ) {
    return path;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/property-images/${path.replace(
        /^\/+/,
        ''
      )}`
    : path;
}

function directionsUrl(property) {
  return campusDirectionsUrl(property.latitude, property.longitude);
}

function isVerified(property) {
  return (
    (property.is_verified === true ||
      property.verification_status === 'verified') &&
    !property.is_flagged &&
    !property.flagged &&
    property.status !== 'flagged'
  );
}

function HostelCard({ property, selected, onSelect }) {
  const availableRooms = Number(property.vacant_rooms ?? 0);
  const travel = estimateCampusTravel(
    property.latitude,
    property.longitude
  );
  const locationLabel = propertyLocationLabel(property);

  return (
    <article
      className={`overflow-hidden rounded-2xl border transition ${
        selected
          ? 'border-amber-400/70 bg-amber-400/5 shadow-lg shadow-amber-950/20'
          : 'border-white/10 bg-[#18181B] hover:border-blue-500/40'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="grid w-full grid-cols-[6rem_minmax(0,1fr)] gap-3 p-3 text-left"
        aria-pressed={selected}
        aria-label={`Show ${property.title || 'this hostel'} on the map`}
      >
        <span className="h-24 overflow-hidden rounded-xl bg-[#0d1117]">
          <img
            src={propertyImage(property)}
            alt=""
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = '/cueaf-housing-mark.png';
              event.currentTarget.className =
                'h-full w-full bg-white/5 object-contain p-2';
            }}
          />
        </span>

        <span className="min-w-0">
          <span className="flex items-start justify-between gap-2">
            <strong className="line-clamp-2 text-sm text-white">
              {property.title || 'Untitled hostel'}
            </strong>
            {isVerified(property) && (
              <BadgeCheck
                size={17}
                className="shrink-0 text-emerald-400"
                aria-label="Verified property"
              />
            )}
          </span>

          <span className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <MapPin size={13} className="shrink-0 text-blue-400" />
            <span className="truncate">
              {locationLabel}
            </span>
          </span>

          <span className="mt-2 block text-sm font-bold text-emerald-400">
            KSh {propertyRent(property).toLocaleString()}
            <span className="font-normal text-gray-500"> / semester</span>
          </span>

          {travel && (
            <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-blue-200">
              <span className="inline-flex items-center gap-1">
                <Route size={13} className="text-blue-400" />
                {formatDistance(travel.distanceKm)} from campus
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 size={13} className="text-amber-400" />
                ~{travel.walkingMinutes} min walk
              </span>
            </span>
          )}

          <span
            className={`mt-1 block text-xs ${
              availableRooms > 0 ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {availableRooms > 0
              ? `${availableRooms} ${
                  availableRooms === 1 ? 'room' : 'rooms'
                } available`
              : 'Ask landlord about availability'}
          </span>
        </span>
      </button>

      <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
        <Link
          href={`/properties/${property.id}`}
          className="rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          View details
        </Link>
        <a
          href={directionsUrl(property)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
        >
          <Navigation size={13} />
          Directions
        </a>
      </div>
    </article>
  );
}

function MapUnavailable({ message }) {
  return (
    <div className="flex h-full min-h-[32rem] flex-col items-center justify-center bg-[#101013] p-8 text-center">
      <MapPin size={36} className="text-blue-400" />
      <h2 className="mt-4 text-lg font-bold text-white">
        Interactive map unavailable
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-gray-400">
        {message}
      </p>
      <p className="mt-4 text-xs text-gray-500">
        Hostel details and Google Maps directions remain available in the list.
      </p>
    </div>
  );
}

function GoogleHostelMap({
  apiKey,
  properties,
  selectedId,
  focusId,
  onSelect,
}) {
  const { isLoaded, loadError } = useLoadScript({
    id: 'chuka-rentals-google-map',
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [map, setMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);

  const fitAllProperties = useCallback(() => {
    if (!map || !properties.length || !window.google?.maps) return;

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(CHUKA_UNIVERSITY_REFERENCE);
    properties.forEach((property) => {
      const coordinates = coordinatesFor(property);
      if (coordinates) bounds.extend(coordinates);
    });

    map.fitBounds(bounds, 70);
  }, [map, properties]);

  useEffect(() => {
    fitAllProperties();
  }, [fitAllProperties]);

  useEffect(() => {
    if (!map || !focusId) return;

    const focusedProperty = properties.find(
      (property) => property.id === focusId
    );
    const coordinates = coordinatesFor(focusedProperty);
    if (!coordinates) return;

    map.panTo(coordinates);
    map.setZoom(17);
  }, [focusId, map, properties]);

  function selectProperty(property) {
    const coordinates = coordinatesFor(property);
    onSelect(property.id);
    if (!map || !coordinates) return;
    map.panTo(coordinates);
    map.setZoom(17);
  }

  function locateStudent() {
    if (!navigator.geolocation) {
      setLocationMessage('This browser does not support location services.');
      return;
    }

    setLocating(true);
    setLocationMessage('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(coordinates);
        map?.panTo(coordinates);
        map?.setZoom(16);
        setLocationMessage(
          'Your position is shown temporarily and is not saved by CUEAF.'
        );
        setLocating(false);
      },
      (error) => {
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. You can still select a hostel and open directions.'
            : 'Your position could not be found. Check location services and try again.'
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }

  if (loadError) {
    return (
      <MapUnavailable message="Google Maps could not load. Confirm the API key, Map ID and allowed website domains." />
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[32rem] items-center justify-center bg-[#101013] text-sm text-gray-400">
        Loading hostel map...
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[32rem]">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={CHUKA_UNIVERSITY_REFERENCE}
        zoom={14}
        onLoad={setMap}
        onUnmount={() => setMap(null)}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
          mapId: GOOGLE_MAPS_MAP_ID,
          colorScheme: 'DARK',
          clickableIcons: false,
        }}
      >
        <AdvancedMapMarker
          position={CHUKA_UNIVERSITY_REFERENCE}
          title="Chuka University campus reference point"
          variant="campus"
        />

        {properties.map((property, index) => (
          <AdvancedMapMarker
            key={property.id}
            position={coordinatesFor(property)}
            title={property.title || 'Hostel'}
            label={String(index + 1)}
            selected={selectedId === property.id}
            onClick={() => selectProperty(property)}
          />
        ))}

        {userLocation && (
          <AdvancedMapMarker
            position={userLocation}
            title="Your approximate position"
            variant="user"
          />
        )}
      </GoogleMap>

      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
        <button
          type="button"
          onClick={locateStudent}
          disabled={locating}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#101013]/95 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md transition hover:bg-[#1f2937] disabled:opacity-60"
        >
          <Crosshair size={15} className="text-emerald-400" />
          {locating ? 'Finding you...' : 'Use my location'}
        </button>

        <button
          type="button"
          onClick={fitAllProperties}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#101013]/95 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md transition hover:bg-[#1f2937]"
        >
          <LocateFixed size={15} className="text-blue-400" />
          Show all hostels
        </button>
      </div>

      <div className="absolute bottom-3 right-3 z-10 hidden rounded-xl border border-white/10 bg-[#101013]/95 px-3 py-2 text-[11px] text-gray-200 shadow-xl backdrop-blur-md sm:flex sm:items-center sm:gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Chuka University
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          Hostel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Your position
        </span>
      </div>

      {locationMessage && (
        <div className="absolute bottom-3 left-3 right-3 z-10 rounded-xl border border-white/10 bg-[#101013]/95 px-4 py-3 text-xs text-gray-200 shadow-xl backdrop-blur-md">
          {locationMessage}
        </div>
      )}
    </div>
  );
}

export default function HostelDirectoryMap({ properties }) {
  const [selectedId, setSelectedId] = useState(properties[0]?.id ?? null);
  const [focusId, setFocusId] = useState(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const activeSelectedId = properties.some(
    (property) => property.id === selectedId
  )
    ? selectedId
    : properties[0]?.id ?? null;

  const selectedProperty = useMemo(
    () =>
      properties.find((property) => property.id === activeSelectedId) ?? null,
    [activeSelectedId, properties]
  );
  const selectedTravel = selectedProperty
    ? estimateCampusTravel(
        selectedProperty.latitude,
        selectedProperty.longitude
      )
    : null;

  if (!properties.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#18181B] p-12 text-center">
        <Building2 size={36} className="mx-auto text-blue-400" />
        <h2 className="mt-4 text-lg font-bold text-white">
          No mapped hostels match these filters
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Clear one or more filters or check again after landlords add locations.
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#121215] shadow-2xl shadow-black/20">
      <div className="grid min-h-[42rem] lg:grid-cols-[23rem_minmax(0,1fr)]">
        <div className="order-2 border-t border-white/10 lg:order-1 lg:border-r lg:border-t-0">
          <div className="border-b border-white/10 p-4">
            <p className="text-sm font-semibold text-white">
              {properties.length}{' '}
              {properties.length === 1 ? 'mapped hostel' : 'mapped hostels'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Select a card to highlight its map pin.
            </p>
          </div>

          <div className="max-h-[38rem] space-y-3 overflow-y-auto p-3">
            {properties.map((property) => (
              <HostelCard
                key={property.id}
                property={property}
                selected={property.id === activeSelectedId}
                onSelect={() => {
                  setSelectedId(property.id);
                  setFocusId(property.id);
                }}
              />
            ))}
          </div>
        </div>

        <div className="order-1 min-h-[32rem] lg:order-2 lg:min-h-[42rem]">
          {apiKey ? (
            <GoogleHostelMap
              apiKey={apiKey}
              properties={properties}
              selectedId={activeSelectedId}
              focusId={focusId}
              onSelect={setSelectedId}
            />
          ) : (
            <MapUnavailable message="The Google Maps browser key has not been configured for this deployment." />
          )}
        </div>
      </div>

      {selectedProperty && (
        <div className="flex flex-col gap-3 border-t border-white/10 bg-blue-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              Selected: {selectedProperty.title || 'Hostel'}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <School size={13} className="text-red-400" />
                Route starts at Chuka University
              </span>
              {selectedTravel && (
                <span>
                  {formatDistance(selectedTravel.distanceKm)} · approximately{' '}
                  {selectedTravel.walkingMinutes} minutes walking
                </span>
              )}
            </div>
          </div>

          <a
            href={directionsUrl(selectedProperty)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500"
          >
            <ExternalLink size={16} />
            Campus-to-hostel directions
          </a>
        </div>
      )}

      <div className="border-t border-white/10 bg-[#0f1013] px-4 py-3 text-xs leading-5 text-gray-500">
        Distances and walking times are coordinate-based estimates. Paths,
        gates and road access can change the actual journey; use Google Maps
        directions and verify the route in person.
      </div>
    </section>
  );
}
