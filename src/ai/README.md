# AI 助手公共契约

本目录定义模型厂商无关的 AI 助手接缝。当前阶段只建立公共契约，不包含 `executeTool` 的真实 API 实现。

## 职责边界

- B1 负责维护 `TOOLS`、校验工具参数、调用后端，并把错误转换为可读的人话。
- A1 负责把 `TOOLS` 包装成具体模型厂商要求的格式。
- A1 负责把厂商返回的工具调用统一转换为 `{ id, name, input }`。
- B2 只能通过 `executeTool(name, input, ctx)` 调用 B1，不直接调用 B1 背后的后端接口。
- 工具执行前的确认流程属于 B2；`executeTool` 内部不做二次确认。
- B2 连续调用工具时，每次成功后必须更新上下文：

  ```js
  ctx = { ...ctx, trip: result.trip };
  ```

- `tripId` 永远来自 `ctx.tripId`，不接受模型提供的 `tripId`。
- 在 `executeTool` 的真实实现完成前，B2 应 Mock `executeTool`。

## 工具定义

`tools.js` 导出厂商无关的 `TOOLS`。每个工具包含 `name`、`description` 和标准 JSON Schema `parameters`。当前公共工具为：

- `add_stop({ poiId, dayIndex })`
- `remove_stop({ itemId })`
- `move_stop({ itemId, dayIndex, seq? })`
- `optimize_day({ dayIndex })`
- `rebalance({})`
- `toggle_lock({ itemId })`

`poiId` 和 `itemId` 是正整数；`dayIndex` 从 1 开始。`seq` 是可选的零基位置，省略时表示把地点追加到目标日末尾。工具参数不包含 `tripId`。

## 执行契约

公开函数签名：

```js
export async function executeTool(name, input, ctx)
```

`ctx` 固定为：

```js
{
  tripId,
  trip,
  pois,
}
```

成功时返回：

```js
{ ok: true, trip: TripDto, summary: string }
```

失败时返回：

```js
{ ok: false, reason: string }
```
