/**
 * A2 wrote this adapter so the panel could be built before A1's relay existed, and named the swap
 * that would retire it. This is that swap: the mock is gone and the real client is in its place,
 * so no caller had to change.
 */
export { ask } from './llmClient';
