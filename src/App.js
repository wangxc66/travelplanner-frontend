import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as AntApp, Button, ConfigProvider, Dropdown, Popover, Select, Slider, Spin, Tabs } from 'antd';
import { api, errorNotice, session, setUnauthorizedHandler } from './api';
import AuthPage from './components/AuthPage';
import ExplorePanel from './components/ExplorePanel';
import ItineraryPanel from './components/ItineraryPanel';
import LanguageSwitch from './components/LanguageSwitch';
import NewTripModal from './components/NewTripModal';
import MapCanvas from './components/map/MapCanvas';
import { I18nProvider, useI18n } from './i18n';

const THEME = {
  token: {
    colorPrimary: '#3b6cff',
    borderRadius: 10,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
  },
};

// antd pads two-glyph CJK button labels into "注 册". Reads as a typo in Chinese; turn it off.
const BUTTON_CONFIG = { autoInsertSpace: false };

export default function App() {
  return (
    <I18nProvider>
      <Themed />
    </I18nProvider>
  );
}

/** Inside the provider so antd's own component text (date picker, modal buttons, Empty) follows suit. */
function Themed() {
  const { antdLocale } = useI18n();
  return (
    <ConfigProvider theme={THEME} locale={antdLocale} button={BUTTON_CONFIG}>
      <AntApp>
        <Root />
      </AntApp>
    </ConfigProvider>
  );
}

