import React from 'react';
import { Segmented } from 'antd';
import { LANGUAGES, useI18n } from '../i18n';

/** Present on both the auth screen and the top bar, so language is switchable before signing in. */
export default function LanguageSwitch({ size = 'small' }) {
  const { lang, setLang } = useI18n();
  return <Segmented size={size} options={LANGUAGES} value={lang} onChange={setLang} />;
}
