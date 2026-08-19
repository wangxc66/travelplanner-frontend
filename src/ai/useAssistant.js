import { useCallback, useEffect, useRef, useState } from 'react';
import { executeTool } from './executeTool';
import { TOOLS } from './tools';

export const MAX_MODEL_ROUNDS = 6;

const DEFAULT_MESSAGES = {
  cancelled: '已取消这次行程修改。',
  loopLimit: '这次请求需要的步骤太多，我先停在这里。请把需求拆小一点再试。',
  missingTrip: '当前没有可操作的行程，请先打开一个行程。',
};

function publicError(error, fallback = 'AI 助手暂时不可用，请稍后重试。') {
  return {
    message: typeof error?.message === 'string' && error.message.trim() ? error.message : fallback,
    ...(Number.isInteger(error?.status) ? { status: error.status } : {}),
  };
}

function normalizeReply(reply) {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) {
    throw new Error('AI 返回了无法识别的响应。');
  }

  const { text, toolCalls } = reply;
  if (text !== null && typeof text !== 'string') {
    throw new Error('AI 返回了无效的文本内容。');
  }
  if (!Array.isArray(toolCalls)) {
    throw new Error('AI 返回了无效的工具调用列表。');
  }

  const ids = new Set();
  const normalizedCalls = toolCalls.map((call) => {
    const validInput =
      call?.input &&
      typeof call.input === 'object' &&
      !Array.isArray(call.input) &&
      Object.getPrototypeOf(call.input) === Object.prototype;
    if (
      !call ||
      typeof call.id !== 'string' ||
      !call.id.trim() ||
      ids.has(call.id) ||
      typeof call.name !== 'string' ||
      !call.name.trim() ||
      !validInput
    ) {
      throw new Error('AI 返回了无效的工具调用。');
    }
    ids.add(call.id);
    return { id: call.id, name: call.name, input: call.input };
  });

  return { text, toolCalls: normalizedCalls };
}

function assistantMessage(reply) {
  return {
    role: 'assistant',
    content: reply.text || '',
    toolCalls: reply.toolCalls,
  };
}

function toolMessage(toolCallId, result) {
  return {
    role: 'tool',
    toolCallId,
    content: JSON.stringify(result),
  };
}

function resolveSystem(system, ctx) {
  const value = typeof system === 'function' ? system(ctx) : system;
  if (typeof value !== 'string') {
    throw new Error('AI 系统提示词必须是字符串。');
  }
  return value;
}

/**
 * Owns the browser-side model/tool loop. A1 supplies `ask`; A2 supplies the
 * current system prompt (normally prompt + buildContext) and renders the
 * returned state. B1 is connected directly through TOOLS and executeTool.
 */
