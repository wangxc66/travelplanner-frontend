import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as AntApp, Button, ConfigProvider, Divider, Dropdown, Popover, Slider, Spin, Tabs } from 'antd';
import { CompassOutlined, DownOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import {
  addItem,
  createTrip as createTripApi,
  errorNotice,
  getCategories,
  getCities,
  getTrip,
  getTrips,
  moveItem,
  optimizeDay as optimizeDayApi,
  rebalance as rebalanceApi,
  removeItem,
  reorderDay,
  searchPois,
  session,
  setUnauthorizedHandler,
  toggleLock,
  updateTrip,
} from './utils';
import AuthPage from './components/AuthPage';
import ExplorePanel from './components/ExplorePanel';
import ItineraryPanel from './components/ItineraryPanel';
import LanguageSwitch from './components/LanguageSwitch';
import NewTripModal from './components/NewTripModal';
import MapCanvas from './components/map/MapCanvas';
import { autoNamedIn, defaultTripTitle, I18nProvider, useI18n } from './i18n';

const THEME = {
  token: {
    colorPrimary: '#3b6cff',
    // 8 everywhere, per the design's radius/control token — antd's 6/10/12 mix showed up as three
    // different corner radii sitting next to each other in the same panel.
    borderRadius: 8,
    // antd derives small controls from borderRadiusSM (6) and large ones from borderRadiusLG (10);
    // the design normalises every control to 8, so the small Optimize/Add buttons and the large auth
    // fields match the inputs beside them.
    borderRadiusSM: 8,
    borderRadiusLG: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
  },
  components: {
    Tabs: { horizontalItemPadding: '14px 0', horizontalItemGutter: 24 },
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
    getCities().then(setCities).catch(fail);
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
        const detail = await getTrip(tripId);
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
      const list = await getTrips();
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
    getCategories(cityId).then(setCategories).catch(() => setCategories([]));
  }, [cityId]);

  useEffect(() => {
    if (!cityId) return;
    setPoiLoading(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      searchPois(cityId, { keyword, category })
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

  /**
   * One mutation at a time. Every call here returns the whole recomputed trip, so a second one
   * started before the first lands was computed against state we are about to throw away — and if
   * it names a stop the first one removed, the server answers a bare 403, which is indistinguishable
   * from a dead session. A ref rather than `busy`, because two clicks in one tick both read the
   * same render's state.
   */
  const mutating = useRef(false);

  const apply = async (label, fn) => {
    if (mutating.current) {
      return;
    }
    mutating.current = true;
    setBusy(label);
    try {
      setTrip(await fn());
    } catch (e) {
      fail(e);
    } finally {
      mutating.current = false;
      setBusy(null);
    }
  };

  const addPoi = async (poi) => {
    setAdding(poi.id);
    try {
      setTrip(await addItem(trip.id, { poiId: poi.id, dayIndex: activeDay }));
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
      const updated = await optimizeDayApi(trip.id, dayIndex);
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
      const updated = await rebalanceApi(trip.id);
      message.success(t('plan.rebalanced'));
      return updated;
    });

  /**
   * A trip the traveller never named carries the day count in its title ("3 days in San Francisco").
   * Changing the length from the top bar has to carry the title along, or the two disagree; a title
   * the traveller typed themselves is left exactly as it is.
   */
  const updateSettings = (body) => {
    const patch = { ...body };
    if (body.numDays && body.numDays !== trip.numDays) {
      const namedIn = autoNamedIn(trip.title, trip.numDays, trip.city.name);
      if (namedIn) {
        patch.title = defaultTripTitle(namedIn, body.numDays, trip.city.name);
      }
    }
    return apply('settings', async () => {
      const updated = await updateTrip(trip.id, patch);
      if (patch.title) {
        setTrips(await getTrips());
      }
      return updated;
    });
  };

  const applySuggestion = (suggestion) => {
    if (suggestion.kind === 'REBALANCE' && suggestion.itemId) {
      return apply('suggestion', () =>
        moveItem(trip.id, suggestion.itemId, { dayIndex: suggestion.toDay, seq: null }),
      );
    }
    return undefined;
  };

  const createTrip = async (body) => {
    try {
      const created = await createTripApi(body);
      setTrip(created);
      setActiveDay(1);
      setTab('explore');
      setNewTripOpen(false);
      setTrips(await getTrips());
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
          <span className="brand-mark">
            <CompassOutlined />
          </span>
          {t('app.name')}
        </div>

        {trip && (
          <Popover
            trigger="click"
            placement="bottomLeft"
            title={t('settings.title')}
            content={
              <TripSettings
                trip={trip}
                trips={trips}
                onOpenTrip={openTrip}
                onChange={updateSettings}
              />
            }
          >
            <button type="button" className="trip-control">
              <span className="trip-control-hero">{trip.city.heroEmoji}</span>
              <span className="trip-control-labels">
                <span className="trip-control-title">{trip.title}</span>
                <span className="trip-control-meta">
                  {t('top.tripSummary', {
                    days: trip.numDays,
                    stops: trip.plannedCount,
                    hour: trip.dayStartHour,
                  })}
                </span>
              </span>
              <DownOutlined className="trip-control-caret" />
            </button>
          </Popover>
        )}

        <div className="topbar-spacer" />

        <Button icon={<PlusOutlined />} onClick={() => setNewTripOpen(true)}>
          {t('top.newTrip')}
        </Button>

        <LanguageSwitch />

        <Dropdown
          menu={{ items: [{ key: 'out', label: t('auth.signOut'), onClick: signOut }] }}
          trigger={['click']}
        >
          <Button icon={<UserOutlined />}>{user.displayName || user.username}</Button>
        </Dropdown>
      </div>

      <div className="workspace">
        <aside className="side">
          {!trip || loadingTrip ? (
            <div className="panel-center">
              <Spin />
            </div>
          ) : (
            <Tabs
              activeKey={tab}
              onChange={setTab}
              style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
              tabBarStyle={{ padding: '0 20px', marginBottom: 0 }}
              items={[
                {
                  key: 'explore',
                  label: t('explore.tab'),
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
                  label: t('plan.tab'),
                  children: (
                    <ItineraryPanel
                      trip={trip}
                      activeDay={activeDay}
                      onActiveDay={setActiveDay}
                      busy={busy}
                      onFocus={setFocus}
                      onReorder={(ids) => apply('reorder', () => reorderDay(trip.id, activeDay, ids))}
                      onMove={(item, dayIndex) =>
                        apply('move', () => moveItem(trip.id, item.id, { dayIndex, seq: null }))
                      }
                      onRemove={(item) => apply('remove', () => removeItem(trip.id, item.id))}
                      onLock={(item) => apply('lock', () => toggleLock(trip.id, item.id))}
                      onOptimizeDay={optimizeDay}
                      onRebalance={rebalance}
                      onModeChange={(mode) => apply('mode', () => updateTrip(trip.id, { defaultMode: mode }))}
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

/**
 * The design merges the trip picker into this popover: the top bar carries one control, so switching
 * trips lives next to the settings for the trip it switches away from.
 */
function TripSettings({ trip, trips, onOpenTrip, onChange }) {
  const { t } = useI18n();
  return (
    <div style={{ width: 260 }}>
      {trips.length > 1 && (
        <>
          <div className="panel-note">{t('settings.switch')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '6px 0 0' }}>
            {trips
              .filter((item) => item.id !== trip.id)
              .map((item) => (
                <Button key={item.id} type="text" block onClick={() => onOpenTrip(item.id)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <span>{item.heroEmoji}</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span className="trip-control-title">{item.title}</span>
                      <span className="trip-control-meta">
                        {t('top.tripOption', { days: item.numDays, stops: item.plannedCount })}
                      </span>
                    </span>
                  </span>
                </Button>
              ))}
          </div>
          <Divider style={{ margin: '10px 0' }} />
        </>
      )}
      <div className="panel-note">{t('settings.length')}</div>
      <Slider
        min={1}
        max={15}
        defaultValue={trip.numDays}
        marks={{ 1: '1', 8: '8', 15: '15' }}
        onChangeComplete={(v) => onChange({ numDays: v })}
      />
      <div className="panel-note">{t('settings.dayStart')}</div>
      <Slider
        min={6}
        max={12}
        defaultValue={trip.dayStartHour}
        marks={{ 6: '6:00', 9: '9:00', 12: '12:00' }}
        onChangeComplete={(v) => onChange({ dayStartHour: v })}
      />
      <div className="panel-note" style={{ lineHeight: 1.5 }}>
        {t('settings.shrinkNote')}
      </div>
    </div>
  );
}