function Root() {
  const { message } = AntApp.useApp();
  const { t } = useI18n();
  const [user, setUser] = useState(session.get());
  const [cities, setCities] = useState([]);
  const [trips, setTrips] = useState([]);
  const [trip, setTrip] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(false);

  const [activeDay, setActiveDay] = useState(1);
  const [tab, setTab] = useState('explore');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [pois, setPois] = useState([]);
  const [categories, setCategories] = useState([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [adding, setAdding] = useState(null);
  const [newTripOpen, setNewTripOpen] = useState(false);

  const fail = useCallback(
    (e) => {
      const notice = errorNotice(e);
      message.error(t(notice.code, notice.params, notice.message));
    },
    [message, t],
  );

  // ---------- bootstrapping ----------

  useEffect(() => {
    api.cities().then(setCities).catch(fail);
  }, [fail]);

  // A token for a user the backend no longer knows (in-memory dev database, restarted) must not leave
  // the app wedged: drop back to the auth screen instead.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setTrip(null);
      setTrips([]);
      message.warning(t('auth.sessionExpired'));
    });
  }, [message, t]);

  const openTrip = useCallback(
    async (tripId) => {
      setLoadingTrip(true);
      try {
        const detail = await api.trip(tripId);
        setTrip(detail);
        setActiveDay((day) => Math.min(day, detail.numDays));
      } catch (e) {
        fail(e);
      } finally {
        setLoadingTrip(false);
      }
    },
    [fail],
  );

  const refreshTrips = useCallback(
    async (preferId) => {
      const list = await api.trips();
      setTrips(list);
      const target = preferId || list[0]?.id;
      if (target) {
        await openTrip(target);
      } else {
        setTrip(null);
        setNewTripOpen(true);
      }
    },
    [openTrip],
  );

  useEffect(() => {
    if (user) {
      refreshTrips().catch(fail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---------- POI search, debounced ----------

  const cityId = trip?.city?.id;
  const debounce = useRef(null);

  useEffect(() => {
    if (!cityId) return;
    api.categories(cityId).then(setCategories).catch(() => setCategories([]));
  }, [cityId]);

  useEffect(() => {
    if (!cityId) return;
    setPoiLoading(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api
        .pois(cityId, { keyword, category })
        .then(setPois)
        .catch(fail)
        .finally(() => setPoiLoading(false));
    }, 220);
    return () => clearTimeout(debounce.current);
  }, [cityId, keyword, category, fail]);

  // ---------- derived ----------

  const plannedByPoiId = useMemo(() => {
    const map = {};
    trip?.days.forEach((day) => day.items.forEach((item) => (map[item.poi.id] = day.dayIndex)));
    return map;
  }, [trip]);

  const day = trip?.days.find((d) => d.dayIndex === activeDay) || trip?.days[0];
  const candidates = useMemo(() => pois.filter((p) => !plannedByPoiId[p.id]), [pois, plannedByPoiId]);

  // ---------- mutations: every call returns the whole trip, so state stays in one place ----------

  const apply = async (label, fn) => {
    setBusy(label);
    try {
      setTrip(await fn());
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const addPoi = async (poi) => {
    setAdding(poi.id);
    try {
      setTrip(await api.addItem(trip.id, { poiId: poi.id, dayIndex: activeDay }));
      message.success(t('plan.added', { name: poi.name, day: activeDay }));
      setFocus(poi);
    } catch (e) {
      fail(e);
    } finally {
      setAdding(null);
    }
  };

  const optimizeDay = (dayIndex) =>
    apply('optimize', async () => {
      const before = day?.travelMinutes ?? 0;
      const updated = await api.optimizeDay(trip.id, dayIndex);
      const after = updated.days.find((d) => d.dayIndex === dayIndex)?.travelMinutes ?? 0;
      message.success(
        after < before
          ? t('plan.optimized', { day: dayIndex, saved: before - after })
          : t('plan.optimizedAlready', { day: dayIndex }),
      );
      return updated;
    });

  const rebalance = () =>
    apply('rebalance', async () => {
      const updated = await api.rebalance(trip.id);
      message.success(t('plan.rebalanced'));
      return updated;
    });

  const applySuggestion = (suggestion) => {
    if (suggestion.kind === 'REBALANCE' && suggestion.itemId) {
      return apply('suggestion', () =>
        api.moveItem(trip.id, suggestion.itemId, { dayIndex: suggestion.toDay, seq: null }),
      );
    }
    return undefined;
  };

  const createTrip = async (body) => {
    try {
      const created = await api.createTrip(body);
      setTrip(created);
      setActiveDay(1);
      setTab('explore');
      setNewTripOpen(false);
      setTrips(await api.trips());
    } catch (e) {
      fail(e);
    }
  };

  const signOut = () => {
    session.clear();
    setUser(null);
    setTrip(null);
    setTrips([]);
  };

  if (!user) {
    return <AuthPage onAuthenticated={setUser} />;
  }

  const center = trip ? { lat: trip.city.lat, lng: trip.city.lng } : { lat: 35.68, lng: 139.76 };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">🧭</span>
          {t('app.name')}
        </div>

        {trips.length > 0 && (
          <Select
            value={trip?.id}
            style={{ minWidth: 230 }}
            onChange={openTrip}
            options={trips.map((item) => ({
              value: item.id,
              label: t('top.tripOption', {
                emoji: item.heroEmoji,
                title: item.title,
                days: item.numDays,
                stops: item.plannedCount,
              }),
            }))}
          />
        )}
        <Button onClick={() => setNewTripOpen(true)}>{t('top.newTrip')}</Button>

        {trip && (
          <Popover
            trigger="click"
            title={t('settings.title')}
            content={<TripSettings trip={trip} onChange={(body) => apply('settings', () => api.updateTrip(trip.id, body))} />}
          >
            <Button type="text">
              {t('top.tripSummary', { days: trip.numDays, hour: trip.dayStartHour })} ⌄
            </Button>
          </Popover>
        )}

        <div className="topbar-spacer" />

        <LanguageSwitch />

        <Dropdown
          menu={{ items: [{ key: 'out', label: t('auth.signOut'), onClick: signOut }] }}
          trigger={['click']}
        >
          <Button type="text">👤 {user.displayName || user.username} ⌄</Button>
        </Dropdown>
      </div>

      <div className="workspace">
        <aside className="side">
          {!trip || loadingTrip ? (
            <div style={{ display: 'grid', placeItems: 'center', flex: 1 }}>
              <Spin />
            </div>
          ) : (
            <Tabs
              activeKey={tab}
              onChange={setTab}
              style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
              tabBarStyle={{ padding: '0 16px', marginBottom: 0 }}
              items={[
                {
                  key: 'explore',
                  label: t('explore.tab', { city: trip.city.name }),
                  children: (
                    <ExplorePanel
                      pois={pois}
                      loading={poiLoading}
                      keyword={keyword}
                      onKeyword={setKeyword}
                      category={category}
                      onCategory={setCategory}
                      categories={categories}
                      plannedByPoiId={plannedByPoiId}
                      activeDay={activeDay}
                      onAdd={addPoi}
                      onFocus={setFocus}
                      adding={adding}
                    />
                  ),
                },
                {
                  key: 'plan',
                  label: t('plan.tab', { count: trip.plannedCount }),
                  children: (
                    <ItineraryPanel
                      trip={trip}
                      activeDay={activeDay}
                      onActiveDay={setActiveDay}
                      busy={busy}
                      onFocus={setFocus}
                      onReorder={(ids) => apply('reorder', () => api.reorderDay(trip.id, activeDay, ids))}
                      onMove={(item, dayIndex) =>
                        apply('move', () => api.moveItem(trip.id, item.id, { dayIndex, seq: null }))
                      }
                      onRemove={(item) => apply('remove', () => api.removeItem(trip.id, item.id))}
                      onLock={(item) => apply('lock', () => api.toggleLock(trip.id, item.id))}
                      onOptimizeDay={optimizeDay}
                      onRebalance={rebalance}
                      onModeChange={(mode) => apply('mode', () => api.updateTrip(trip.id, { defaultMode: mode }))}
                      onApplySuggestion={applySuggestion}
                    />
                  ),
                },
              ]}
            />
          )}
        </aside>

        <main className="map-area">
          {trip && day && (
            <MapCanvas
              center={center}
              zoom={trip.city.defaultZoom}
              dayIndex={activeDay}
              stops={day.items}
              candidates={candidates}
              focus={focus}
              onPoiClick={setFocus}
              fitKey={`${trip.id}-${activeDay}-${day.items.length}`}
            />
          )}
        </main>
      </div>

      <NewTripModal
        open={newTripOpen}
        cities={cities}
        onCancel={() => setNewTripOpen(false)}
        onCreate={createTrip}
      />
    </div>
  );
}

function TripSettings({ trip, onChange }) {
  const { t } = useI18n();
  return (
    <div style={{ width: 250 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{t('settings.length')}</div>
      <Slider
        min={1}
        max={15}
        defaultValue={trip.numDays}
        marks={{ 1: '1', 8: '8', 15: '15' }}
        onChangeComplete={(v) => onChange({ numDays: v })}
      />
      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{t('settings.dayStart')}</div>
      <Slider
        min={6}
        max={12}
        defaultValue={trip.dayStartHour}
        marks={{ 6: '6:00', 9: '9:00', 12: '12:00' }}
        onChangeComplete={(v) => onChange({ dayStartHour: v })}
      />
      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        {t('settings.shrinkNote')}
      </div>
    </div>
  );
}
