import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

export default function AdvancedMapMarker({
  position,
  draggable = false,
  onDragEnd,
  onClick,
  title = 'Map location',
  selected = false,
  variant = 'property',
  label = '',
}) {
  const map = useGoogleMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      title,
    });

    markerRef.current = marker;

    return () => {
      marker.map = null;
      markerRef.current = null;
    };
  }, [map, title]);

  useEffect(() => {
    if (!markerRef.current) return;

    markerRef.current.position = position;
    markerRef.current.gmpDraggable = draggable;
  }, [map, position, draggable]);

  useEffect(() => {
    if (!markerRef.current) return;

    const isUserMarker = variant === 'user';
    const isCampusMarker = variant === 'campus';

    const pin = new google.maps.marker.PinElement({
      background: isUserMarker
        ? '#10b981'
        : isCampusMarker
          ? '#dc2626'
          : selected
            ? '#f59e0b'
            : '#2563eb',

      borderColor:
        selected || isCampusMarker ? '#fef3c7' : '#dbeafe',

      glyphText: isUserMarker
        ? '●'
        : isCampusMarker
          ? 'CU'
          : label,

      glyphColor: '#ffffff',

      scale: selected
        ? 1.25
        : isCampusMarker
          ? 1.2
          : isUserMarker
            ? 1.1
            : 1,
    });

    // Google Maps v3.66 accepts PinElement directly.
    markerRef.current.content = pin;

    markerRef.current.zIndex = selected
      ? 20
      : isCampusMarker
        ? 18
        : isUserMarker
          ? 15
          : 10;
  }, [label, selected, variant]);

  useEffect(() => {
    if (!markerRef.current || !onDragEnd) return;

    const marker = markerRef.current;

    const handleDragEnd = () => {
      const markerPosition = marker.position;
      if (!markerPosition) return;

      const latitude =
        typeof markerPosition.lat === 'function'
          ? markerPosition.lat()
          : markerPosition.lat;

      const longitude =
        typeof markerPosition.lng === 'function'
          ? markerPosition.lng()
          : markerPosition.lng;

      onDragEnd({
        latLng: new google.maps.LatLng(
          Number(latitude),
          Number(longitude)
        ),
      });
    };

    marker.addEventListener('gmp-dragend', handleDragEnd);

    return () => {
      marker.removeEventListener('gmp-dragend', handleDragEnd);
    };
  }, [map, onDragEnd]);

  useEffect(() => {
    if (!markerRef.current || !onClick) return;

    const marker = markerRef.current;

    marker.gmpClickable = true;
    marker.addEventListener('gmp-click', onClick);

    return () => {
      marker.removeEventListener('gmp-click', onClick);
      marker.gmpClickable = false;
    };
  }, [map, onClick]);

  return null;
}