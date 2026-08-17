import React from 'react';
import { Button, Empty, Input, Skeleton, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  HourglassOutlined,
  SearchOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { categoryStyle } from '../constants';
import { useI18n } from '../i18n';

/**
 * One row of pills rather than a dropdown: the filter that is currently on stays visible while you
 * read the results. Eight categories overflow 352px, so the row scrolls sideways.
 */
function CategoryChips({ categories, value, onChange }) {
  const { t } = useI18n();
  const options = [
    { key: '', label: t('explore.allCategories'), Icon: AppstoreOutlined },
    ...categories.map((c) => ({
      key: c,
      label: t(`category.${c}`, null, c),
      Icon: categoryStyle(c).Icon,
    })),
  ];

  return (
    <div className="chip-row">
      {options.map(({ key, label, Icon }) => (
        <button
          key={key || 'all'}
          type="button"
          className={`chip${value === key ? ' active' : ''}`}
          onClick={() => onChange(key)}
        >
          <Icon />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function ExplorePanel({
  pois,
  loading,
  keyword,
  onKeyword,
  category,
  onCategory,
  categories,
  plannedByPoiId,
  activeDay,
  onAdd,
  onFocus,
  adding,
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="panel-head">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: 'var(--ink-soft)' }} />}
          placeholder={t('explore.searchPlaceholder')}
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
          style={{ height: 40 }}
        />
        <CategoryChips categories={categories} value={category} onChange={onCategory} />
        <div className="panel-note">
          {loading
            ? t('explore.searching')
            : t('explore.count', { count: pois.length, day: activeDay })}
        </div>
      </div>

      <div className="panel-scroll">
        {loading && <Skeleton active paragraph={{ rows: 8 }} />}

        {!loading && pois.length === 0 && (
          <Empty description={t('explore.empty')} style={{ marginTop: 40 }} />
        )}

        {!loading &&
          pois.map((poi) => {
            const planned = plannedByPoiId[poi.id];
            const { color, Icon } = categoryStyle(poi.category);
            return (
              <div
                key={poi.id}
                className={`poi-card${planned ? ' is-added' : ''}`}
                onClick={() => onFocus(poi)}
              >
                <span className="poi-rail" style={{ background: color }} />
                <div className="poi-card-body">
                  <Icon className="poi-icon" style={{ color }} />
                  <div className="poi-text">
                    <div className="poi-name">{poi.name}</div>
                    <div className="poi-meta">
                      <span>
                        <StarOutlined /> {poi.rating.toFixed(1)}
                      </span>
                      <span>
                        <HourglassOutlined />{' '}
                        {t('explore.visitMinutes', { minutes: poi.avgVisitMinutes })}
                      </span>
                      <span>
                        <ClockCircleOutlined />{' '}
                        {poi.alwaysOpen ? t('explore.openAnytime') : poi.openLabel}
                      </span>
                    </div>
                    <div className="poi-desc">{poi.description}</div>
                  </div>
                  {planned ? (
                    <Tooltip title={t('explore.alreadyPlanned', { day: planned })}>
                      <Button size="small" disabled style={{ height: 28 }}>
                        {t('explore.onDay', { day: planned })}
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip title={t('explore.addToDayHint', { day: activeDay })}>
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        style={{ height: 28 }}
                        loading={adding === poi.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdd(poi);
                        }}
                      >
                        {t('explore.addToDay')}
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