export function useAssistant({
  ask,
  system = '',
  trip,
  pois = [],
  onTripChange,
  maxRounds = MAX_MODEL_ROUNDS,
  copy: copyOverrides = DEFAULT_MESSAGES,
} = {}) {
  const [messages, setMessages] = useState([]);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const messagesRef = useRef([]);
  const pendingRef = useRef(null);
  const retryRef = useRef(null);
  const busyRef = useRef(false);
  const operationRef = useRef(0);
  const tripIdRef = useRef(trip?.id);
  const optionsRef = useRef({});

  optionsRef.current = {
    ask,
    system,
    trip,
    pois: Array.isArray(pois) ? pois : [],
    onTripChange,
    maxRounds,
    copy: { ...DEFAULT_MESSAGES, ...copyOverrides },
  };

  const commitMessages = useCallback((next) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const commitPending = useCallback((next) => {
    pendingRef.current = next;
    setPendingConfirmation(next);
  }, []);

  const finish = useCallback(() => {
    busyRef.current = false;
    setIsLoading(false);
  }, []);

  const fail = useCallback(
    (caught, continuation = null) => {
      retryRef.current = continuation;
      setError(publicError(caught));
      finish();
    },
    [finish],
  );

  const requestModel = useCallback(
    async (history, ctx, completedRounds, operation) => {
      const options = optionsRef.current;
      if (completedRounds >= options.maxRounds) {
        const limitMessage = {
          role: 'assistant',
          content: options.copy.loopLimit,
          toolCalls: [],
        };
        commitMessages([...history, limitMessage]);
        setError({ message: options.copy.loopLimit, code: 'MODEL_LOOP_LIMIT' });
        retryRef.current = null;
        finish();
        return;
      }

      const continuation = { history, ctx, completedRounds };
      try {
        if (typeof options.ask !== 'function') {
          throw new Error('AI 模型客户端尚未连接。');
        }

        const reply = normalizeReply(
          await options.ask({
            system: resolveSystem(options.system, ctx),
            messages: history,
            tools: TOOLS,
          }),
        );
        if (operation !== operationRef.current) return;

        retryRef.current = null;
        const nextHistory = [...history, assistantMessage(reply)];
        commitMessages(nextHistory);

        if (reply.toolCalls.length > 0) {
          commitPending({
            text: reply.text,
            toolCalls: reply.toolCalls,
            ctx,
            history: nextHistory,
            completedRounds: completedRounds + 1,
          });
          finish();
          return;
        }

        finish();
      } catch (caught) {
        if (operation === operationRef.current) {
          fail(caught, continuation);
        }
      }
    },
    [commitMessages, commitPending, fail, finish],
  );

  const sendMessage = useCallback(
    async (content) => {
      const text = typeof content === 'string' ? content.trim() : '';
      if (!text || busyRef.current || pendingRef.current) return false;

      const options = optionsRef.current;
      if (!options.trip || !Number.isInteger(options.trip.id)) {
        setError({ message: options.copy.missingTrip, code: 'MISSING_TRIP' });
        return false;
      }

      const operation = operationRef.current + 1;
      operationRef.current = operation;
      busyRef.current = true;
      setIsLoading(true);
      setError(null);
      retryRef.current = null;

      const history = [...messagesRef.current, { role: 'user', content: text }];
      const ctx = { tripId: options.trip.id, trip: options.trip, pois: options.pois };
      commitMessages(history);
      await requestModel(history, ctx, 0, operation);
      return true;
    },
    [commitMessages, requestModel],
  );

  const confirmToolCalls = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending || busyRef.current) return false;

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    busyRef.current = true;
    setIsLoading(true);
    setError(null);
    commitPending(null);

    let ctx = pending.ctx;
    let history = pending.history;
    let changed = false;

    for (const call of pending.toolCalls) {
      let result;
      try {
        result = await executeTool(call.name, call.input, ctx);
      } catch (caught) {
        result = { ok: false, reason: publicError(caught, '工具执行失败，请稍后重试。').message };
      }

      if (operation !== operationRef.current) return false;
      if (result?.ok === true && result.trip) {
        ctx = { ...ctx, trip: result.trip };
        changed = true;
      }
      history = [...history, toolMessage(call.id, result)];
      commitMessages(history);
    }

    if (changed && typeof optionsRef.current.onTripChange === 'function') {
      optionsRef.current.onTripChange(ctx.trip);
    }

    await requestModel(history, ctx, pending.completedRounds, operation);
    return true;
  }, [commitMessages, commitPending, requestModel]);

  const cancelToolCalls = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || busyRef.current) return false;

    const cancelled = { ok: false, reason: optionsRef.current.copy.cancelled };
    const toolMessages = pending.toolCalls.map((call) => toolMessage(call.id, cancelled));
    const finalMessage = {
      role: 'assistant',
      content: optionsRef.current.copy.cancelled,
      toolCalls: [],
    };
    commitMessages([...pending.history, ...toolMessages, finalMessage]);
    commitPending(null);
    retryRef.current = null;
    setError(null);
    return true;
  }, [commitMessages, commitPending]);

  const retry = useCallback(async () => {
    const continuation = retryRef.current;
    if (!continuation || busyRef.current || pendingRef.current) return false;

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    busyRef.current = true;
    setIsLoading(true);
    setError(null);
    await requestModel(
      continuation.history,
      continuation.ctx,
      continuation.completedRounds,
      operation,
    );
    return true;
  }, [requestModel]);

  const resetConversation = useCallback(() => {
    if (busyRef.current) return false;
    operationRef.current += 1;
    commitMessages([]);
    commitPending(null);
    retryRef.current = null;
    setError(null);
    return true;
  }, [commitMessages, commitPending]);

  useEffect(() => {
    if (tripIdRef.current === trip?.id) return;
    tripIdRef.current = trip?.id;
    operationRef.current += 1;
    busyRef.current = false;
    messagesRef.current = [];
    pendingRef.current = null;
    retryRef.current = null;
    setMessages([]);
    setPendingConfirmation(null);
    setIsLoading(false);
    setError(null);
  }, [trip?.id]);

  return {
    messages,
    pendingConfirmation,
    isLoading,
    isBusy: isLoading || pendingConfirmation !== null,
    error,
    sendMessage,
    confirmToolCalls,
    cancelToolCalls,
    retry,
    resetConversation,
  };
}

export default useAssistant;
