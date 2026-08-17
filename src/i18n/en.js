/**
 * English copy. Keys are shared with zh.js — every key here should exist there too.
 * `{name}` placeholders are filled by the `t()` helper.
 */
const en = {
  'app.name': 'TripCanvas',
  'app.tagline': 'Plan a city, day by day.',
  'app.pitch':
    'Search places, drop them on the map, and let the planner work out the order that actually fits in a day.',

  // auth
  'auth.signIn': 'Sign in',
  'auth.createAccount': 'Create account',
  'auth.continue': 'Continue',
  'auth.username': 'Username',
  'auth.usernamePlaceholder': 'Pick anything',
  'auth.displayName': 'Display name',
  'auth.displayNamePlaceholder': 'How should we greet you?',
  'auth.password': 'Password',
  'auth.passwordPlaceholder': 'At least a few characters',
  'auth.footnote':
    'Accounts are local to your own database — pick any username. Tokyo, San Francisco and Paris are already loaded with places to plan.',
  'auth.failed': 'Could not sign you in',
  'auth.required': 'Required',
  'auth.signOut': 'Sign out',
  'auth.sessionExpired': 'Your session expired — please sign in again',

  // top bar
  'top.newTrip': 'New trip',
  'top.tripSummary': '{days} days · {stops} stops · starts {hour}:00',
  'top.tripOption': '{days} days · {stops} stops',

  // trip settings
  'settings.title': 'Trip settings',
  'settings.switch': 'Switch trip',
  'settings.length': 'Trip length (days)',
  'settings.dayStart': 'Each day starts at',
  'settings.shrinkNote':
    'Shortening a trip never deletes stops — anything past the new last day is folded into it.',

  // new trip dialog
  'newTrip.title': 'New trip',
  'newTrip.ok': 'Start planning',
  'newTrip.city': 'City',
  'newTrip.name': 'Trip name',
  'newTrip.nameHint': 'Leave blank and we will name it for you',
  'newTrip.namePlaceholder': 'Long weekend in Tokyo',
  'newTrip.days': 'How many days? (1–15)',
  'newTrip.startDate': 'Starting',
  'newTrip.defaultTitle': '{days} days in {city}',
  'newTrip.placeCount': '{count} places',

  // explore
  'explore.tab': 'Explore',
  'explore.searchPlaceholder': 'Search places, food, museums…',
  'explore.allCategories': 'All',
  'explore.searching': 'Searching…',
  'explore.count': '{count} places · adding to Day {day}',
  'explore.empty': 'Nothing matched. Try a broader word.',
  'explore.addToDay': 'Add',
  'explore.addToDayHint': 'Add to Day {day}',
  'explore.onDay': 'Day {day}',
  'explore.alreadyPlanned': 'Already planned on day {day}',
  'explore.visitMinutes': '{minutes} min',
  'explore.openAnytime': 'Open anytime',

  // itinerary
  'plan.tab': 'Itinerary',
  'plan.day': 'Day {day}',
  'plan.stops': '{count} stops',
  'plan.stops_one': '1 stop',
  'plan.optimize': 'Optimize',
  'plan.optimizeHint': 'Reorder this day for the shortest feasible route',
  'plan.rebalance': 'Rebalance',
  'plan.rebalanceHint': 'Spread stops across days so no day overflows',
  'plan.emptyDay': 'Day {day} is empty.',
  'plan.emptyDayHint': 'Search on the Explore tab and add a place to Day {day}.',
  'plan.leg': '{minutes} min · {km} km',
  'plan.visitLabel': '{minutes} min visit',
  'plan.pin': 'Pin this slot',
  'plan.unpin': 'Unpin — let Optimize move it',
  'plan.moveTo': 'Move to day {day}',
  'plan.remove': 'Remove',
  'plan.dayWindow': 'day window',
  'plan.atStops': 'at stops',
  'plan.onTheMove': 'moving',
  'plan.dayUsed': 'used',
  'plan.suggestionDo': 'Do it',
  'plan.suggestionFill': 'Fill it',
  'plan.optimized': 'Day {day} rerouted — {saved} min less travel',
  'plan.optimizedAlready': 'Day {day} is already the best order we can find',
  'plan.rebalanced': 'Stops spread across the days that had room',
  'plan.added': '{name} → Day {day}',

  // travel modes
  'mode.WALK': 'Walk',
  'mode.TRANSIT': 'Transit',
  'mode.DRIVE': 'Ride',

  // map
  'map.google': 'Google Maps',
  'map.osm': 'Open basemap',
  'map.realRoutes': 'real routes',
  'map.straightLines': 'straight-line estimates',
  'map.legendStops': 'numbered stops of day {day}',
  'map.legendRouteReal': 'routed path in visiting order',
  'map.legendRouteStraight': 'travel order',
  'map.legendCandidates': 'searchable places not yet planned',
  'map.loading': 'Loading Google Maps…',
  'map.googleFailed':
    'Google Maps failed to load with the configured key. Remove REACT_APP_GOOGLE_MAPS_API_KEY to fall back to the open basemap.',

  // categories
  'category.Landmark': 'Landmark',
  'category.Museum': 'Museum',
  'category.Park': 'Park',
  'category.Food': 'Food',
  'category.Shopping': 'Shopping',
  'category.Nightlife': 'Nightlife',
  'category.Temple': 'Temple',
  'category.Viewpoint': 'Viewpoint',

  // planner notices from the server
  'warning.opensLater': 'Arrives {wait} min before it opens at {opensAt}',
  'warning.closesEarly': 'Closes at {closesAt} — you would be cut short',
  'warning.dayRunsLate': 'This day runs until {endTime} — consider moving one stop to another day',
  'warning.travelHeavy':
    'More time on the move ({travelMinutes} min) than at the stops — try Optimize',
  'suggestion.rebalance':
    'Day {fromDay} is {deltaHours}h{deltaMinutes}m heavier than day {toDay}. Move "{name}" to day {toDay}?',
  'suggestion.emptyDay': 'Day {day} has nothing planned yet',
  'suggestion.dayPrefix': 'Day {day}',

  // server errors
  'error.usernameTaken': 'That username is taken',
  'error.badCredentials': 'Wrong username or password',
  'error.signInRequired': 'Please sign in',
  'error.cityNotFound': 'City not found',
  'error.poiNotFound': 'Place not found',
  'error.tripNotFound': 'Trip not found',
  'error.itemNotFound': 'Stop not found',
  'error.poiWrongCity': 'That place is not in {city}',
  'error.poiAlreadyPlanned': '{name} is already in this trip',
  'error.tripDaysRange': 'A trip must be between 1 and {max} days',
  'error.dayOutOfRange': 'Day {day} is outside this {numDays}-day trip',
  'error.reorderMismatch': 'Could not reorder day {day} — please refresh',
  'error.invalidRequest': 'That request was not valid',
  'error.generic': 'Something went wrong',

  // durations
  'unit.minutes': '{m}m',
  'unit.hours': '{h}h',
  'unit.hoursMinutes': '{h}h {m}m',
};

export default en;
