import React, { useState } from 'react';
import { Alert, Button, Form, Input, Segmented } from 'antd';
import { CompassOutlined } from '@ant-design/icons';
import { errorNotice, login, register, session } from '../utils';
import { useI18n } from '../i18n';
import LanguageSwitch from './LanguageSwitch';

export default function AuthPage({ onAuthenticated }) {
  const { t } = useI18n();
  // Nothing is seeded but the POI catalog, so a first-time visitor needs the register form.
  const [mode, setMode] = useState('register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (values) => {
    setLoading(true);
    setError(null);
    try {
      const auth = mode === 'signIn' ? await login(values) : await register(values);
      session.save(auth);
      onAuthenticated(auth);
    } catch (e) {
      const notice = errorNotice(e);
      setError(t(notice.code, notice.params, notice.message ?? t('auth.failed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <div className="brand">
            <span className="brand-mark">
              <CompassOutlined />
            </span>
            {t('app.name')}
          </div>
          <LanguageSwitch />
        </div>
        <div className="auth-title">{t('app.tagline')}</div>
        <div className="auth-sub">{t('app.pitch')}</div>

        <Segmented
          block
          options={[
            { value: 'signIn', label: t('auth.signIn') },
            { value: 'register', label: t('auth.createAccount') },
          ]}
          value={mode}
          onChange={setMode}
          style={{ margin: '24px 0 20px' }}
        />

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 14 }} />}

        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            name="username"
            label={t('auth.username')}
            rules={[{ required: true, message: t('auth.required') }]}
          >
            <Input size="large" placeholder={t('auth.usernamePlaceholder')} autoComplete="username" />
          </Form.Item>
          {mode === 'register' && (
            <Form.Item name="displayName" label={t('auth.displayName')}>
              <Input size="large" placeholder={t('auth.displayNamePlaceholder')} />
            </Form.Item>
          )}
          <Form.Item
            name="password"
            label={t('auth.password')}
            rules={[{ required: true, message: t('auth.required') }]}
          >
            <Input.Password
              size="large"
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            />
          </Form.Item>
          <Button type="primary" size="large" block htmlType="submit" loading={loading}>
            {mode === 'signIn' ? t('auth.continue') : t('auth.createAccount')}
          </Button>
        </Form>

        <div className="auth-footnote">{t('auth.footnote')}</div>
      </div>
    </div>
  );
}
