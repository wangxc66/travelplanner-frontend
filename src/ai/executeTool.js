import {
  addItem,
  errorNotice,
  moveItem,
  optimizeDay,
  rebalance,
  removeItem,
  toggleLock,
} from '../utils';
import { TOOLS } from './tools';

const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

/**
 * Every string that leaves this file goes two places at once: back to the model, which reads it to
 * correct itself, and — for a success — onto the screen. So none of them are written here. They are
 * keys resolved through `ctx.t`, the same dictionary the rest of the product uses.
 *
 * Reference failures deliberately answer with the server's own codes. Rejecting a poiId from the
 * wrong day locally and having the server reject it remotely should not produce two different
 * sentences, and the dictionary already had every one of them.
 */

function fail(reason) {
  return { ok: false, reason };
}

function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * English on purpose, and the only string still written here: a ctx without a translator is our own
 * wiring mistake, not something a traveller can act on or a model can correct.
 */
function validateTranslator(ctx) {
  if (!isPlainObject(ctx) || typeof ctx.t !== 'function') {
    return 'The assistant is wired up wrong: ctx must be { tripId, trip, pois, t }.';
  }
  return null;
}

function validateSchema(tool, input, t) {
  if (!isPlainObject(input)) {
    return t('assistant.check.argsNotObject');
  }

  const { properties, required } = tool.parameters;
  const unexpected = Object.keys(input).find((key) => !has(properties, key));
  if (unexpected) {
    return t('assistant.check.unexpectedParam', { param: unexpected, tool: tool.name });
  }

  const missing = required.find((key) => !has(input, key));
  if (missing) {
    return t('assistant.check.missingParam', { param: missing });
  }

  for (const [key, value] of Object.entries(input)) {
    const schema = properties[key];
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      return t('assistant.check.notInteger', { param: key });
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      return t('assistant.check.belowMinimum', { param: key, min: schema.minimum });
    }
  }

  return null;
}

/**
 * Every one of these means the same thing to the only two readers there are: the app's own state is
 * not something a tool can act on. Which field is malformed matters to whoever is debugging, and to
 * nobody else, so it is one sentence rather than eight.
 */
function validateContext(ctx) {
  const usable =
    Number.isInteger(ctx.tripId) &&
    ctx.tripId >= 1 &&
    isPlainObject(ctx.trip) &&
    Number.isInteger(ctx.trip.numDays) &&
    ctx.trip.numDays >= 1 &&
    Array.isArray(ctx.trip.days) &&
    ctx.trip.days.every((day) => isPlainObject(day) && Array.isArray(day.items)) &&
    Array.isArray(ctx.pois);
  return usable ? null : ctx.t('assistant.check.tripUnusable');
}

function tripItems(trip) {
  return trip.days.flatMap((day) => day.items);
}

/** The model will name ids that do not exist. Catch them here rather than sending the request. */
function validateContextAndReferences(name, input, ctx) {
  const { t } = ctx;

  if (has(input, 'dayIndex') && input.dayIndex > ctx.trip.numDays) {
    return t('error.dayOutOfRange', { day: input.dayIndex, numDays: ctx.trip.numDays });
  }

  const items = tripItems(ctx.trip);
  if (has(input, 'itemId') && !items.some((item) => item?.id === input.itemId)) {
    return t('error.itemNotFound');
  }

  if (name === 'add_stop') {
    const poi = ctx.pois.find((candidate) => candidate?.id === input.poiId);
    if (!poi) {
      return t('error.poiNotFound');
    }
    if (items.some((item) => item?.poi?.id === input.poiId || item?.poiId === input.poiId)) {
      return t('error.poiAlreadyPlanned', { name: poi.name });
    }
  }

  return null;
}

/** One line, never a stack: whatever the failure was, the model should not be reading our source. */
function safeMessage(message) {
  if (typeof message !== 'string') return null;
  const firstLine = message.split(/\r?\n/).find((line) => line.trim());
  return firstLine?.trim() || null;
}

function backendFailure(error, t) {
  let reason = null;
  try {
    const { code, params, message } = errorNotice(error);
    // `error.generic` is what errorNotice falls back to when the server sent no code at all. Its
    // translation says "something went wrong", which the model cannot correct itself from; the
    // server's own words, when there are any, are worth more.
    reason =
      !code || code === 'error.generic'
        ? safeMessage(message) || t('error.generic')
        : t(code, params, safeMessage(message));
  } catch {
    reason = null;
  }
  return fail(reason || t('assistant.check.toolFailed'));
}

async function callTool(name, input, tripId) {
  switch (name) {
    case 'add_stop':
      return addItem(tripId, { poiId: input.poiId, dayIndex: input.dayIndex });
    case 'remove_stop':
      return removeItem(tripId, input.itemId);
    case 'move_stop':
      return moveItem(tripId, input.itemId, {
        dayIndex: input.dayIndex,
        ...(input.seq === undefined ? {} : { seq: input.seq }),
      });
    case 'optimize_day':
      return optimizeDay(tripId, input.dayIndex);
    case 'rebalance':
      return rebalance(tripId);
    case 'toggle_lock':
      return toggleLock(tripId, input.itemId);
    default:
      return null;
  }
}

export async function executeTool(name, input, ctx) {
  const wiringError = validateTranslator(ctx);
  if (wiringError) return fail(wiringError);

  const { t } = ctx;

  const tool = TOOL_BY_NAME.get(name);
  if (!tool) {
    return fail(t('assistant.check.unknownTool', { name: String(name) }));
  }

  const schemaError = validateSchema(tool, input, t);
  if (schemaError) return fail(schemaError);

  const contextError = validateContext(ctx);
  if (contextError) return fail(contextError);

  const referenceError = validateContextAndReferences(name, input, ctx);
  if (referenceError) return fail(referenceError);

  try {
    const updatedTrip = await callTool(name, input, ctx.tripId);
    return { ok: true, trip: updatedTrip, summary: t(`assistant.done.${name}`, input) };
  } catch (error) {
    return backendFailure(error, t);
  }
}
