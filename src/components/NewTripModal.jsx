import React, { useState } from 'react';
import { DatePicker, Form, Input, Modal, Slider } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
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
      // Name it here rather than let the server do it: the server has no idea which language the
      // traveler is reading, and "3 days in Tokyo" in a Chinese UI reads like a bug.
      const city = cities.find((c) => c.id === values.cityId);
      const title =
        values.title?.trim() ||
        t('newTrip.defaultTitle', { days: values.numDays, city: city?.name ?? '' });
      await onCreate({
        cityId: values.cityId,
        title,
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
      width={480}
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
          <div className="city-chips">
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
          <DatePicker style={{ width: '100%' }} suffixIcon={null} prefix={<CalendarOutlined />} />
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
      className={`city-chip${selected ? ' active' : ''}`}
      onClick={() => form.setFieldValue('cityId', city.id)}
    >
      <span className="city-chip-hero">{city.heroEmoji}</span>
      <span className="city-chip-labels">
        <span className="city-chip-name">{city.name}</span>
        <span className="city-chip-count">{t('newTrip.placeCount', { count: city.poiCount })}</span>
      </span>
    </button>
  );
}
