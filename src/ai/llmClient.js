function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export async function ask({ system, messages, tools }) {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, messages, tools }),
    });

    let body;
    try {
      body = await response.json();
    } catch {
      const error = new Error(
        response.ok
          ? 'AI relay returned an invalid response.'
          : `AI relay request failed with HTTP ${response.status}.`
      );
      error.status = response.ok ? 502 : response.status;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(body?.message || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const validToolCalls =
      Array.isArray(body?.toolCalls) &&
      body.toolCalls.every(
        (call) =>
          isPlainObject(call) &&
          typeof call.id === 'string' &&
          typeof call.name === 'string' &&
          isPlainObject(call.input)
      );
    const validText = body?.text === null || typeof body?.text === 'string';
    if (!validText || !validToolCalls) {
      const error = new Error('AI relay returned an invalid response.');
      error.status = 502;
      throw error;
    }

    return body;
  } catch (error) {
    if (!Number.isInteger(error?.status)) {
      error.status = 0;
    }
    throw error;
  }
}
