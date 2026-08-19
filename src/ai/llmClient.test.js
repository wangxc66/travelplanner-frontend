import { ask } from './llmClient';

afterEach(() => {
  jest.restoreAllMocks();
});

test('ask posts the frozen contract and returns text with parsed tool calls', async () => {
  expect(typeof ask).toBe('function');

  const request = {
    system: 'Keep it short.',
    messages: [{ role: 'user', content: 'Add the museum.' }],
    tools: [{ name: 'add_stop', description: 'Add a stop.', parameters: { type: 'object' } }],
  };
  const reply = {
    text: 'I can add it.',
    toolCalls: [{ id: 'call_123', name: 'add_stop', input: { poiId: 7, dayIndex: 2 } }],
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(reply),
  });

  const result = await ask(request);

  expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  expect(result).toEqual(reply);
});

test('ask throws an error with status and message for a relay failure', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
    json: jest.fn().mockResolvedValue({ message: 'OPENAI_API_KEY is not configured.' }),
  });

  await expect(ask({ system: '', messages: [], tools: [] })).rejects.toMatchObject({
    status: 503,
    message: 'OPENAI_API_KEY is not configured.',
  });
});

test('ask preserves the HTTP status when an error response is not JSON', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 502,
    json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token <')),
  });

  await expect(ask({ system: '', messages: [], tools: [] })).rejects.toMatchObject({
    status: 502,
    message: 'AI relay request failed with HTTP 502.',
  });
});

test('ask rejects a successful response that does not match the public reply contract', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ text: 'Missing toolCalls.' }),
  });

  await expect(ask({ system: '', messages: [], tools: [] })).rejects.toMatchObject({
    status: 502,
    message: 'AI relay returned an invalid response.',
  });
});

test('ask rejects tool call input that is still a JSON string', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({
      text: null,
      toolCalls: [{ id: 'call_123', name: 'add_stop', input: '{"poiId":7,"dayIndex":2}' }],
    }),
  });

  await expect(ask({ system: '', messages: [], tools: [] })).rejects.toMatchObject({
    status: 502,
    message: 'AI relay returned an invalid response.',
  });
});

test('ask rejects a non-string non-null text field', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ text: 42, toolCalls: [] }),
  });

  await expect(ask({ system: '', messages: [], tools: [] })).rejects.toMatchObject({
    status: 502,
    message: 'AI relay returned an invalid response.',
  });
});

test('ask adds status to a network error', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));

  await expect(ask({ system: '', messages: [], tools: [] })).rejects.toMatchObject({
    status: 0,
    message: 'Failed to fetch',
  });
});
