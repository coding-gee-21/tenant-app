const DEFAULT_CAMPUS_LATITUDE = -0.319788;
const DEFAULT_CAMPUS_LONGITUDE = 37.660109;
const EARTH_RADIUS_KM = 6371;
const WALKING_ROUTE_FACTOR = 1.2;
const AVERAGE_WALKING_SPEED_KMH = 4.8;

function configuredCoordinate(value, fallback, minimum, maximum) {
  const coordinate = Number(value);

  return Number.isFinite(coordinate) &&
    coordinate >= minimum &&
    coordinate <= maximum
    ? coordinate
    : fallback;
}

export const CHUKA_UNIVERSITY_REFERENCE = Object.freeze({
  name: 'Chuka University Gate A',
  detail: 'Fixed walking-distance reference point',
  lat: configuredCoordinate(
    process.env.NEXT_PUBLIC_CHUKA_UNIVERSITY_LAT,
    DEFAULT_CAMPUS_LATITUDE,
    -90,
    90
  ),
  lng: configuredCoordinate(
    process.env.NEXT_PUBLIC_CHUKA_UNIVERSITY_LNG,
    DEFAULT_CAMPUS_LONGITUDE,
    -180,
    180
  ),
});

function validCoordinates(latitude, longitude) {
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

function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function straightLineDistanceKm(origin, destination) {
  const start = validCoordinates(origin?.lat, origin?.lng);
  const end = validCoordinates(destination?.lat, destination?.lng);

  if (!start || !end) return null;

  const latitudeDifference = radians(end.lat - start.lat);
  const longitudeDifference = radians(end.lng - start.lng);
  const startLatitude = radians(start.lat);
  const endLatitude = radians(end.lat);

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function estimateCampusTravel(latitude, longitude) {
  const destination = validCoordinates(latitude, longitude);
  if (!destination) return null;

  const directDistanceKm = straightLineDistanceKm(
    CHUKA_UNIVERSITY_REFERENCE,
    destination
  );

  if (!Number.isFinite(directDistanceKm)) return null;

  const distanceKm = directDistanceKm * WALKING_ROUTE_FACTOR;
  const walkingMinutes = Math.max(
    1,
    Math.round((distanceKm / AVERAGE_WALKING_SPEED_KMH) * 60)
  );

  return {
    directDistanceKm,
    distanceKm,
    walkingMinutes,
  };
}

export function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return 'Distance unavailable';

  if (distanceKm < 1) {
    return `~${Math.max(10, Math.round((distanceKm * 1000) / 10) * 10)} m`;
  }

  return `~${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

export function campusDirectionsUrl(latitude, longitude) {
  const destination = validCoordinates(latitude, longitude);
  if (!destination) return '#';

  const originValue = `${CHUKA_UNIVERSITY_REFERENCE.lat},${CHUKA_UNIVERSITY_REFERENCE.lng}`;
  const destinationValue = `${destination.lat},${destination.lng}`;

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    originValue
  )}&destination=${encodeURIComponent(
    destinationValue
  )}&travelmode=walking`;
}
