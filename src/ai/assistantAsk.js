/**
 * Temporary A2 adapter used until A1's real src/ai/llmClient.js is merged.
 *
 * After A1 lands, change this file to:
 *   export { ask } from './llmClient';
 *
 * Keeping the adapter means A2 code does not need to change again.
 */
export async function ask({ messages }) {
  const lastUserMessage = [...(messages || [])].reverse().find((m) => m.role === 'user');
  return {
    text:
      lastUserMessage?.content
        ? `Mock response for testing: ${lastUserMessage.content}`
        : 'Mock response for testing.',
    toolCalls: [],
  };
}
