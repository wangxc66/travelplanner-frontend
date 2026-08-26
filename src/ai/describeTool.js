/**
 * Turning a tool call and its result into something a traveller can read.
 *
 * Kept out of the panel because this is where the mistakes are: an id that matches nothing, a
 * result that is not the shape it claims. Both answer with null rather than with a broken sentence.
 */

/** Every id the model may name comes from the trip, so a lookup that fails means the model erred. */
export function findItem(trip, itemId) {
  for (const day of trip?.days ?? []) {
    const found = day.items?.find((item) => item.id === itemId);
    if (found) return found;
  }
  return null;
}

/**
 * What the traveller is about to approve, in their own language. The tool layer speaks in ids, and
 * a card reading "add poiId 3 to day 2" asks someone to approve a number.
 */
export function describeToolCall(call, trip, pois, t) {
  const input = call?.input ?? {};
  const place =
    call?.name === 'add_stop'
      ? (pois ?? []).find((poi) => poi.id === input.poiId)?.name
      : findItem(trip, input.itemId)?.poi?.name;
  const params = { ...input, name: call?.name, place: place || t('assistant.thisPlace') };
  return t(`assistant.tool.${call?.name}`, params, t('assistant.tool.unknown', params));
}

/**
 * A tool result is JSON on its way back to the model. Only a success is worth a line of its own:
 * the model answers the next turn holding the failure reason, and a cancellation already has
 * useAssistant's own message behind it — reporting either here would say the same thing twice.
 */
export function toolNote(message) {
  try {
    const result = JSON.parse(message.content);
    return result?.ok ? result.summary || null : null;
  } catch {
    return null;
  }
}
