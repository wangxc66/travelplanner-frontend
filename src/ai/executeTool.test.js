import {
  addItem,
  errorNotice,
  moveItem,
  optimizeDay,
  rebalance,
  removeItem,
  toggleLock,
} from '../utils';
import { executeTool } from './executeTool';

jest.mock('../utils', () => ({
  addItem: jest.fn(),
  errorNotice: jest.fn(),
  moveItem: jest.fn(),
  optimizeDay: jest.fn(),
  rebalance: jest.fn(),
  removeItem: jest.fn(),
  toggleLock: jest.fn(),
}));

const trip = {
  id: 999,
  numDays: 2,
  days: [
    { dayIndex: 1, items: [{ id: 11, poi: { id: 101, name: 'Existing' } }] },
    { dayIndex: 2, items: [{ id: 12, poi: { id: 303, name: 'Other' } }] },
  ],
};
const pois = [
  { id: 101, name: 'Existing' },
  { id: 202, name: 'New place' },
  { id: 303, name: 'Other' },
];
const ctx = { tripId: 77, trip, pois };
const updatedTrip = { ...trip, title: 'Updated trip' };
const apiMocks = [addItem, removeItem, moveItem, optimizeDay, rebalance, toggleLock];

function expectNoApiCalls() {
  apiMocks.forEach((mock) => expect(mock).not.toHaveBeenCalled());
}

function expectValidationFailure(result) {
  expect(result.ok).toBe(false);
  expect(typeof result.reason).toBe('string');
  expect(result.reason.trim()).not.toBe('');
  expectNoApiCalls();
}

beforeEach(() => {
  jest.resetAllMocks();
  apiMocks.forEach((mock) => mock.mockResolvedValue(updatedTrip));
});

test('add_stop calls addItem with ctx.tripId and the exact body', async () => {
  const result = await executeTool('add_stop', { poiId: 202, dayIndex: 2 }, ctx);

  expect(addItem).toHaveBeenCalledWith(77, { poiId: 202, dayIndex: 2 });
  expect(result).toEqual(expect.objectContaining({ ok: true, trip: updatedTrip }));
});

test('remove_stop calls removeItem with ctx.tripId', async () => {
  await executeTool('remove_stop', { itemId: 11 }, ctx);

  expect(removeItem).toHaveBeenCalledWith(77, 11);
});

test('move_stop calls moveItem and omits seq when it was not provided', async () => {
  await executeTool('move_stop', { itemId: 11, dayIndex: 2 }, ctx);

  expect(moveItem).toHaveBeenCalledWith(77, 11, { dayIndex: 2 });
});

test('move_stop passes an explicitly provided seq to moveItem', async () => {
  await executeTool('move_stop', { itemId: 11, dayIndex: 2, seq: 0 }, ctx);

  expect(moveItem).toHaveBeenCalledWith(77, 11, { dayIndex: 2, seq: 0 });
});

test('optimize_day calls optimizeDay with ctx.tripId', async () => {
  await executeTool('optimize_day', { dayIndex: 2 }, ctx);

  expect(optimizeDay).toHaveBeenCalledWith(77, 2);
});

test('rebalance calls rebalance with ctx.tripId', async () => {
  await executeTool('rebalance', {}, ctx);

  expect(rebalance).toHaveBeenCalledWith(77);
});

test('toggle_lock calls toggleLock with ctx.tripId', async () => {
  await executeTool('toggle_lock', { itemId: 12 }, ctx);

  expect(toggleLock).toHaveBeenCalledWith(77, 12);
});

test('an unknown tool is rejected without calling an API', async () => {
  const result = await executeTool('delete_trip', {}, ctx);

  expectValidationFailure(result);
});

test.each([null, [], 'not-an-object'])('rejects non-object input %#', async (input) => {
  const result = await executeTool('rebalance', input, ctx);

  expectValidationFailure(result);
});

test('rejects extra fields, including a model-provided tripId', async () => {
  const extra = await executeTool('rebalance', { extra: true }, ctx);
  expectValidationFailure(extra);

  const injectedTrip = await executeTool('add_stop', { poiId: 202, dayIndex: 1, tripId: 1234 }, ctx);
  expectValidationFailure(injectedTrip);
});

test.each([
  ['add_stop without poiId', 'add_stop', { dayIndex: 1 }],
  ['move_stop without dayIndex', 'move_stop', { itemId: 11 }],
  ['remove_stop without itemId', 'remove_stop', {}],
])('rejects missing required fields: %s', async (_label, name, input) => {
  const result = await executeTool(name, input, ctx);

  expectValidationFailure(result);
});

