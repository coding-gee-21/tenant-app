import AdvancedMapMarker from './AdvancedMapMarker';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_MAP_ID } from '../lib/googleMapsConfig';
import { useMemo } from 'react';
import {
  GoogleMap,
  useLoadScript,
} from '@react-google-maps/api';
import {
  ExternalLink,
  MapPin,
  Navigation,
} from 'lucide-react';

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '320px',
};

function getCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
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

function LocationActions({ coordinates }) {
  const destination = `${coordinates.lat},${coordinates.lng}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}`;
  const locationUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    destination
  )}`;

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500"
      >
        <Navigation size={17} />
        Get directions
      </a>

      <a
        href={locationUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        <ExternalLink size={16} />
        Open location
      </a>
    </div>
  );
}

function MapFallback({ coordinates }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#121215] p-6 text-center">
      <MapPin size={30} className="text-blue-400" />
      <p className="mt-3 font-semibold text-white">
        Hostel location is available
      </p>
      <p className="mt-1 max-w-md text-sm leading-6 text-gray-400">
        The embedded preview needs a configured Google Maps browser key.
        Directions still work using the saved hostel coordinates.
      </p>
      <p className="mt-3 font-mono text-xs text-gray-500">
        {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
      </p>
    </div>
  );
}

function GooglePropertyMap({ apiKey, coordinates }) {
  const { isLoaded, loadError } = useLoadScript({
    id: 'chuka-rentals-google-map',
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const options = useMemo(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      mapId: GOOGLE_MAPS_MAP_ID,
      colorScheme: 'DARK',
    }),
    []
  );

  if (loadError) return <MapFallback coordinates={coordinates} />;

  if (!isLoaded) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-white/10 bg-[#121215] text-sm text-gray-400">
        Loading location map...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        zoom={16}
        center={coordinates}
        options={options}
      >
        <AdvancedMapMarker position={coordinates} />
      </GoogleMap>
    </div>
  );
}

export default function PropertyMapViewer({ latitude, longitude }) {
  const coordinates = getCoordinates(latitude, longitude);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!coordinates) return null;

  return (
    <div className="space-y-4">
      {apiKey ? (
        <GooglePropertyMap
          apiKey={apiKey}
          coordinates={coordinates}
        />
      ) : (
        <MapFallback coordinates={coordinates} />
      )}

      <LocationActions coordinates={coordinates} />

      <p className="text-xs leading-5 text-gray-500">
        Directions open in Google Maps using the hostel as the destination.
        Chuka Rentals does not store the student&apos;s live location.
      </p>
    </div>
  );
}
