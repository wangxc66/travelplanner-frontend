const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const test = require('node:test');
const relay = require('./index');

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function postChunkedJson(origin, chunks) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      `${origin}/api/ai/chat`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (response) => {
        const responseChunks = [];
        response.on('data', (chunk) => responseChunks.push(chunk));
        response.on('end', () => {
          resolve({
            body: JSON.parse(Buffer.concat(responseChunks).toString('utf8')),
            status: response.statusCode,
          });
        });
      }
    );
    request.on('error', reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

test('wraps vendor-neutral tools in the Chat Completions function shape', () => {
  assert.equal(typeof relay.toOpenAITools, 'function');

  const tools = [
    {
      name: 'move_stop',
      description: 'Move a stop.',
      parameters: {
        type: 'object',
        properties: { itemId: { type: 'integer' } },
        required: ['itemId'],
        additionalProperties: false,
      },
    },
  ];

  assert.deepEqual(relay.toOpenAITools(tools), [
    {
      type: 'function',
      function: {
        name: 'move_stop',
        description: 'Move a stop.',
        parameters: {
          type: 'object',
          properties: { itemId: { type: 'integer' } },
          required: ['itemId'],
          additionalProperties: false,
        },
      },
    },
  ]);
});

test('replays tool history with JSON arguments and the original tool call id', () => {
  assert.equal(typeof relay.toOpenAIMessages, 'function');

  const messages = relay.toOpenAIMessages('Use the available trip tools.', [
    { role: 'user', content: 'Move the museum.' },
    {
      role: 'assistant',
      content: 'I will move it.',
      toolCalls: [
        { id: 'call_abc', name: 'move_stop', input: { itemId: 11, dayIndex: 2 } },
      ],
    },
    { role: 'tool', toolCallId: 'call_abc', content: '{"ok":true}' },
  ]);

  assert.deepEqual(messages, [
    { role: 'system', content: 'Use the available trip tools.' },
    { role: 'user', content: 'Move the museum.' },
    {
      role: 'assistant',
      content: 'I will move it.',
      tool_calls: [
        {
          id: 'call_abc',
          type: 'function',
          function: {
            name: 'move_stop',
            arguments: '{"itemId":11,"dayIndex":2}',
          },
        },
      ],
    },
    { role: 'tool', tool_call_id: 'call_abc', content: '{"ok":true}' },
  ]);
});

test('parses completion text and function arguments into the public reply contract', () => {
  assert.equal(typeof relay.fromOpenAICompletion, 'function');

  const reply = relay.fromOpenAICompletion({
    id: 'chatcmpl_123',
    choices: [
      {
        index: 0,
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: 'I can make that change.',
          refusal: null,
          annotations: [],
          tool_calls: [
            {
              id: 'call_abc',
              type: 'function',
              function: {
                name: 'add_stop',
                arguments: '{"poiId":7,"dayIndex":2}',
              },
            },
          ],
        },
      },
    ],
  });

  assert.deepEqual(reply, {
    text: 'I can make that change.',
    toolCalls: [
      { id: 'call_abc', name: 'add_stop', input: { poiId: 7, dayIndex: 2 } },
    ],
  });
  assert.equal(Object.getPrototypeOf(reply.toolCalls[0].input), Object.prototype);
});

test('rejects function arguments that do not parse to a plain object', () => {
  assert.throws(
    () =>
      relay.fromOpenAICompletion({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_bad',
                  type: 'function',
                  function: { name: 'rebalance', arguments: '[]' },
                },
              ],
            },
          },
        ],
      }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.message, 'OpenAI returned invalid tool arguments.');
      return true;
    }
  );
});

test('turns malformed function argument JSON into a safe relay error', () => {
  assert.throws(
    () =>
      relay.fromOpenAICompletion({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_bad_json',
                  type: 'function',
                  function: { name: 'add_stop', arguments: '{bad json' },
                },
              ],
            },
          },
        ],
      }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.message, 'OpenAI returned invalid tool arguments.');
      return true;
    }
  );
});

test('rejects an upstream reply whose text is not a string or null', () => {
  assert.throws(
    () =>
      relay.fromOpenAICompletion({
        choices: [{ message: { content: 42, tool_calls: [] } }],
      }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.message, 'OpenAI returned an invalid response.');
      return true;
    }
  );
});

