/**
 * Decoder for Google's encoded polyline format.
 *
 * Written by hand rather than pulled from the Maps geometry library, because the exact same route
 * geometry has to render on the Leaflet fallback basemap too — where `google.maps` does not exist.
 *
 * @param {string} encoded
 * @returns {[number, number][]} [lat, lng] pairs
 */
export function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Stitches a day into one continuous path. Legs that came back with real geometry contribute their
 * full shape; legs without it (offline estimates) contribute a straight hop to the next stop, so a
 * partially-routed day still draws as one unbroken line.
 *
 * @param {{poi: {lat: number, lng: number}, polylineFromPrev?: string}[]} stops
 * @returns {{path: [number, number][], real: boolean}}
 */
export function routePath(stops) {
  const path = [];
  let real = false;

  stops.forEach((stop, index) => {
    const here = [stop.poi.lat, stop.poi.lng];
    if (index === 0) {
      path.push(here);
      return;
    }
    const decoded = decodePolyline(stop.polylineFromPrev);
    if (decoded.length > 1) {
      real = true;
      // The leg starts at the previous stop, which is already the last point in the path.
      decoded.slice(1).forEach((point) => path.push(point));
      const last = path[path.length - 1];
      if (Math.abs(last[0] - here[0]) > 1e-4 || Math.abs(last[1] - here[1]) > 1e-4) {
        path.push(here);
      }
    } else {
      path.push(here);
    }
  });

  return { path, real };
}
