import {
  addItem,
  errorNotice,
  moveItem,
  optimizeDay,
  rebalance,
  removeItem,
  toggleLock,
} from '../utils';
import { TOOLS } from './tools';

const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

const summaries = {
  add_stop: ({ dayIndex }) => `已把地点添加到第 ${dayIndex} 天`,
  remove_stop: () => '已从行程中移除该地点',
  move_stop: ({ dayIndex }) => `已把地点移动到第 ${dayIndex} 天`,
  optimize_day: ({ dayIndex }) => `已优化第 ${dayIndex} 天的游览顺序`,
  rebalance: () => '已重新平衡每天的行程',
  toggle_lock: () => '已切换该地点的锁定状态',
};

function fail(reason) {
  return { ok: false, reason };
}

function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validateSchema(tool, input) {
  if (!isPlainObject(input)) {
    return '工具参数必须是一个普通对象。';
  }

  const { properties, required } = tool.parameters;
  const unexpected = Object.keys(input).find((key) => !Object.prototype.hasOwnProperty.call(properties, key));
  if (unexpected) {
    return `参数 ${unexpected} 不属于工具 ${tool.name}。`;
  }

  const missing = required.find((key) => !Object.prototype.hasOwnProperty.call(input, key));
  if (missing) {
    return `缺少必填参数 ${missing}。`;
  }

  for (const [key, value] of Object.entries(input)) {
    const schema = properties[key];
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      return `参数 ${key} 必须是整数。`;
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      return `参数 ${key} 不能小于 ${schema.minimum}。`;
    }
  }

  return null;
}

function validateContext(ctx) {
  if (!isPlainObject(ctx)) {
    return '工具上下文必须是一个普通对象。';
  }
  if (!Number.isInteger(ctx.tripId) || ctx.tripId < 1) {
    return '当前行程编号无效，请刷新后重试。';
  }
  if (!isPlainObject(ctx.trip)) {
    return '当前行程数据无效，请刷新后重试。';
  }
  if (!Number.isInteger(ctx.trip.numDays) || ctx.trip.numDays < 1) {
    return '当前行程天数无效，请刷新后重试。';
  }
  if (!Array.isArray(ctx.trip.days)) {
    return '当前行程的每日安排无效，请刷新后重试。';
  }
  if (ctx.trip.days.some((day) => !isPlainObject(day))) {
    return '当前行程包含无效的日期数据，请刷新后重试。';
  }
  if (ctx.trip.days.some((day) => !Array.isArray(day.items))) {
    return '当前行程包含无效的站点列表，请刷新后重试。';
  }
  if (!Array.isArray(ctx.pois)) {
    return '当前景点列表不可用，请刷新后重试。';
  }

  return null;
}

function tripItems(trip) {
  return trip.days.flatMap((day) => day.items);
}

function validateContextAndReferences(name, input, ctx) {
  if (Object.prototype.hasOwnProperty.call(input, 'dayIndex')) {
    if (input.dayIndex > ctx.trip.numDays) {
      return `第 ${input.dayIndex} 天超出了这个 ${ctx.trip.numDays} 天的行程。`;
    }
  }

  const items = tripItems(ctx.trip);
  if (Object.prototype.hasOwnProperty.call(input, 'itemId') && !items.some((item) => item?.id === input.itemId)) {
    return '找不到要操作的行程站点，请刷新后重试。';
  }

  if (name === 'add_stop') {
    if (!Array.isArray(ctx?.pois)) {
      return '当前景点列表不可用，请刷新后重试。';
    }
    if (!ctx.pois.some((poi) => poi?.id === input.poiId)) {
      return '找不到要添加的景点，请从当前城市的景点中选择。';
    }
    if (items.some((item) => item?.poi?.id === input.poiId || item?.poiId === input.poiId)) {
      return '这个景点已经在当前行程里了。';
    }
  }

  return null;
}

function safeMessage(message) {
  if (typeof message !== 'string') return null;
  const firstLine = message.split(/\r?\n/).find((line) => line.trim());
  return firstLine?.trim() || null;
}

function humanizeNotice(notice) {
  const params = notice?.params || {};
  const knownReasons = {
    'error.signInRequired': '请先登录后再修改行程。',
    'error.cityNotFound': '找不到当前城市，请刷新后重试。',
    'error.poiNotFound': '找不到该景点，请换一个试试。',
    'error.tripNotFound': '找不到当前行程，请刷新后重试。',
    'error.itemNotFound': '找不到该行程站点，请刷新后重试。',
    'error.poiWrongCity': `这个景点不在${params.city || '当前城市'}。`,
    'error.poiAlreadyPlanned': `${params.name || '这个景点'}已经在当前行程里了。`,
    'error.tripDaysRange': `行程天数必须在 1 到 ${params.max || '允许的最大'} 天之间。`,
    'error.dayOutOfRange': `第 ${params.day || '?'} 天超出了这个 ${params.numDays || '?'} 天的行程。`,
    'error.reorderMismatch': `第 ${params.day || '?'} 天重排失败，请刷新后重试。`,
    'error.invalidRequest': '这次工具请求不合法，请检查参数后重试。',
  };

  return knownReasons[notice?.code] || safeMessage(notice?.message) || '工具执行失败，请稍后重试。';
}

function backendFailure(error) {
  try {
    return fail(humanizeNotice(errorNotice(error)));
  } catch {
    return fail('工具执行失败，请稍后重试。');
  }
}

async function callTool(name, input, tripId) {
  switch (name) {
    case 'add_stop':
      return addItem(tripId, { poiId: input.poiId, dayIndex: input.dayIndex });
    case 'remove_stop':
      return removeItem(tripId, input.itemId);
    case 'move_stop':
      return moveItem(tripId, input.itemId, {
        dayIndex: input.dayIndex,
        ...(input.seq === undefined ? {} : { seq: input.seq }),
      });
    case 'optimize_day':
      return optimizeDay(tripId, input.dayIndex);
    case 'rebalance':
      return rebalance(tripId);
    case 'toggle_lock':
      return toggleLock(tripId, input.itemId);
    default:
      return null;
  }
}

export async function executeTool(name, input, ctx) {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) {
    return fail(`未知工具：${String(name)}。`);
  }

  const schemaError = validateSchema(tool, input);
  if (schemaError) return fail(schemaError);

  const contextError = validateContext(ctx);
  if (contextError) return fail(contextError);

  const referenceError = validateContextAndReferences(name, input, ctx);
  if (referenceError) return fail(referenceError);

  try {
    const updatedTrip = await callTool(name, input, ctx.tripId);
    return { ok: true, trip: updatedTrip, summary: summaries[name](input) };
  } catch (error) {
    return backendFailure(error);
  }
}
