import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { Spin } from 'antd';
import { categoryStyle, GOOGLE_MAPS_KEY } from '../../constants';
import { useI18n } from '../../i18n';

const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  clickableIcons: false,
  styles: [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  ],
};

/** Teardrop pin as a data URI so the numbered label sits inside the marker itself. */
function pinIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 39C15 39 28 24.5 28 14.5A13 13 0 1 0 2 14.5C2 24.5 15 39 15 39Z"
            fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(30, 40),
    anchor: new window.google.maps.Point(15, 39),
    labelOrigin: new window.google.maps.Point(15, 15),
  };
}

function dotIcon(color) {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 6,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  };
}

export default function GoogleMapCanvas({ center, zoom, stops, candidates, focus, onPoiClick, fitKey, path }) {
  const { t } = useI18n();
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'tripcanvas-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_KEY,
  });
  const mapRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  // The routed geometry when the backend has it, otherwise stop-to-stop.
  const line = useMemo(
    () =>
      path?.length
        ? path.map(([lat, lng]) => ({ lat, lng }))
        : stops.map((s) => ({ lat: s.poi.lat, lng: s.poi.lng })),
    [path, stops],
  );

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || line.length === 0) return;
    if (line.length === 1) {
      mapRef.current.setCenter(line[0]);
      mapRef.current.setZoom(14);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    line.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    if (!mapRef.current || !focus) return;
    mapRef.current.panTo({ lat: focus.lat, lng: focus.lng });
    if (mapRef.current.getZoom() < 15) mapRef.current.setZoom(15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id]);

  if (loadError) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
        {t('map.googleFailed')}
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Spin tip={t('map.loading')} />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ height: '100%', width: '100%' }}
      center={{ lat: center.lat, lng: center.lng }}
      zoom={zoom}
      options={MAP_OPTIONS}
      onLoad={onLoad}
    >
      {candidates.map((poi) => (
        <MarkerF
          key={`c-${poi.id}`}
          position={{ lat: poi.lat, lng: poi.lng }}
          icon={dotIcon(categoryStyle(poi.category).color)}
          onClick={() => onPoiClick?.(poi)}
          onMouseOver={() => setHovered({ poi })}
          onMouseOut={() => setHovered(null)}
        />
      ))}

      {line.length > 1 && (
        <PolylineF
          path={line}
          options={{ strokeColor: '#ff6b35', strokeWeight: 4, strokeOpacity: 0.85, geodesic: false }}
        />
      )}

      {stops.map((stop, index) => (
        <MarkerF
          key={`s-${stop.id}`}
          position={{ lat: stop.poi.lat, lng: stop.poi.lng }}
          icon={pinIcon('#3b6cff')}
          label={{ text: String(index + 1), color: '#ffffff', fontSize: '12px', fontWeight: '700' }}
          zIndex={500}
          onClick={() => onPoiClick?.(stop.poi)}
          onMouseOver={() => setHovered({ poi: stop.poi, stop, index })}
          onMouseOut={() => setHovered(null)}
        />
      ))}

      {hovered && (
        <InfoWindowF
          position={{ lat: hovered.poi.lat, lng: hovered.poi.lng }}
          options={{ disableAutoPan: true, pixelOffset: new window.google.maps.Size(0, -34) }}
        >
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <b>
              {hovered.index !== undefined ? `${hovered.index + 1}. ` : ''}
              {hovered.poi.name}
            </b>
            <br />
            {hovered.stop
              ? `${hovered.stop.arriveTime} – ${hovered.stop.leaveTime}`
              : hovered.poi.alwaysOpen
                ? t('explore.openAnytime')
                : hovered.poi.openLabel}
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}
