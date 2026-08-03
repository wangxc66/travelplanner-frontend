import React from 'react';
import { Button, Empty, Input, Select, Skeleton, Tooltip } from 'antd';
import { categoryStyle } from '../constants';
import { useI18n } from '../i18n';

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
        <Input.Search
          allowClear
          size="large"
          placeholder={t('explore.searchPlaceholder')}
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <Select
          value={category || 'All'}
          onChange={(v) => onCategory(v === 'All' ? '' : v)}
          style={{ width: '100%' }}
          options={['All', ...categories].map((c) => ({
            value: c,
            label:
              c === 'All'
                ? t('explore.allCategories')
                : `${categoryStyle(c).icon}  ${t(`category.${c}`, null, c)}`,
          }))}
        />
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '10px 0 0' }}>
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
            const style = categoryStyle(poi.category);
            return (
              <div
                key={poi.id}
                className={`poi-card${planned ? ' is-added' : ''}`}
                onClick={() => onFocus(poi)}
              >
                <div className="poi-card-body">
                  <div className="poi-name">
                    <span className="cat-dot" style={{ background: style.color }} />
                    {poi.name}
                  </div>
                  <div className="poi-meta">
                    <span>
                      {style.icon} {t(`category.${poi.category}`, null, poi.category)}
                    </span>
                    <span>★ {poi.rating.toFixed(1)}</span>
                    <span>⏱ {t('explore.visitMinutes', { minutes: poi.avgVisitMinutes })}</span>
                    <span>🕘 {poi.alwaysOpen ? t('explore.openAnytime') : poi.openLabel}</span>
                  </div>
                  <div className="poi-desc">{poi.description}</div>
                </div>
                <div style={{ alignSelf: 'center' }}>
                  {planned ? (
                    <Tooltip title={t('explore.alreadyPlanned', { day: planned })}>
                      <Button size="small" disabled>
                        {t('explore.onDay', { day: planned })}
                      </Button>
                    </Tooltip>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      loading={adding === poi.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd(poi);
                      }}
                    >
                      {t('explore.addToDay', { day: activeDay })}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
