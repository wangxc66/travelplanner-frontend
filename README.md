# TripCanvas — frontend

Plan a city trip day by day, on one screen: search places, drop them on the map, drag them between
days, and let the planner reorder each day. This repository is the UI; the service it talks to
is **[travelplanner](https://github.com/wangxc66/travelplanner)** — start that first.

React single-page planner. Same stack shape as the staybooking / twitch / nextai frontends: Create
React App, antd, axios, `proxy` to the Spring Boot service on `:8080`.

## Run

```bash
npm install && npm start
```

Opens `http://localhost:3000`. Start the backend first — `/api` and `/auth` are proxied to `:8080`.
Create an account with any username; the New trip dialog opens by itself when you have no trips yet.

## Google Maps

Two independent things need a key, and the badge in the top-right of the map states both:

**The basemap** — Google Maps when `REACT_APP_GOOGLE_MAPS_API_KEY` is set, otherwise OpenStreetMap
tiles via Leaflet. Both render identical overlays, so the product is fully demonstrable before anyone
provisions Maps billing.

```bash
cp .env.example .env
# set REACT_APP_GOOGLE_MAPS_API_KEY=... then restart npm start
```

**The route geometry** — this comes from the *backend*, not the browser, so the server key is never
exposed and every route is cached once for all users. Legs arrive with an encoded polyline that
`src/polyline.js` decodes into the real street path; the backend gets it from Google when a key is set
and from OSRM otherwise, so **real routes are the out-of-the-box default and need no key at all**.

The two are orthogonal — Google basemap with OSRM routes, or OSM basemap with Google routes, are both
valid states. The badge names the basemap and says whether the lines are real routes or straight-line
estimates.

## The workflow it is built around

Everything happens on one screen, because the point of the product is the loop between searching,
placing and looking at the map:

1. **Explore** — search the POI database for the trip's city, filter by the category chips, **Add**
   to drop a place onto the day you are building.
2. **Itinerary** — a timeline of the day: day tabs with a load bar each, drag a stop's numbered
   badge to reorder inside a day, drag it onto another day's tab to move it there, pin a stop so
   Optimize leaves it alone.
3. **Optimize** — reorders the day for the shortest route that still respects opening hours.
4. **Rebalance** — moves stops off days that overflow onto days that have room.
5. Each leg shows its travel time and distance, plus Uber / Lyft deep links for that exact hop.

## Languages

**EN / 中文**, switchable from the top bar and from the auth card, applied instantly with no reload and
remembered in `localStorage`. A first visit follows the browser's own language preference.

`src/i18n/` holds the whole of the product's copy: `en.js` and `zh.js` are flat dictionaries with
identical key sets, and `t(key, params, fallback)` interpolates `{placeholders}`. Switching also swaps
antd's own locale (date picker, modal buttons, `Empty`) and dayjs's, which is where the weekday names
come from.

Server-sent messages — timing warnings, rebalance suggestions, API errors — arrive as
`{code, params}` and are rendered here, so they switch language along with everything else. A code with
no translation falls back to the English text the server sent, then to the other dictionary, then to the
key: a missing string degrades to readable text rather than to a blank.

Place names and descriptions are catalog **data**, not copy, so they stay as stored. Localising those
means adding `name_zh` / `description_zh` to the `poi` table and selecting per request.

## Shape

```
src/i18n/                     en.js + zh.js dictionaries, provider and t() helper
src/api.js                    axios client, JWT interceptor, one function per endpoint
src/constants.js              category colours, travel modes, ride-hail deep links
src/App.js                    shell + all state; every mutation swaps in the trip the server returns
src/components/AuthPage       sign in / register
src/components/ExplorePanel   database-backed POI search
src/components/ItineraryPanel day pills, dnd-kit sortable stops, timeline, suggestions
src/components/NewTripModal   city + length (1–15 days) + start date
src/components/map/           MapCanvas picks GoogleMapCanvas or OsmMapCanvas; identical overlays
```

State lives in one place on purpose: every mutating API call returns the whole recomputed trip, so the
panel, the timeline and the map can never disagree with each other.