test.each([
  ['poiId zero', 'add_stop', { poiId: 0, dayIndex: 1 }],
  ['poiId negative', 'add_stop', { poiId: -1, dayIndex: 1 }],
  ['poiId decimal', 'add_stop', { poiId: 1.5, dayIndex: 1 }],
  ['itemId zero', 'remove_stop', { itemId: 0 }],
  ['itemId negative', 'remove_stop', { itemId: -1 }],
  ['itemId decimal', 'remove_stop', { itemId: 1.5 }],
])('rejects invalid IDs: %s', async (_label, name, input) => {
  const result = await executeTool(name, input, ctx);

  expectValidationFailure(result);
});

test('rejects dayIndex outside ctx.trip.numDays', async () => {
  const result = await executeTool('optimize_day', { dayIndex: 3 }, ctx);

  expectValidationFailure(result);
});

test('rejects an itemId that does not exist in the trip', async () => {
  const result = await executeTool('remove_stop', { itemId: 999 }, ctx);

  expectValidationFailure(result);
});

test('rejects a poiId that does not exist in ctx.pois', async () => {
  const result = await executeTool('add_stop', { poiId: 999, dayIndex: 1 }, ctx);

  expectValidationFailure(result);
});

test('rejects a poiId that is already planned in the trip', async () => {
  const result = await executeTool('add_stop', { poiId: 101, dayIndex: 1 }, ctx);

  expectValidationFailure(result);
});

test.each([-1, 1.5])('rejects invalid seq %p', async (seq) => {
  const result = await executeTool('move_stop', { itemId: 11, dayIndex: 2, seq }, ctx);

  expectValidationFailure(result);
});

test.each([
  ['null ctx', null],
  ['invalid tripId', { ...ctx, tripId: 0 }],
  ['missing trip', { tripId: 77, pois }],
  ['missing numDays', { ...ctx, trip: { days: trip.days } }],
  ['invalid numDays', { ...ctx, trip: { ...trip, numDays: 0 } }],
  ['decimal numDays', { ...ctx, trip: { ...trip, numDays: 1.5 } }],
  ['missing days', { ...ctx, trip: { id: trip.id, numDays: trip.numDays } }],
  ['non-array days', { ...ctx, trip: { ...trip, days: {} } }],
  ['non-object day', { ...ctx, trip: { ...trip, days: [null] } }],
  ['missing day items', { ...ctx, trip: { ...trip, days: [{ dayIndex: 1 }] } }],
  ['non-array day items', { ...ctx, trip: { ...trip, days: [{ dayIndex: 1, items: {} }] } }],
  ['missing pois', { tripId: 77, trip }],
  ['non-array pois', { ...ctx, pois: {} }],
])('rejects invalid context before rebalance: %s', async (_label, invalidCtx) => {
  const result = await executeTool('rebalance', {}, invalidCtx);

  expectValidationFailure(result);
});

test('returns the complete trip object from a successful API call', async () => {
  const result = await executeTool('optimize_day', { dayIndex: 1 }, ctx);

  expect(result).toEqual({
    ok: true,
    trip: updatedTrip,
    summary: expect.any(String),
  });
  expect(result.trip).toBe(updatedTrip);
  expect(ctx.trip).toBe(trip);
});

test('uses errorNotice and converts backend errors to a readable failure', async () => {
  const error = new Error('raw backend error');
  addItem.mockRejectedValue(error);
  errorNotice.mockReturnValue({
    code: 'error.poiWrongCity',
    params: { city: '东京' },
    message: 'raw backend error',
  });

  const result = await executeTool('add_stop', { poiId: 202, dayIndex: 1 }, ctx);

  expect(errorNotice).toHaveBeenCalledWith(error);
  expect(result).toEqual({ ok: false, reason: '这个景点不在东京。' });
});

test('does not leak a JavaScript stack in a failure reason', async () => {
  removeItem.mockRejectedValue(new Error('request failed'));
  errorNotice.mockReturnValue({
    code: 'error.unknown',
    params: {},
    message: '请求失败\n    at executeTool (executeTool.js:1:1)',
  });

  const result = await executeTool('remove_stop', { itemId: 11 }, ctx);

  expect(result.ok).toBe(false);
  expect(result.reason).toBe('请求失败');
  expect(result.reason).not.toContain('executeTool.js');
  expect(result.reason).not.toContain('\n');
});