test('rejects malformed upstream tool call containers and metadata', () => {
  const invalidMessages = [
    { content: null, tool_calls: {} },
    {
      content: null,
      tool_calls: [
        {
          id: 42,
          type: 'function',
          function: { name: 'add_stop', arguments: '{"poiId":7,"dayIndex":2}' },
        },
      ],
    },
    {
      content: null,
      tool_calls: [
        {
          id: 'call_bad_name',
          type: 'function',
          function: { name: 42, arguments: '{"poiId":7,"dayIndex":2}' },
        },
      ],
    },
  ];

  for (const message of invalidMessages) {
    assert.throws(
      () => relay.fromOpenAICompletion({ choices: [{ message }] }),
      (error) => {
        assert.equal(error.status, 502);
        assert.equal(error.message, 'OpenAI returned an invalid response.');
        return true;
      }
    );
  }
});

test('returns a clear 503 response when the server API key is missing', async (t) => {
  assert.equal(typeof relay.createRelayServer, 'function');

  const server = relay.createRelayServer({ apiKey: '', model: 'gpt-5.5' });
  t.after(() => close(server));
  const origin = await listen(server);
  const response = await fetch(`${origin}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: '请用一句话回答。',
      messages: [{ role: 'user', content: '你好' }],
      tools: [],
    }),
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    message: 'OPENAI_API_KEY is not configured on the server.',
  });
});

test('rejects a request whose top-level contract fields have the wrong types', () => {
  assert.equal(typeof relay.isValidRequest, 'function');
  assert.equal(
    relay.isValidRequest({ system: 'Answer briefly.', messages: {}, tools: [] }),
    false
  );
  assert.equal(
    relay.isValidRequest({ system: 'Answer briefly.', messages: [], tools: null }),
    false
  );
});

test('rejects malformed message and tool entries before provider conversion', () => {
  assert.equal(
    relay.isValidRequest({
      system: 'Answer briefly.',
      messages: [
        {
          role: 'assistant',
          content: null,
          toolCalls: [{ id: 'call_1', name: 'add_stop', input: '{"poiId":7}' }],
        },
      ],
      tools: [],
    }),
    false
  );
  assert.equal(
    relay.isValidRequest({
      system: 'Answer briefly.',
      messages: [],
      tools: [{ name: 'add_stop', description: 'Add a stop.' }],
    }),
    false
  );
});

test('omits the OpenAI tools field for a tier-one request with tools empty', () => {
  assert.equal(typeof relay.toOpenAIRequest, 'function');
  assert.deepEqual(
    relay.toOpenAIRequest('gpt-5.5', {
      system: 'Answer briefly.',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [],
    }),
    {
      model: 'gpt-5.5',
      messages: [
        { role: 'system', content: 'Answer briefly.' },
        { role: 'user', content: 'Hello' },
      ],
    }
  );
});

test('exposes only POST /api/ai/chat', async (t) => {
  const server = relay.createRelayServer({
    apiKey: 'test-key',
    model: 'test-model',
    createCompletion: async () => {
      throw new Error('The provider must not be called for an invalid route.');
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);

  const wrongMethod = await fetch(`${origin}/api/ai/chat`);
  assert.equal(wrongMethod.status, 405);
  assert.deepEqual(await wrongMethod.json(), { message: 'Method not allowed.' });

  const wrongPath = await fetch(`${origin}/api/not-ai`, { method: 'POST' });
  assert.equal(wrongPath.status, 404);
  assert.deepEqual(await wrongPath.json(), { message: 'Not found.' });
});

test('returns 400 before calling OpenAI for an invalid request body', async (t) => {
  const server = relay.createRelayServer({
    apiKey: 'test-key',
    model: 'test-model',
    createCompletion: async () => {
      throw new Error('The provider must not be called for invalid input.');
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);
  const response = await fetch(`${origin}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: 'Answer briefly.', messages: {}, tools: [] }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'Invalid request body.' });
});

test('returns 400 for malformed request JSON', async (t) => {
  const server = relay.createRelayServer({
    apiKey: 'test-key',
    model: 'test-model',
    createCompletion: async () => {
      throw new Error('The provider must not be called for malformed JSON.');
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);
  const response = await fetch(`${origin}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'Invalid JSON body.' });
});

test('returns 413 when the streamed request body exceeds one MiB', async (t) => {
  const server = relay.createRelayServer({
    apiKey: 'test-key',
    model: 'test-model',
    createCompletion: async () => {
      throw new Error('The provider must not be called for an oversized request.');
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);
  const response = await fetch(`${origin}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: 'a'.repeat(1024 * 1024),
      messages: [],
      tools: [],
    }),
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { message: 'Request body too large.' });
});

