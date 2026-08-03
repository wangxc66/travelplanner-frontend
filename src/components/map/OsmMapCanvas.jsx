import React, { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { categoryStyle } from '../../constants';

const stopIcon = (label) =>
  L.divIcon({
    className: 'stop-pin',
    html: `<div class="stop-marker"><span>${label}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 24],
  });

const candidateIcon = (color) =>
  L.divIcon({
    className: 'cand-pin',
    html: `<div class="cand-marker" style="background:${color}"></div>`,
    iconSize: [13, 13],
    iconAnchor: [7, 7],
  });

function ViewController({ center, zoom, bounds, fitKey, focus }) {
  const map = useMap();

  // Leaflet caches its pixel size at init. If the pane is ever resized by layout — not just by a
  // window resize, which Leaflet handles itself — the cached size makes fitBounds pick a wrong zoom.
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (bounds && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
    } else if (bounds && bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id]);

  return null;
}

/**
 * Keyless fallback basemap. Renders exactly the same overlay language as the Google canvas —
 * numbered route pins, the day polyline, and unplanned candidates — so the product is fully
 * demonstrable before anyone provisions a Maps billing account.
 */
export default function OsmMapCanvas({ center, zoom, stops, candidates, focus, onPoiClick, fitKey, path }) {
  const line = useMemo(() => (path?.length ? path : stops.map((s) => [s.poi.lat, s.poi.lng])), [path, stops]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
      />
      <ViewController center={center} zoom={zoom} bounds={line} fitKey={fitKey} focus={focus} />

      {candidates.map((poi) => (
        <Marker
          key={`c-${poi.id}`}
          position={[poi.lat, poi.lng]}
          icon={candidateIcon(categoryStyle(poi.category).color)}
          eventHandlers={{ click: () => onPoiClick?.(poi) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {categoryStyle(poi.category).icon} {poi.name}
          </Tooltip>
        </Marker>
      ))}

      {line.length > 1 && (
        <Polyline positions={line} pathOptions={{ color: '#ff6b35', weight: 4, opacity: 0.85 }} />
      )}

      {stops.map((stop, index) => (
        <Marker
          key={`s-${stop.id}`}
          position={[stop.poi.lat, stop.poi.lng]}
          icon={stopIcon(index + 1)}
          zIndexOffset={500}
          eventHandlers={{ click: () => onPoiClick?.(stop.poi) }}
        >
          <Tooltip direction="top" offset={[0, -22]}>
            <b>
              {index + 1}. {stop.poi.name}
            </b>
            <br />
            {stop.arriveTime} – {stop.leaveTime}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
