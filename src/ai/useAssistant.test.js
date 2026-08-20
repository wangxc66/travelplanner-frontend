import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { executeTool } from './executeTool';
import { TOOLS } from './tools';
import { useAssistant } from './useAssistant';

jest.mock('./executeTool', () => ({ executeTool: jest.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const trip = {
  id: 77,
  numDays: 2,
  days: [
    { dayIndex: 1, items: [{ id: 11, poi: { id: 101 } }] },
    { dayIndex: 2, items: [] },
  ],
};
const pois = [
  { id: 101, name: 'Existing' },
  { id: 202, name: 'New place' },
];

function createHarness(initialOptions) {
  const container = document.createElement('div');
  const root = createRoot(container);
  let current;

  function Harness({ options }) {
    current = useAssistant(options);
    return null;
  }

  act(() => root.render(<Harness options={initialOptions} />));

  return {
    get current() {
      return current;
    },
    render(options) {
      act(() => root.render(<Harness options={options} />));
    },
    unmount() {
      act(() => root.unmount());
    },
  };
}

async function run(action) {
  await act(async () => {
    await action();
  });
}

beforeEach(() => {
  jest.resetAllMocks();
});

test('sends the full history, current system context, and B1 tools to ask', async () => {
  const ask = jest.fn().mockResolvedValue({ text: '第二天目前没有安排。', toolCalls: [] });
  const system = jest.fn(({ trip: currentTrip }) => `trip=${currentTrip.id}`);
  const hook = createHarness({ ask, system, trip, pois });

  await run(() => hook.current.sendMessage(' 第二天有什么？ '));

  expect(ask).toHaveBeenCalledWith({
    system: 'trip=77',
    messages: [{ role: 'user', content: '第二天有什么？' }],
    tools: TOOLS,
  });
  expect(hook.current.messages).toEqual([
    { role: 'user', content: '第二天有什么？' },
    { role: 'assistant', content: '第二天目前没有安排。', toolCalls: [] },
  ]);
  expect(hook.current.pendingConfirmation).toBeNull();
  hook.unmount();
});

test('preserves assistant text and waits for confirmation before executing tools', async () => {
  const call = { id: 'call_1', name: 'add_stop', input: { poiId: 202, dayIndex: 2 } };
  const ask = jest.fn().mockResolvedValue({ text: '我可以把它加到第二天。', toolCalls: [call] });
  const hook = createHarness({ ask, trip, pois });

  await run(() => hook.current.sendMessage('把 New place 加到第二天'));

  expect(executeTool).not.toHaveBeenCalled();
  expect(hook.current.pendingConfirmation).toMatchObject({
    text: '我可以把它加到第二天。',
    toolCalls: [call],
  });
  expect(hook.current.messages.at(-1)).toEqual({
    role: 'assistant',
    content: '我可以把它加到第二天。',
    toolCalls: [call],
  });
  hook.unmount();
});

test('executes multiple tools sequentially with the latest trip and feeds every result back', async () => {
  const calls = [
    { id: 'call_1', name: 'add_stop', input: { poiId: 202, dayIndex: 2 } },
    { id: 'call_2', name: 'optimize_day', input: { dayIndex: 2 } },
  ];
  const afterAdd = { ...trip, title: 'after add' };
  const afterOptimize = { ...trip, title: 'after optimize' };
  const firstResult = { ok: true, trip: afterAdd, summary: '已添加' };
  const secondResult = { ok: true, trip: afterOptimize, summary: '已优化' };
  const ask = jest
    .fn()
    .mockResolvedValueOnce({ text: null, toolCalls: calls })
    .mockResolvedValueOnce({ text: '已经添加并优化好了。', toolCalls: [] });
  executeTool.mockResolvedValueOnce(firstResult).mockResolvedValueOnce(secondResult);
  const onTripChange = jest.fn();
  const system = jest.fn(({ trip: currentTrip }) => `title=${currentTrip.title || 'original'}`);
  const hook = createHarness({ ask, system, trip, pois, onTripChange });

  await run(() => hook.current.sendMessage('添加后优化'));
  await run(() => hook.current.confirmToolCalls());

  expect(executeTool).toHaveBeenNthCalledWith(1, 'add_stop', calls[0].input, {
    tripId: 77,
    trip,
    pois,
  });
  expect(executeTool).toHaveBeenNthCalledWith(2, 'optimize_day', calls[1].input, {
    tripId: 77,
    trip: afterAdd,
    pois,
  });
  expect(onTripChange).toHaveBeenCalledTimes(1);
  expect(onTripChange).toHaveBeenCalledWith(afterOptimize);
  expect(system).toHaveBeenLastCalledWith({ tripId: 77, trip: afterOptimize, pois });
  expect(ask.mock.calls[1][0].messages.slice(-2)).toEqual([
    { role: 'tool', toolCallId: 'call_1', content: JSON.stringify(firstResult) },
    { role: 'tool', toolCallId: 'call_2', content: JSON.stringify(secondResult) },
  ]);
  expect(hook.current.messages.at(-1).content).toBe('已经添加并优化好了。');
  hook.unmount();
});

test('keeps the previous trip after a failed tool and lets the model correct it', async () => {
  const calls = [
    { id: 'bad', name: 'remove_stop', input: { itemId: 999 } },
    { id: 'next', name: 'optimize_day', input: { dayIndex: 1 } },
  ];
  const failure = { ok: false, reason: '找不到要操作的行程站点。' };
  const updated = { ...trip, title: 'optimized' };
  const success = { ok: true, trip: updated, summary: '已优化' };
  const ask = jest
    .fn()
    .mockResolvedValueOnce({ text: null, toolCalls: calls })
    .mockResolvedValueOnce({ text: '第一个操作失败，第二个已完成。', toolCalls: [] });
  executeTool.mockResolvedValueOnce(failure).mockResolvedValueOnce(success);
  const hook = createHarness({ ask, trip, pois });

  await run(() => hook.current.sendMessage('执行两个操作'));
  await run(() => hook.current.confirmToolCalls());

  expect(executeTool.mock.calls[1][2].trip).toBe(trip);
  expect(ask.mock.calls[1][0].messages).toContainEqual({
    role: 'tool',
    toolCallId: 'bad',
    content: JSON.stringify(failure),
  });
  hook.unmount();
});

test('cancelling records tool results without executing or calling the model again', async () => {
  const calls = [
    { id: 'call_1', name: 'rebalance', input: {} },
    { id: 'call_2', name: 'toggle_lock', input: { itemId: 11 } },
  ];
  const ask = jest.fn().mockResolvedValue({ text: '需要修改行程。', toolCalls: calls });
  const hook = createHarness({ ask, trip, pois });

  await run(() => hook.current.sendMessage('帮我调整'));
  act(() => hook.current.cancelToolCalls());

  expect(executeTool).not.toHaveBeenCalled();
  expect(ask).toHaveBeenCalledTimes(1);
  expect(hook.current.pendingConfirmation).toBeNull();
  expect(hook.current.messages.slice(-3)).toEqual([
    {
      role: 'tool',
      toolCallId: 'call_1',
      content: JSON.stringify({ ok: false, reason: '已取消这次行程修改。' }),
    },
    {
      role: 'tool',
      toolCallId: 'call_2',
      content: JSON.stringify({ ok: false, reason: '已取消这次行程修改。' }),
    },
    { role: 'assistant', content: '已取消这次行程修改。', toolCalls: [] },
  ]);
  hook.unmount();
});

test('stops before a model round beyond the configured limit', async () => {
  let number = 0;
  const ask = jest.fn().mockImplementation(() => {
    number += 1;
    return Promise.resolve({
      text: null,
      toolCalls: [{ id: `call_${number}`, name: 'rebalance', input: {} }],
    });
  });
  executeTool.mockResolvedValue({ ok: true, trip, summary: '已重新平衡' });
  const hook = createHarness({ ask, trip, pois, maxRounds: 2 });

  await run(() => hook.current.sendMessage('循环测试'));
  await run(() => hook.current.confirmToolCalls());
  await run(() => hook.current.confirmToolCalls());

  expect(ask).toHaveBeenCalledTimes(2);
  expect(executeTool).toHaveBeenCalledTimes(2);
  expect(hook.current.error).toMatchObject({ code: 'MODEL_LOOP_LIMIT' });
  expect(hook.current.pendingConfirmation).toBeNull();
  hook.unmount();
});

test('exposes model errors and retries without duplicating the user message', async () => {
  const failure = Object.assign(new Error('模型服务繁忙'), { status: 503 });
  const ask = jest
    .fn()
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce({ text: '现在可以了。', toolCalls: [] });
  const hook = createHarness({ ask, trip, pois });

  await run(() => hook.current.sendMessage('你好'));
  expect(hook.current.error).toEqual({ message: '模型服务繁忙', status: 503 });
  expect(hook.current.messages).toEqual([{ role: 'user', content: '你好' }]);

  await run(() => hook.current.retry());
  expect(ask).toHaveBeenCalledTimes(2);
  expect(ask.mock.calls[1][0].messages).toEqual([{ role: 'user', content: '你好' }]);
  expect(hook.current.messages.filter((message) => message.role === 'user')).toHaveLength(1);
  expect(hook.current.error).toBeNull();
  hook.unmount();
});

test('clears the conversation when switching to another trip', async () => {
  const ask = jest.fn().mockResolvedValue({ text: '回答', toolCalls: [] });
  const hook = createHarness({ ask, trip, pois });
  await run(() => hook.current.sendMessage('问题'));

  hook.render({ ask, trip: { ...trip, id: 88 }, pois });

  expect(hook.current.messages).toEqual([]);
  expect(hook.current.pendingConfirmation).toBeNull();
  hook.unmount();
});
