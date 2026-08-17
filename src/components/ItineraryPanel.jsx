import React, { useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Alert, Button, Dropdown, Segmented, Tooltip } from 'antd';
import {
  ArrowDownOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  HolderOutlined,
  MoreOutlined,
  PushpinFilled,
  PushpinOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { categoryStyle, formatMinutes, lyftLink, MODES, uberLink } from '../constants';
import { useI18n } from '../i18n';

function DayPill({ day, active, reordering, onSelect }) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day.dayIndex}`, disabled: !reordering });
  const over = day.loadPercent > 100;
  // 84px leaves no room for the date, so it moves into the tooltip rather than off the screen.
  // The server sends an ISO date; dayjs renders it in the active locale.
  const date = day.date ? dayjs(day.date).format('ddd, MMM D') : null;
  return (
    <Tooltip title={date}>
      <button
        ref={setNodeRef}
        className={`day-pill${active ? ' active' : ''}${isOver ? ' drop-target' : ''}`}
        onClick={() => onSelect(day.dayIndex)}
        type="button"
      >
        <div className="day-pill-title">{t('plan.day', { day: day.dayIndex })}</div>
        <div className="day-pill-sub">
          {day.items.length === 1 ? t('plan.stops_one') : t('plan.stops', { count: day.items.length })}
        </div>
        <div className={`load-bar${over ? ' over' : ''}`}>
          <span style={{ width: `${Math.min(100, day.loadPercent)}%` }} />
        </div>
      </button>
    </Tooltip>
  );
}

function Leg({ item, prevPoi }) {
  const { t } = useI18n();
  if (!prevPoi) return null;
  const from = { lat: prevPoi.lat, lng: prevPoi.lng, name: prevPoi.name };
  const to = { lat: item.poi.lat, lng: item.poi.lng, name: item.poi.name };
  return (
    <div className="leg">
      <ArrowDownOutlined />
      <span>
        {t('plan.leg', { minutes: item.travelMinutesFromPrev, km: item.travelKmFromPrev })}
      </span>
      <a href={uberLink(from, to)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        Uber
      </a>
      <span style={{ color: 'var(--map-rail)' }}>·</span>
      <a href={lyftLink(from, to)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        Lyft
      </a>
    </div>
  );
}

function StopRow({
  item,
  index,
  total,
  prevPoi,
  days,
  activeDay,
  reordering,
  onFocus,
  onRemove,
  onLock,
  onMove,
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item-${item.id}`,
    disabled: !reordering,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const cat = categoryStyle(item.poi.category);

  const moveMenu = {
    items: days
      .filter((d) => d.dayIndex !== activeDay)
      .map((d) => ({ key: d.dayIndex, label: t('plan.moveTo', { day: d.dayIndex }) })),
    onClick: ({ key }) => onMove(item, Number(key)),
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Leg item={item} prevPoi={prevPoi} />
      <div className={`stop${isDragging ? ' dragging' : ''}`} onClick={() => onFocus(item.poi)}>
        {/* Only reorder mode carries the drag listeners, and only on the handle: with it off the
            row must not advertise a grab it will not honour, nor take a tab stop for it. */}
        {reordering && (
          <span className="drag-handle" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            <HolderOutlined />
          </span>
        )}
        <span
          className={`stop-rail${index === 0 ? ' is-first' : ''}${index === total - 1 ? ' is-last' : ''}`}
        >
          <span className="stop-index" style={{ background: cat.color }}>
            {index + 1}
          </span>
        </span>
        <div className="stop-body">
          <div className="stop-name">
            {item.locked && <PushpinFilled />}
            <span>{item.poi.name}</span>
          </div>
          <div className="stop-time">
            {item.arriveTime} – {item.leaveTime} ·{' '}
            {t('plan.visitLabel', { minutes: item.poi.avgVisitMinutes })}
          </div>
          {item.warnings.map((w) => (
            <div className="warn-line" key={w.code}>
              <ExclamationCircleOutlined /> {t(w.code, w.params)}
            </div>
          ))}
        </div>
        <div className="stop-actions" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={item.locked ? t('plan.unpin') : t('plan.pin')}>
            <Button
              type="text"
              size="small"
              icon={item.locked ? <PushpinFilled /> : <PushpinOutlined />}
              onClick={() => onLock(item)}
            />
          </Tooltip>
          {days.length > 1 && (
            <Dropdown menu={moveMenu} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          )}
          <Tooltip title={t('plan.remove')}>
            <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => onRemove(item)} />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default function ItineraryPanel({
  trip,
  activeDay,
  onActiveDay,
  onReorder,
  onMove,
  onRemove,
  onLock,
  onOptimizeDay,
  onRebalance,
  onModeChange,
  onFocus,
  onApplySuggestion,
  busy,
}) {
  const { t } = useI18n();
  // Off by default: a plain click on a stop should focus it on the map, and the timeline reads as a
  // list rather than something you are meant to grab. Turning it on brings back the old card rows.
  const [reordering, setReordering] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const day = trip.days.find((d) => d.dayIndex === activeDay) || trip.days[0];
  const items = day.items;

  const handleDragEnd = ({ active, over }) => {
    if (!over) return;
    const itemId = Number(String(active.id).replace('item-', ''));
    if (String(over.id).startsWith('day-')) {
      const target = Number(String(over.id).replace('day-', ''));
      if (target !== activeDay) {
        onMove(items.find((i) => i.id === itemId), target);
      }
      return;
    }
    if (active.id === over.id) return;
    const ids = items.map((i) => `item-${i.id}`);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    onReorder(next.map((id) => Number(id.replace('item-', ''))));
  };

  /** Suggestions arrive as a code plus params; the day prefix is added here. */
  const suggestionText = (s) =>
    s.kind === 'DAY_WARNING'
      ? `${t('suggestion.dayPrefix', { day: s.fromDay })}: ${t(s.code, s.params)}`
      : t(s.code, s.params);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="panel-head">
        <div className="day-strip">
          {trip.days.map((d) => (
            <DayPill
              key={d.dayIndex}
              day={d}
              active={d.dayIndex === activeDay}
              reordering={reordering}
              onSelect={onActiveDay}
            />
          ))}
        </div>
        <div className="plan-controls">
          <Segmented
            size="small"
            value={trip.defaultMode}
            onChange={onModeChange}
            options={MODES.map((m) => ({ value: m.value, label: t(`mode.${m.value}`) }))}
          />
          <Tooltip title={t('plan.optimizeHint')}>
            <Button
              size="small"
              type="primary"
              icon={<ThunderboltOutlined />}
              style={{ height: 28 }}
              loading={busy === 'optimize'}
              onClick={() => onOptimizeDay(activeDay)}
            >
              {t('plan.optimize')}
            </Button>
          </Tooltip>
          <Tooltip title={t(reordering ? 'plan.reorderOffHint' : 'plan.reorderHint')}>
            <Button
              size="small"
              icon={<HolderOutlined />}
              style={{ height: 28 }}
              onClick={() => setReordering((on) => !on)}
            >
              {t(reordering ? 'plan.reorderDone' : 'plan.reorder')}
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="panel-scroll">
        {/* Trip-wide, so it sits with the list rather than in the day-scoped header. */}
        <Tooltip title={t('plan.rebalanceHint')}>
          <Button
            size="small"
            icon={<SwapOutlined />}
            style={{ height: 28, marginBottom: 10 }}
            loading={busy === 'rebalance'}
            onClick={onRebalance}
          >
            {t('plan.rebalance')}
          </Button>
        </Tooltip>

        {trip.suggestions.map((s, i) => (
          <Alert
            key={`${s.kind}-${s.code}-${i}`}
            type={s.kind === 'EMPTY_DAY' ? 'info' : 'warning'}
            showIcon
            style={{ marginBottom: 12, fontSize: 12 }}
            message={suggestionText(s)}
            action={
              s.kind === 'REBALANCE' ? (
                <Button size="small" type="link" onClick={() => onApplySuggestion(s)}>
                  {t('plan.suggestionDo')}
                </Button>
              ) : s.kind === 'EMPTY_DAY' ? (
                <Button size="small" type="link" onClick={() => onActiveDay(s.fromDay)}>
                  {t('plan.suggestionFill')}
                </Button>
              ) : null
            }
          />
        ))}

        {items.length === 0 ? (
          <div className="empty-day">
            {t('plan.emptyDay', { day: activeDay })}
            <br />
            {t('plan.emptyDayHint', { day: activeDay })}
          </div>
        ) : (
          <div className={`stop-list${reordering ? ' is-reordering' : ''}`}>
            <SortableContext items={items.map((i) => `item-${i.id}`)} strategy={verticalListSortingStrategy}>
              {items.map((item, index) => (
                <StopRow
                  key={item.id}
                  item={item}
                  index={index}
                  total={items.length}
                  prevPoi={index > 0 ? items[index - 1].poi : null}
                  days={trip.days}
                  activeDay={activeDay}
                  reordering={reordering}
                  onFocus={onFocus}
                  onRemove={onRemove}
                  onLock={onLock}
                  onMove={onMove}
                />
              ))}
            </SortableContext>
          </div>
        )}
      </div>

      {/* Pinned below the scroll area: the day's totals are a status bar, not the tail of the list. */}
      {items.length > 0 && (
        <div className="day-summary">
          <div>
            <b>
              {day.startTime} → {day.endTime}
            </b>
            <span>{t('plan.dayWindow')}</span>
          </div>
          <div>
            <b>{formatMinutes(day.visitMinutes, t)}</b>
            <span>{t('plan.atStops')}</span>
          </div>
          <div>
            <b>{formatMinutes(day.travelMinutes, t)}</b>
            <span>{t('plan.onTheMove')}</span>
          </div>
          <div>
            <b>{day.loadPercent}%</b>
            <span>{t('plan.dayUsed')}</span>
          </div>
        </div>
      )}
    </DndContext>
  );
}
