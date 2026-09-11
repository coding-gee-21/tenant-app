import AdvancedMapMarker from './AdvancedMapMarker';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_MAP_ID } from '../lib/googleMapsConfig';
import { useCallback, useState } from 'react';
import {
  GoogleMap,
  useLoadScript,
} from '@react-google-maps/api';
import {
  AlertCircle,
  Crosshair,
  MapPin,
} from 'lucide-react';

const DEFAULT_CENTER = {
  lat: -0.3325,
  lng: 37.6436,
};

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '400px',
};

const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  mapId: GOOGLE_MAPS_MAP_ID,
  colorScheme: 'DARK',
};

function coordinatesFromValue(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);

  if (
    value?.lat === null ||
    value?.lat === undefined ||
    value?.lng === null ||
    value?.lng === undefined ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return { lat, lng };
}

function CurrentLocationButton({ onLocated, onError }) {
  const [locating, setLocating] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      onError('Location services are not supported by this browser.');
      return;
    }

    setLocating(true);
    onError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocated({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        });
        setLocating(false);
      },
      () => {
        onError(
          'We could not access your location. Allow location permission or place the pin manually.'
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  return (
    <button
      type="button"
      onClick={useCurrentLocation}
      disabled={locating}
      className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-[#242427] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#303036] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Crosshair size={16} className="text-blue-400" />
      {locating ? 'Finding location...' : 'Use current location'}
    </button>
  );
}

function ManualLocationPicker({ value, onLocationSelect }) {
  const selected = coordinatesFromValue(value);
  const [latitude, setLatitude] = useState(
    selected ? String(selected.lat) : ''
  );
  const [longitude, setLongitude] = useState(
    selected ? String(selected.lng) : ''
  );
  const [locationError, setLocationError] = useState('');

  function applyCoordinates() {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      setLocationError(
        'Enter a valid latitude between -90 and 90 and longitude between -180 and 180.'
      );
      return;
    }

    setLocationError('');
    onLocationSelect({ lat, lng, accuracy: null });
  }

  function handleLocated(location) {
    setLatitude(String(location.lat));
    setLongitude(String(location.lng));
    setLocationError('');
    onLocationSelect(location);
  }

  return (
    <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3 text-sm text-amber-100">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <p>
          The interactive map needs a Google Maps browser key. You can
          still capture the hostel coordinates below.
        </p>
      </div>

      <CurrentLocationButton
        onLocated={handleLocated}
        onError={setLocationError}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-gray-300">
          Latitude
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="-0.3325"
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#18181B] px-4 py-3 text-white outline-none focus:border-blue-500"
          />
        </label>

        <label className="text-sm text-gray-300">
          Longitude
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="37.6436"
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#18181B] px-4 py-3 text-white outline-none focus:border-blue-500"
          />
        </label>
      </div>

      {locationError && (
        <p className="text-sm text-red-300">{locationError}</p>
      )}

      <button
        type="button"
        onClick={applyCoordinates}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
      >
        Save these coordinates
      </button>
    </div>
  );
}

function GoogleLocationPicker({ apiKey, value, onLocationSelect }) {
  const { isLoaded, loadError } = useLoadScript({
    id: 'chuka-rentals-google-map',
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const selected = coordinatesFromValue(value);
  const [marker, setMarker] = useState(selected);
  const [mapCenter, setMapCenter] = useState(
    selected || DEFAULT_CENTER
  );
  const [locationError, setLocationError] = useState('');

  const selectLocation = useCallback(
    (location) => {
      const coordinates = {
        lat: Number(location.lat),
        lng: Number(location.lng),
      };

      setMarker(coordinates);
      setMapCenter(coordinates);
      setLocationError('');
      onLocationSelect(location);
    },
    [onLocationSelect]
  );

  function handleMapClick(event) {
    selectLocation({
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
      accuracy: null,
    });
  }

  function handleMarkerDragEnd(event) {
    selectLocation({
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
      accuracy: null,
    });
  }

  function handleLocated(location) {
    selectLocation(location);
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
        Google Maps could not load. Check the browser API key and its
        allowed-domain restrictions.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-white/10 bg-[#121215] text-sm text-gray-400">
        Loading location map...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CurrentLocationButton
        onLocated={handleLocated}
        onError={setLocationError}
      />

      {locationError && (
        <p className="text-sm text-red-300">{locationError}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          zoom={15}
          center={mapCenter}
          onClick={handleMapClick}
          options={MAP_OPTIONS}
        >
          {marker && (
            <AdvancedMapMarker
              position={marker}
              draggable
              onDragEnd={handleMarkerDragEnd}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

export default function LocationPicker({ value, onLocationSelect }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <MapPin size={20} className="mt-0.5 shrink-0 text-blue-400" />
        <div>
          <h3 className="font-semibold text-white">
            Pinpoint the hostel location
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            Use the hostel&apos;s exact location. If you use your current
            position, make sure you are physically at the property before
            saving.
          </p>
        </div>
      </div>

      {apiKey ? (
        <GoogleLocationPicker
          apiKey={apiKey}
          value={value}
          onLocationSelect={onLocationSelect}
        />
      ) : (
        <ManualLocationPicker
          value={value}
          onLocationSelect={onLocationSelect}
        />
      )}
    </section>
  );
}
