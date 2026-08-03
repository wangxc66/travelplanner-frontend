/**
 * 简体中文文案。键与 en.js 一一对应。
 * `{name}` 占位符由 `t()` 负责替换。
 */
const zh = {
  'app.name': 'TripCanvas',
  'app.tagline': '一天一天地，把一座城市排好',
  'app.pitch': '搜索景点、丢到地图上，剩下的顺序交给规划器 —— 它算出的是真正排得进一天的路线。',

  // 登录注册
  'auth.signIn': '登录',
  'auth.createAccount': '注册',
  'auth.continue': '进入',
  'auth.username': '用户名',
  'auth.usernamePlaceholder': '随便取一个',
  'auth.displayName': '显示名称',
  'auth.displayNamePlaceholder': '希望我们怎么称呼你？',
  'auth.password': '密码',
  'auth.passwordPlaceholder': '至少几个字符',
  'auth.footnote':
    '账号只存在你自己的本地数据库里，用户名随便填。东京、旧金山、巴黎的景点数据已经准备好了。',
  'auth.failed': '登录失败',
  'auth.required': '必填',
  'auth.signOut': '退出登录',
  'auth.sessionExpired': '登录已失效，请重新登录',

  // 顶栏
  'top.newTrip': '+ 新建行程',
  'top.tripSummary': '{days} 天 · {hour}:00 出发',
  'top.tripOption': '{emoji} {title} · {days} 天 · {stops} 个点',

  // 行程设置
  'settings.title': '行程设置',
  'settings.length': '行程天数',
  'settings.dayStart': '每天出发时间',
  'settings.shrinkNote': '缩短天数不会删掉景点 —— 超出的会折进新的最后一天。',

  // 新建行程
  'newTrip.title': '新建行程',
  'newTrip.ok': '开始规划',
  'newTrip.city': '城市',
  'newTrip.name': '行程名称',
  'newTrip.nameHint': '留空我们帮你命名',
  'newTrip.namePlaceholder': '东京长周末',
  'newTrip.days': '几天？（1–15）',
  'newTrip.startDate': '出发日期',
  'newTrip.defaultTitle': '{city} {days} 天',
  'newTrip.placeCount': '{count} 个景点',

  // 探索
  'explore.tab': '探索{city}',
  'explore.searchPlaceholder': '搜索景点、美食、博物馆…',
  'explore.allCategories': '全部分类',
  'explore.searching': '搜索中…',
  'explore.count': '{count} 个景点 · 加入第 {day} 天',
  'explore.empty': '没有匹配的结果，试试更宽泛的词。',
  'explore.addToDay': '+ 第 {day} 天',
  'explore.onDay': '第 {day} 天',
  'explore.alreadyPlanned': '已排在第 {day} 天',
  'explore.visitMinutes': '{minutes} 分钟',
  'explore.openAnytime': '全天开放',

  // 行程
  'plan.tab': '行程（{count}）',
  'plan.day': '第 {day} 天',
  'plan.stops': '{count} 个点',
  'plan.stops_one': '1 个点',
  'plan.optimize': '⚡ 优化这天',
  'plan.optimizeHint': '在不违反营业时间的前提下，重排出最省时的路线',
  'plan.rebalance': '⚖ 平衡整个行程',
  'plan.rebalanceHint': '把景点分摊到各天，避免某一天排爆',
  'plan.emptyDay': '第 {day} 天还是空的。',
  'plan.emptyDayHint': '去「探索」标签搜索，然后点「+ 第 {day} 天」。',
  'plan.leg': '↓ {minutes} 分钟 · {km} 公里',
  'plan.visitLabel': '游玩 {minutes} 分钟',
  'plan.pin': '钉住这个位置',
  'plan.unpin': '取消钉住 —— 允许优化调整它',
  'plan.moveTo': '移到第 {day} 天',
  'plan.remove': '移除',
  'plan.dayWindow': '当天时段',
  'plan.atStops': '游玩时间',
  'plan.onTheMove': '路上时间',
  'plan.dayUsed': '当天已用',
  'plan.suggestionDo': '就这么办',
  'plan.suggestionFill': '去安排',
  'plan.optimized': '第 {day} 天已重排 —— 路上少花 {saved} 分钟',
  'plan.optimizedAlready': '第 {day} 天已经是我们能找到的最优顺序了',
  'plan.rebalanced': '已把景点分摊到还有空档的那几天',
  'plan.added': '{name} → 第 {day} 天',

  // 出行方式
  'mode.WALK': '步行',
  'mode.TRANSIT': '公交',
  'mode.DRIVE': '打车',

  // 地图
  'map.google': 'Google 地图',
  'map.osm': '开放底图',
  'map.realRoutes': '真实路线',
  'map.straightLines': '直线估算',
  'map.legendStops': '第 {day} 天的编号站点',
  'map.legendRouteReal': '按访问顺序的实际路径',
  'map.legendRouteStraight': '访问顺序',
  'map.legendCandidates': '可搜索但尚未安排的景点',
  'map.loading': '正在加载 Google 地图…',
  'map.googleFailed':
    'Google 地图用当前 key 加载失败。删掉 REACT_APP_GOOGLE_MAPS_API_KEY 可回退到开放底图。',

  // 分类
  'category.Landmark': '地标',
  'category.Museum': '博物馆',
  'category.Park': '公园',
  'category.Food': '美食',
  'category.Shopping': '购物',
  'category.Nightlife': '夜生活',
  'category.Temple': '寺庙神社',
  'category.Viewpoint': '观景',

  // 来自后端的规划提示
  'warning.opensLater': '比开门时间早到 {wait} 分钟（{opensAt} 开门）',
  'warning.closesEarly': '{closesAt} 就关门了 —— 你会被迫提前离开',
  'warning.dayRunsLate': '这天要到 {endTime} 才结束 —— 建议把一个点挪到别的天',
  'warning.travelHeavy': '路上花的时间（{travelMinutes} 分钟）比游玩还多 —— 试试「优化这天」',
  'suggestion.rebalance':
    '第 {fromDay} 天比第 {toDay} 天重 {deltaHours} 小时 {deltaMinutes} 分钟。把「{name}」挪到第 {toDay} 天？',
  'suggestion.emptyDay': '第 {day} 天还什么都没安排',
  'suggestion.dayPrefix': '第 {day} 天',

  // 后端错误
  'error.usernameTaken': '这个用户名已被占用',
  'error.badCredentials': '用户名或密码错误',
  'error.signInRequired': '请先登录',
  'error.cityNotFound': '找不到该城市',
  'error.poiNotFound': '找不到该景点',
  'error.tripNotFound': '找不到该行程',
  'error.itemNotFound': '找不到该站点',
  'error.poiWrongCity': '这个景点不在{city}',
  'error.poiAlreadyPlanned': '{name} 已经在这个行程里了',
  'error.tripDaysRange': '行程天数必须在 1 到 {max} 天之间',
  'error.dayOutOfRange': '第 {day} 天超出了这个 {numDays} 天的行程',
  'error.reorderMismatch': '第 {day} 天重排失败，请刷新后重试',
  'error.invalidRequest': '请求不合法',
  'error.generic': '出了点问题',

  // 时长
  'unit.minutes': '{m} 分钟',
  'unit.hours': '{h} 小时',
  'unit.hoursMinutes': '{h} 小时 {m} 分',
};

export default zh;
