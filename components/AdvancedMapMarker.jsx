import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

export default function AdvancedMapMarker({ position, draggable = false, onDragEnd }) {
  const map = useGoogleMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const marker = new google.maps.marker.AdvancedMarkerElement({ map });
    markerRef.current = marker;

    return () => {
      marker.map = null;
      markerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!markerRef.current) return;
    markerRef.current.position = position;
    markerRef.current.gmpDraggable = draggable;
  }, [map, position, draggable]);

  useEffect(() => {
    if (!markerRef.current || !onDragEnd) return;
    const listener = markerRef.current.addListener('dragend', onDragEnd);
    return () => listener.remove();
  }, [map, onDragEnd]);

  return null;
}
