const http = require('node:http');

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

function toOpenAITools(tools) {
  return tools.map(({ name, description, parameters }) => ({
    type: 'function',
    function: { name, description, parameters },
  }));
}

function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function invalidToolArguments() {
  const error = new Error('OpenAI returned invalid tool arguments.');
  error.status = 502;
  return error;
}

function invalidOpenAIResponse() {
  const error = new Error('OpenAI returned an invalid response.');
  error.status = 502;
  return error;
}

function requestBodyTooLarge() {
  const error = new Error('Request body too large.');
  error.status = 413;
  return error;
}

function parseToolInput(argumentsJson) {
  let input;
  try {
    input = JSON.parse(argumentsJson);
  } catch {
    throw invalidToolArguments();
  }
  if (!isPlainObject(input)) {
    throw invalidToolArguments();
  }
  return input;
}

function isToolCall(call) {
  return (
    isPlainObject(call) &&
    typeof call.id === 'string' &&
    typeof call.name === 'string' &&
    isPlainObject(call.input)
  );
}

function isMessage(message) {
  if (!isPlainObject(message)) return false;
  if (message.role === 'user') return typeof message.content === 'string';
  if (message.role === 'tool') {
    return typeof message.toolCallId === 'string' && typeof message.content === 'string';
  }
  if (message.role === 'assistant') {
    return (
      (message.content === null || typeof message.content === 'string') &&
      Array.isArray(message.toolCalls) &&
      message.toolCalls.every(isToolCall)
    );
  }
  return false;
}

function isTool(tool) {
  return (
    isPlainObject(tool) &&
    typeof tool.name === 'string' &&
    typeof tool.description === 'string' &&
    isPlainObject(tool.parameters)
  );
}

function isValidRequest(body) {
  return (
    isPlainObject(body) &&
    typeof body.system === 'string' &&
    Array.isArray(body.messages) &&
    body.messages.every(isMessage) &&
    Array.isArray(body.tools) &&
    body.tools.every(isTool)
  );
}

function toOpenAIRequest(model, body) {
  const request = {
    model,
    messages: toOpenAIMessages(body.system, body.messages),
  };
  if (body.tools.length) {
    request.tools = toOpenAITools(body.tools);
  }
  return request;
}

function configFromEnv(env) {
  return {
    apiKey: env.OPENAI_API_KEY || '',
    host: env.HOST || '127.0.0.1',
    model: env.OPENAI_MODEL || 'gpt-5.5',
    port: Number(env.PORT) || 5001,
  };
}

function toOpenAIMessages(system, messages) {
  return [
    { role: 'system', content: system },
    ...messages.map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: message.toolCallId,
          content: message.content,
        };
      }
      if (message.role === 'assistant' && message.toolCalls?.length) {
        return {
          role: 'assistant',
          content: message.content ?? null,
          tool_calls: message.toolCalls.map(({ id, name, input }) => ({
            id,
            type: 'function',
            function: { name, arguments: JSON.stringify(input) },
          })),
        };
      }
      return { role: message.role, content: message.content };
    }),
  ];
}

function fromOpenAICompletion(completion) {
  if (!isPlainObject(completion) || !Array.isArray(completion.choices)) {
    throw invalidOpenAIResponse();
  }
  const message = completion.choices[0]?.message;
  if (!isPlainObject(message)) {
    throw invalidOpenAIResponse();
  }

  const text = message.content ?? null;
  if (text !== null && typeof text !== 'string') {
    throw invalidOpenAIResponse();
  }
  const openAIToolCalls = message.tool_calls === undefined ? [] : message.tool_calls;
  if (!Array.isArray(openAIToolCalls)) {
    throw invalidOpenAIResponse();
  }

  return {
    text,
    toolCalls: openAIToolCalls.map((call) => {
      if (
        !isPlainObject(call) ||
        typeof call.id !== 'string' ||
        !isPlainObject(call.function) ||
        typeof call.function.name !== 'string' ||
        typeof call.function.arguments !== 'string'
      ) {
        throw invalidOpenAIResponse();
      }
      const input = parseToolInput(call.function.arguments);
      return { id: call.id, name: call.function.name, input };
    }),
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytesRead = 0;
    let settled = false;

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.on('error', rejectOnce);
    request.on('data', (chunk) => {
      if (settled) return;
      bytesRead += chunk.length;
      if (bytesRead > MAX_REQUEST_BODY_BYTES) {
        chunks.length = 0;
        rejectOnce(requestBodyTooLarge());
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });

    const contentLength = Number(request.headers['content-length']);
    if (Number.isSafeInteger(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
      request.resume();
      rejectOnce(requestBodyTooLarge());
    }
  });
}

function createRelayServer({ apiKey, model, createCompletion }) {
  return http.createServer(async (request, response) => {
    if (request.url !== '/api/ai/chat') {
      sendJson(response, 404, { message: 'Not found.' });
      return;
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { message: 'Method not allowed.' });
      return;
    }
    if (!apiKey) {
      sendJson(response, 503, {
        message: 'OPENAI_API_KEY is not configured on the server.',
      });
      return;
    }

    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      if (error?.status === 413) {
        sendJson(response, 413, { message: 'Request body too large.' });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { message: 'Invalid JSON body.' });
        return;
      }
      sendJson(response, 400, { message: 'Could not read request body.' });
      return;
    }

    try {
      if (!isValidRequest(body)) {
        sendJson(response, 400, { message: 'Invalid request body.' });
        return;
      }
      const completion = await createCompletion(toOpenAIRequest(model, body));
      sendJson(response, 200, fromOpenAICompletion(completion));
    } catch (error) {
      const status =
        Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
          ? error.status
          : 502;
      sendJson(response, status, { message: 'OpenAI request failed.' });
    }
  });
}

module.exports = {
  configFromEnv,
  createRelayServer,
  fromOpenAICompletion,
  isValidRequest,
  toOpenAIMessages,
  toOpenAIRequest,
  toOpenAITools,
};

if (require.main === module) {
  const path = require('node:path');
  require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

  const { apiKey, host, model, port } = configFromEnv(process.env);
  let createCompletion;
  if (apiKey) {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey });
    createCompletion = (request) => client.chat.completions.create(request);
  }

  createRelayServer({ apiKey, model, createCompletion }).listen(port, host, () => {
    console.log(`TripCanvas AI relay listening on port ${port}.`);
  });
}
