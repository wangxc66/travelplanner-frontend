import React, { useState } from 'react';
import { DatePicker, Form, Input, Modal, Slider } from 'antd';
import dayjs from 'dayjs';
import { useI18n } from '../i18n';

export default function NewTripModal({ open, cities, onCancel, onCreate }) {
  const { t } = useI18n();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      await onCreate({
        cityId: values.cityId,
        title: values.title,
        numDays: values.numDays,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
      });
      form.resetFields();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('newTrip.title')}
      okText={t('newTrip.ok')}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          cityId: cities[0]?.id,
          numDays: 3,
          startDate: dayjs().add(14, 'day'),
        }}
        requiredMark={false}
      >
        <Form.Item name="cityId" label={t('newTrip.city')} rules={[{ required: true }]}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cities.map((city) => (
              <CityChip key={city.id} city={city} form={form} t={t} />
            ))}
          </div>
        </Form.Item>
        <Form.Item name="title" label={t('newTrip.name')} extra={t('newTrip.nameHint')}>
          <Input placeholder={t('newTrip.namePlaceholder')} />
        </Form.Item>
        <Form.Item name="numDays" label={t('newTrip.days')}>
          <Slider min={1} max={15} marks={{ 1: '1', 5: '5', 10: '10', 15: '15' }} />
        </Form.Item>
        <Form.Item name="startDate" label={t('newTrip.startDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function CityChip({ city, form, t }) {
  const selected = Form.useWatch('cityId', form) === city.id;
  return (
    <button
      type="button"
      onClick={() => form.setFieldValue('cityId', city.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 13px',
        borderRadius: 12,
        cursor: 'pointer',
        background: '#fff',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--line)'}`,
        boxShadow: selected ? '0 0 0 3px rgba(59,108,255,0.12)' : 'none',
        fontSize: 13,
        fontWeight: selected ? 600 : 400,
      }}
    >
      <span style={{ fontSize: 17 }}>{city.heroEmoji}</span>
      <span>
        {city.name}
        <span style={{ color: 'var(--ink-soft)', fontSize: 11, marginLeft: 6 }}>
          {t('newTrip.placeCount', { count: city.poiCount })}
        </span>
      </span>
    </button>
  );
}
