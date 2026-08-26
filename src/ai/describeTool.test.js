import { describeToolCall, findItem, toolNote } from './describeTool';
import en from '../i18n/en';

/** The same lookup chain the real `t()` walks, minus the React context. */
const t = (key, params, fallback) => {
  const template = en[key] ?? fallback ?? key;
  return params
    ? String(template).replace(/\{(\w+)\}/g, (whole, name) =>
        params[name] === undefined ? whole : String(params[name]),
      )
    : template;
};

const trip = {
  days: [
    { dayIndex: 1, items: [{ id: 41, poi: { id: 3, name: 'Senso-ji Temple' } }] },
    { dayIndex: 2, items: [{ id: 42, poi: { id: 9, name: 'teamLab Planets' } }] },
  ],
};
const pois = [
  { id: 3, name: 'Senso-ji Temple' },
  { id: 7, name: 'Shibuya Sky' },
];

describe('findItem', () => {
  it('finds an item on any day', () => {
    expect(findItem(trip, 42).poi.name).toBe('teamLab Planets');
  });

  it('answers null for an id the trip does not have', () => {
    expect(findItem(trip, 999)).toBeNull();
  });

  it('survives a trip that is missing or half-built', () => {
    expect(findItem(undefined, 1)).toBeNull();
    expect(findItem({ days: [{ dayIndex: 1 }] }, 1)).toBeNull();
  });
});

describe('describeToolCall', () => {
  it('resolves an added place from the catalog, not the trip', () => {
    const call = { name: 'add_stop', input: { poiId: 7, dayIndex: 2 } };
    expect(describeToolCall(call, trip, pois, t)).toBe('Add Shibuya Sky to day 2');
  });

  it('resolves an existing stop from the trip, by itemId not poiId', () => {
    const call = { name: 'remove_stop', input: { itemId: 42 } };
    expect(describeToolCall(call, trip, pois, t)).toBe('Remove teamLab Planets from the trip');
  });

  it('still reads as a sentence when the id matches nothing', () => {
    const call = { name: 'move_stop', input: { itemId: 999, dayIndex: 3 } };
    expect(describeToolCall(call, trip, pois, t)).toBe('Move this place to day 3');
  });

  it('describes the tools that name no place', () => {
    expect(describeToolCall({ name: 'optimize_day', input: { dayIndex: 1 } }, trip, pois, t)).toBe(
      'Reorder day 1 for the shortest route',
    );
    expect(describeToolCall({ name: 'rebalance', input: {} }, trip, pois, t)).toBe(
      'Spread stops off the days that overflow',
    );
  });

  it('falls back to the tool name for a tool it has no copy for', () => {
    const call = { name: 'teleport', input: {} };
    expect(describeToolCall(call, trip, pois, t)).toBe('Run teleport');
  });
});

describe('toolNote', () => {
  it('reports the summary of a successful call', () => {
    const message = { content: JSON.stringify({ ok: true, summary: 'Added to day 2', trip }) };
    expect(toolNote(message)).toBe('Added to day 2');
  });

  it('stays quiet about a failure — the model answers that next turn', () => {
    expect(toolNote({ content: JSON.stringify({ ok: false, reason: 'Wrong city' }) })).toBeNull();
  });

  it('stays quiet when a success carries no summary', () => {
    expect(toolNote({ content: JSON.stringify({ ok: true, trip }) })).toBeNull();
  });

  it('never throws on content that is not the JSON it expects', () => {
    expect(toolNote({ content: 'not json at all' })).toBeNull();
    expect(toolNote({ content: 'null' })).toBeNull();
    expect(toolNote({ content: '[1,2,3]' })).toBeNull();
  });
});
