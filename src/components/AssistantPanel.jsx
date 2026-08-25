import React, { useMemo, useState } from 'react';
import { Button, Empty, Input, Spin } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { useI18n } from '../i18n';
import { buildContext } from '../ai/context';
import { buildSystemPrompt } from '../ai/prompts';
import { ask } from '../ai/assistantAsk';

export default function AssistantPanel({ trip, pois, onTripChange }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const context = useMemo(() => buildContext(trip, pois, t), [trip, pois, t]);
  const system = useMemo(() => buildSystemPrompt(context), [context]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || loading) return;

    const userMessage = { role: 'user', content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const reply = await ask({
        system,
        messages: nextMessages,
        tools: [],
      });

      const text = reply?.text || t('assistant.noAnswer');
      setMessages((current) => [...current, { role: 'assistant', content: text }]);
      if (reply?.toolCalls?.length && onTripChange) {
        // Read-only A2 deliberately ignores tool calls. B2 will own mutations later.
      }
    } catch (e) {
      setError(e?.message || t('assistant.requestFailed'));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-head">
        <div>
          <div className="assistant-title">{t('assistant.title')}</div>
          <div className="panel-note">{t('assistant.subtitle')}</div>
        </div>
      </div>

      <div className="assistant-messages">
        {messages.length === 0 && !loading && (
          <Empty description={t('assistant.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`assistant-message ${message.role === 'user' ? 'assistant-message-user' : 'assistant-message-ai'}`}
          >
            <div className="assistant-avatar">
              {message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
            </div>
            <div className="assistant-bubble">{message.content}</div>
          </div>
        ))}

        {loading && (
          <div className="assistant-message assistant-message-ai">
            <div className="assistant-avatar"><RobotOutlined /></div>
            <div className="assistant-bubble assistant-loading"><Spin size="small" /> {t('assistant.thinking')}</div>
          </div>
        )}
      </div>

      {error && <div className="assistant-error">{error}</div>}

      <div className="assistant-input-area">
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoSize={{ minRows: 2, maxRows: 5 }}
          placeholder={t('assistant.placeholder')}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={sendMessage}
          loading={loading}
          disabled={!input.trim()}
        >
          {t('assistant.send')}
        </Button>
      </div>
    </div>
  );
}
