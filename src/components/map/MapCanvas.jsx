import React, { useMemo } from 'react';
import GoogleMapCanvas from './GoogleMapCanvas';
import OsmMapCanvas from './OsmMapCanvas';
import { GOOGLE_MAPS_KEY } from '../../constants';
import { routePath } from '../../polyline';
import { useI18n } from '../../i18n';

/**
 * One overlay language, two basemaps. Google Maps is the product's intended canvas; when no API key
 * is configured we render the identical overlays on an open basemap so nothing about the workflow is
 * unavailable during a demo.
 *
 * The route geometry comes from the backend either way — it is decoded here, once, and handed to
 * whichever canvas is active.
 */
export default function MapCanvas(props) {
  const { t } = useI18n();
  const useGoogle = Boolean(GOOGLE_MAPS_KEY);
  const Impl = useGoogle ? GoogleMapCanvas : OsmMapCanvas;
  const { path, real } = useMemo(() => routePath(props.stops), [props.stops]);

  return (
    <>
      <Impl {...props} path={path} />
      <div className="map-badge">
        {useGoogle ? t('map.google') : t('map.osm')}
        {' · '}
        {real ? t('map.realRoutes') : t('map.straightLines')}
      </div>
      <div className="map-legend">
        <div>
          <b style={{ color: '#3b6cff' }}>●</b> {t('map.legendStops', { day: props.dayIndex })}
        </div>
        <div>
          <b style={{ color: '#ff6b35' }}>▬</b>{' '}
          {real ? t('map.legendRouteReal') : t('map.legendRouteStraight')}
        </div>
        <div>
          <b style={{ color: '#94a3b8' }}>●</b> {t('map.legendCandidates')}
        </div>
      </div>
    </>
  );
}
