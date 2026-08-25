/**
 * A2: Turn the current TripDto + full city POI list into a readable LLM context.
 *
 * Contract: buildContext(trip, pois, t) -> string
 * A2 owns this file. B2 can reuse it later when the write-capable assistant is added.
 */

function formatPoiHours(poi, t) {
  if (!poi) return '';
  if (poi.alwaysOpen) return t('explore.openAnytime');
  return poi.openLabel || t('assistant.notAvailable');
}

function warningText(warning, t) {
  if (!warning) return '';
  return t(warning.code, warning.params, warning.code);
}

function formatDayHeader(day) {
  const date = day.date ? ` (${day.date})` : '';
  const window = day.endTime ? `${day.startTime || '--:--'}–${day.endTime}` : `${day.startTime || '--:--'}–`;
  return `## Day ${day.dayIndex}${date} · ${window} · load ${day.loadPercent}%`;
}

function clockToMinutes(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatScheduledItem(item, t) {
  const lines = [];
  const poi = item.poi;
  const arrive = clockToMinutes(item.arriveTime);
  const leave = clockToMinutes(item.leaveTime);
  const visitMinutes = arrive != null && leave != null ? Math.max(0, leave - arrive) : null;

  lines.push(`  ${item.seq + 1}. ${poi?.name || t('assistant.unknownPlace')} itemId=${item.id} poiId=${poi?.id ?? 'unknown'}`);
  lines.push(`     Arrive: ${item.arriveTime || '--:--'} · Leave: ${item.leaveTime || '--:--'}`);
  lines.push(`     Visit duration: ${visitMinutes != null ? `${visitMinutes} min` : t('assistant.notAvailable')}`);

  if (item.travelMinutesFromPrev > 0 || item.travelKmFromPrev > 0) {
    lines.push(
      `     From previous stop: ${item.travelMinutesFromPrev} min · ${Number(item.travelKmFromPrev || 0).toFixed(1)} km`,
    );
  }

  if (item.locked) {
    lines.push(`     [locked]`);
  }

  if (item.warnings?.length) {
    for (const warning of item.warnings) {
      lines.push(`     Warning: ${warningText(warning, t)}`);
    }
  }

  return lines;
}

function formatUnscheduledPoi(poi, t) {
  const hours = formatPoiHours(poi, t);
  return (
    `  poiId=${poi.id} ${poi.name} | ${poi.category || t('assistant.notAvailable')} | ` +
    `rating ${Number(poi.rating || 0).toFixed(1)} | visit ${poi.avgVisitMinutes || 0} min | ` +
    `hours ${hours} | ${poi.description || ''}`
  );
}

export function buildContext(trip, pois = [], t) {
  if (!trip) {
    return '# Current trip\nNo trip is currently open.';
  }

  const plannedPoiIds = new Set();
  const lines = [];

  lines.push('# Current trip');
  lines.push(`Title: ${trip.title || t('assistant.untitledTrip')}`);
  lines.push(
    `City: ${trip.city?.name || t('assistant.unknownCity')}${trip.city?.country ? ` (${trip.city.country})` : ''}`,
  );
  lines.push(
    `Start date: ${trip.startDate || t('assistant.notAvailable')} · ${trip.numDays} days · default day start ${trip.dayStartHour}:00`,
  );
  lines.push(`Default travel mode: ${trip.defaultMode || t('assistant.notAvailable')}`);
  lines.push(`Planned stops: ${trip.plannedCount}`);
  lines.push('');

  for (const day of trip.days || []) {
    for (const item of day.items || []) {
      if (item.poi?.id != null) plannedPoiIds.add(item.poi.id);
    }

    lines.push(formatDayHeader(day));
    lines.push(`   Visit: ${day.visitMinutes} min · Travel: ${day.travelMinutes} min · Total: ${day.totalMinutes} min`);

    if (!day.items?.length) {
      lines.push(`   ${t('assistant.emptyDay')}`);
    } else {
      for (const item of day.items) {
        lines.push(...formatScheduledItem(item, t));
      }
    }

    if (day.warnings?.length) {
      lines.push('   Day warnings:');
      for (const warning of day.warnings) {
        lines.push(`   - ${warningText(warning, t)}`);
      }
    }

    lines.push('');
  }

  if (trip.suggestions?.length) {
    lines.push('# Planner suggestions');
    for (const suggestion of trip.suggestions) {
      const text = t(suggestion.code, suggestion.params, suggestion.code);
      lines.push(`- ${text}`);
    }
    lines.push('');
  }

  const unscheduled = (pois || []).filter((poi) => !plannedPoiIds.has(poi.id));
  lines.push(`# ${trip.city?.name || 'Current city'} places not yet planned`);
  if (!unscheduled.length) {
    lines.push(`- ${t('assistant.noUnscheduledPlaces')}`);
  } else {
    for (const poi of unscheduled) {
      lines.push(formatUnscheduledPoi(poi, t));
    }
  }

  return lines.join('\n');
}