test('returns 413 for an oversized chunked body without Content-Length', async (t) => {
  const server = relay.createRelayServer({
    apiKey: 'test-key',
    model: 'test-model',
    createCompletion: async () => {
      throw new Error('The provider must not be called for an oversized chunked request.');
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);
  const body = JSON.stringify({
    system: 'a'.repeat(1024 * 1024),
    messages: [],
    tools: [],
  });
  const response = await postChunkedJson(origin, [body.slice(0, 700000), body.slice(700000)]);

  assert.equal(response.status, 413);
  assert.deepEqual(response.body, { message: 'Request body too large.' });
});

test('preserves an OpenAI HTTP status while replacing its message with a safe one', async (t) => {
  const secret = 'fake-secret-value';
  const server = relay.createRelayServer({
    apiKey: secret,
    model: 'test-model',
    createCompletion: async () => {
      const error = new Error(`Upstream rejected ${secret}`);
      error.status = 429;
      throw error;
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);
  const response = await fetch(`${origin}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: 'Answer briefly.',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [],
    }),
  });
  const responseText = await response.text();

  assert.equal(response.status, 429);
  assert.deepEqual(JSON.parse(responseText), { message: 'OpenAI request failed.' });
  assert.equal(responseText.includes(secret), false);
});

test('uses safe relay configuration defaults and allows explicit host override', () => {
  assert.equal(typeof relay.configFromEnv, 'function');
  assert.deepEqual(relay.configFromEnv({}), {
    apiKey: '',
    host: '127.0.0.1',
    model: 'gpt-5.5',
    port: 5001,
  });
  assert.deepEqual(
    relay.configFromEnv({
      OPENAI_API_KEY: 'test-key',
      HOST: '0.0.0.0',
      OPENAI_MODEL: 'gpt-test',
      PORT: '5050',
    }),
    {
      apiKey: 'test-key',
      host: '0.0.0.0',
      model: 'gpt-test',
      port: 5050,
    }
  );
});

test('the executable entrypoint starts without a key', async (t) => {
  const port = 45000 + (process.pid % 10000);
  const child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: { ...process.env, OPENAI_API_KEY: '', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const outcome = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve('timeout'), 2000);
    child.stdout.on('data', () => {
      if (stdout.includes(`listening on port ${port}`)) {
        clearTimeout(timeout);
        resolve('started');
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      resolve(`exit:${code}`);
    });
  });

  assert.equal(outcome, 'started', `stdout=${stdout}\nstderr=${stderr}`);
});

test('relays a valid request and returns the stable public reply', async (t) => {
  let providerRequest;
  const createCompletion = async (request) => {
    providerRequest = request;
    return {
      id: 'chatcmpl_456',
      choices: [
        {
          index: 0,
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: 'I will add it.',
            refusal: null,
            annotations: [],
            tool_calls: [
              {
                id: 'call_keep_me',
                type: 'function',
                function: {
                  name: 'add_stop',
                  arguments: '{"poiId":7,"dayIndex":2}',
                },
              },
            ],
          },
        },
      ],
    };
  };
  const server = relay.createRelayServer({
    apiKey: 'test-key',
    model: 'test-model',
    createCompletion,
  });
  t.after(() => close(server));
  const origin = await listen(server);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 250);
  let response;
  try {
    response = await fetch(`${origin}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        system: 'Answer briefly.',
        messages: [{ role: 'user', content: 'Add the museum.' }],
        tools: [
          {
            name: 'add_stop',
            description: 'Add a stop.',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        ],
      }),
    });
  } catch (error) {
    response = { status: error.name };
  } finally {
    clearTimeout(timeout);
  }

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    text: 'I will add it.',
    toolCalls: [
      { id: 'call_keep_me', name: 'add_stop', input: { poiId: 7, dayIndex: 2 } },
    ],
  });
  assert.deepEqual(providerRequest, {
    model: 'test-model',
    messages: [
      { role: 'system', content: 'Answer briefly.' },
      { role: 'user', content: 'Add the museum.' },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'add_stop',
          description: 'Add a stop.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
    ],
  });
});
