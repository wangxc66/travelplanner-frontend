import React, { useEffect, useRef, useState } from 'react';
import { Button, Empty, Input, Spin } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n';
import { ask } from '../ai/assistantAsk';
import { buildContext } from '../ai/context';
import { buildSystemPrompt } from '../ai/prompts';
import { describeToolCall, toolNote } from '../ai/describeTool';
import useAssistant from '../ai/useAssistant';

export default function AssistantPanel({ trip, pois, onTripChange }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const scroller = useRef(null);

  const {
    messages,
    pendingConfirmation,
    isLoading,
    isBusy,
    error,
    sendMessage,
    confirmToolCalls,
    cancelToolCalls,
    retry,
    resetConversation,
  } = useAssistant({
    ask,
    // A function, not a string: after a tool changes the trip the next round has to see the trip
    // as it is now, or the model reasons about an itinerary that no longer exists.
    system: (ctx) => buildSystemPrompt(buildContext(ctx.trip, ctx.pois, t)),
    trip,
    pois,
    onTripChange,
    t,
    copy: {
      cancelled: t('assistant.cancelled'),
      loopLimit: t('assistant.loopLimit'),
      missingTrip: t('assistant.missingTrip'),
    },
  });

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, pendingConfirmation, isLoading]);

  const send = async () => {
    const text = input.trim();
    if (!text || isBusy) return;
    if (await sendMessage(text)) setInput('');
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const bubbles = messages
    .map((message, index) => {
      const key = `${message.role}-${index}`;
      if (message.role === 'tool') {
        const note = toolNote(message);
        return note ? (
          <div className="assistant-tool-note" key={key}>
            {note}
          </div>
        ) : null;
      }
      // An assistant turn that only called tools has nothing to say yet; the confirmation card
      // below is already showing what it wants to do.
      if (!message.content) return null;
      const mine = message.role === 'user';
      return (
        <div
          className={`assistant-message ${mine ? 'assistant-message-user' : 'assistant-message-ai'}`}
          key={key}
        >
          <div className="assistant-avatar">{mine ? <UserOutlined /> : <RobotOutlined />}</div>
          <div className="assistant-bubble">{message.content}</div>
        </div>
      );
    })
    .filter(Boolean);

  return (
    <div className="assistant-panel">
      <div className="assistant-head">
        <div>
          <div className="assistant-title">{t('assistant.title')}</div>
          <div className="panel-note">{t('assistant.subtitle')}</div>
        </div>
        {messages.length > 0 && (
          <Button type="text" size="small" disabled={isBusy} onClick={resetConversation}>
            {t('assistant.reset')}
          </Button>
        )}
      </div>

      <div className="assistant-messages" ref={scroller}>
        {bubbles.length === 0 && !isLoading && (
          <Empty description={t('assistant.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {bubbles}

        {isLoading && (
          <div className="assistant-message assistant-message-ai">
            <div className="assistant-avatar">
              <RobotOutlined />
            </div>
            <div className="assistant-bubble assistant-loading">
              <Spin size="small" /> {t('assistant.thinking')}
            </div>
          </div>
        )}

        {pendingConfirmation && (
          <div className="assistant-confirm">
            <div className="assistant-confirm-title">{t('assistant.confirmTitle')}</div>
            <ul className="assistant-confirm-list">
              {pendingConfirmation.toolCalls.map((call) => (
                <li key={call.id}>{describeToolCall(call, pendingConfirmation.ctx.trip, pois, t)}</li>
              ))}
            </ul>
            <div className="assistant-confirm-actions">
              <Button type="primary" size="small" onClick={confirmToolCalls}>
                {t('assistant.confirm')}
              </Button>
              <Button size="small" onClick={cancelToolCalls}>
                {t('assistant.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="assistant-error">
          <span>{error.message}</span>
          {error.code !== 'MODEL_LOOP_LIMIT' && error.code !== 'MISSING_TRIP' && (
            <Button type="link" size="small" disabled={isBusy} onClick={retry}>
              {t('assistant.retry')}
            </Button>
          )}
        </div>
      )}

      <div className="assistant-input-area">
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoSize={{ minRows: 2, maxRows: 5 }}
          placeholder={t('assistant.placeholder')}
          disabled={isBusy}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={send}
          loading={isLoading}
          disabled={!input.trim() || isBusy}
        >
          {t('assistant.send')}
        </Button>
      </div>
    </div>
  );
}
