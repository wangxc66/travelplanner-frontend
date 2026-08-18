export const TOOLS = [
  {
    name: 'add_stop',
    description: 'Add a point of interest to a day in the current trip.',
    parameters: {
      type: 'object',
      properties: {
        poiId: {
          type: 'integer',
          minimum: 1,
          description: 'The point-of-interest ID to add.',
        },
        dayIndex: {
          type: 'integer',
          minimum: 1,
          description: 'The 1-based day index where the stop should be added.',
        },
      },
      required: ['poiId', 'dayIndex'],
      additionalProperties: false,
    },
  },
  {
    name: 'remove_stop',
    description: 'Remove a stop from the current trip.',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'integer',
          minimum: 1,
          description: 'The trip item ID to remove.',
        },
      },
      required: ['itemId'],
      additionalProperties: false,
    },
  },
  {
    name: 'move_stop',
    description: 'Move a stop to another day or sequence position in the current trip.',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'integer',
          minimum: 1,
          description: 'The trip item ID to move.',
        },
        dayIndex: {
          type: 'integer',
          minimum: 1,
          description: 'The 1-based destination day index.',
        },
        seq: {
          type: 'integer',
          minimum: 0,
          description:
            'The zero-based position in the destination day list; omit to append the stop to the end of the destination day.',
        },
      },
      required: ['itemId', 'dayIndex'],
      additionalProperties: false,
    },
  },
  {
    name: 'optimize_day',
    description: 'Optimize the stop order for one day in the current trip.',
    parameters: {
      type: 'object',
      properties: {
        dayIndex: {
          type: 'integer',
          minimum: 1,
          description: 'The 1-based day index to optimize.',
        },
      },
      required: ['dayIndex'],
      additionalProperties: false,
    },
  },
  {
    name: 'rebalance',
    description: 'Rebalance stops across all days in the current trip.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'toggle_lock',
    description: 'Toggle whether a stop is locked in the current trip.',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'integer',
          minimum: 1,
          description: 'The trip item ID whose lock state should be toggled.',
        },
      },
      required: ['itemId'],
      additionalProperties: false,
    },
  },
];
