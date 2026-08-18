import { TOOLS } from './tools';

const expected = {
  add_stop: { required: ['poiId', 'dayIndex'], minimums: { poiId: 1, dayIndex: 1 } },
  remove_stop: { required: ['itemId'], minimums: { itemId: 1 } },
  move_stop: { required: ['itemId', 'dayIndex'], minimums: { itemId: 1, dayIndex: 1, seq: 0 } },
  optimize_day: { required: ['dayIndex'], minimums: { dayIndex: 1 } },
  rebalance: { required: [], minimums: {} },
  toggle_lock: { required: ['itemId'], minimums: { itemId: 1 } },
};

test('exports all six tool names exactly once', () => {
  const names = TOOLS.map((tool) => tool.name);
  expect(names).toEqual(Object.keys(expected));
  expect(new Set(names).size).toBe(names.length);
});

test('forbids additional properties for every tool', () => {
  TOOLS.forEach((tool) => {
    expect(tool.parameters.additionalProperties).toBe(false);
  });
});

test('never exposes tripId as a model parameter', () => {
  TOOLS.forEach((tool) => {
    expect(tool.parameters.properties).not.toHaveProperty('tripId');
  });
});

test('declares the required minimum for every numeric parameter', () => {
  TOOLS.forEach((tool) => {
    Object.entries(expected[tool.name].minimums).forEach(([parameter, minimum]) => {
      expect(tool.parameters.properties[parameter]).toMatchObject({ type: 'integer', minimum });
    });
  });
});

test('declares the exact required fields for every tool', () => {
  TOOLS.forEach((tool) => {
    expect(tool.parameters.required).toEqual(expected[tool.name].required);
  });
});
