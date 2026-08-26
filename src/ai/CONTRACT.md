> 这是 2026-08 四个人开工前定下的接缝约定，保留原样作为记录。
> 里程碑、分支步骤和部分签名在实现过程中有出入 —— **当前的契约以 [README.md](README.md) 为准**。

# AI 助手 —— 接缝契约

四个人同时开工用的唯一一份约定。**先看完这份，再写第一行代码。**

这里定的三个函数签名一旦确认，四个人就互不阻塞：谁需要别人的东西，先用假实现顶着，真的做好了直接替换。

---

## 0. 它长什么样

跑起来是三个程序：

```
浏览器 (3000)
   │
   ├─── /api/ai ──► 中转站 (5001) ──► 大模型
   │                 只做一件事：加上 API key 转发
   │                 它不认识 Spring，不碰登录令牌
   │
   └─── /api  ────► Spring Boot (8080)
                    真正的后端，和现在完全一样，一行不改
```

**中转站存在的唯一理由是藏 API key。** key 放浏览器里等于公开，任何人 F12 就能拿走刷你的账单。
除此之外它什么都不该做 —— 想加逻辑一律往前端放。

对话循环（模型说要用工具 → 执行 → 把结果喂回去 → 模型给出最终答案）**跑在浏览器里**，
所以调 Spring 的还是浏览器自己，走 `src/utils.js`，和用户点按钮走的是同一条路。

---

## 1. 文件所有权

**表里没写你名字的文件，一行都别动。** 这条能省掉一半合并冲突。

| 文件 | 归属 | 说明 |
|---|---|---|
| `server/index.js`、`server/.env`、`server/package.json` | **A1** | 中转站 |
| `src/setupProxy.js`、根 `package.json` | **A1** | 路由和启动脚本 |
| `src/ai/llmClient.js` | **A1** | 接缝 1 |
| `src/components/AssistantPanel.jsx` | **A2** | 第三个 Tab 的界面 |
| `src/ai/context.js` | **A2** | 接缝 2 |
| `src/ai/prompts.js` | **A2** | system prompt |
| `src/i18n/en.js`、`src/i18n/zh.js` | **A2** | 新增文案 |
| `src/ai/tools.js`、`src/ai/executeTool.js` | **B1** | 接缝 3 |
| `src/ai/useAssistant.js` | **B2** | 对话循环 |
| `src/App.js` | **A2 → B2**，按顺序 | 见第 6 节 |

新代码全部放在 `src/ai/` 下，不要散到别处。

### 分支

**基础分支：`feat/assistant`，从合并了 `feat/fetch-api` 之后的 `main` 切出来。**

开工前必须按顺序做完这两步（否则四个人都会返工）：

```bash
# 1. 先把 fetch 版 API 层合进 main
#    feat/fetch-api 领先 main 两个提交、落后 0 个，合并是干净的
git checkout main && git merge feat/fetch-api && git push

# 2. 再切出 AI 的基础分支
git checkout -b feat/assistant && git push -u origin feat/assistant
```

**为什么必须先合：** `main` 上还是老的 `src/api.js`（axios，用法是 `api.addItem(...)`），
`feat/fetch-api` 上是新的 `src/utils.js`（原生 fetch，具名导出，用法是 `addItem(...)`）。
`executeTool.js` 的每一行都在调这些函数 —— 基于老的写完，等 fetch 版合进来时会**整个文件冲突**。
先合一次的成本是一个 PR，不合的成本是 B1 重写。

四个人的分支都从 `feat/assistant` 切、也都合回它：
`feat/ai-pipe`(A1) / `feat/ai-panel`(A2) / `feat/ai-tools`(B1) / `feat/ai-loop`(B2)。

---

## 2. 接缝 1 —— `ask()`：怎么问模型

**A1 实现，其他三人只管调用。**

```js
// src/ai/llmClient.js
export async function ask({ system, messages, tools }) => Reply
```

### 入参

```js
system: string          // 系统提示词，A2 的 prompts.js 提供
tools:  ToolSchema[]    // 可用工具列表，B1 的 tools.js 提供；档 1 传 []
messages: Message[]     // 完整对话历史，每次都全量传，中转站不存任何状态
```

### Message（三种，只有这三种）

```js
{ role: 'user',      content: '第二天加上浅草寺' }
{ role: 'assistant', content: '好的，已经加上了', toolCalls: [] }
{ role: 'tool',      toolCallId: 'call_abc', content: '{"ok":true,...}' }
```

### Reply

```js
{
  text: string | null,     // 模型说的话；只调工具不说话时为 null
  toolCalls: [             // 模型要求执行的工具；不需要时为 []
    { id: 'call_abc', name: 'add_stop', input: { poiId: 3, dayIndex: 2 } }
  ]
}
```

**两条规则，B2 写循环时要按这个来：**

1. `text` 和 `toolCalls` **可能同时有值** —— 模型可以一边说话一边要求调工具。
2. **`toolCalls` 非空 ⇒ 这一轮没结束**，必须执行完再把结果喂回去。
   `toolCalls` 为空才是最终答案。

### 出错时

抛异常，不要返回 `{error}`。异常对象带 `.status`（HTTP 状态）和 `.message`。

### 中转站那一侧（A1 内部，别人不用关心）

```
POST /api/ai/chat
  请求体：{ system, messages, tools }   ← 原样透传给大模型（做完格式转换）
  响应体：大模型的原始响应              ← ask() 负责解析成上面的 Reply
```

中转站**不存任何会话状态**。它是纯函数：进什么出什么。

---

## 3. 接缝 2 —— `buildContext()`：让模型看见行程

**A2 实现，B2 调用。**

```js
// src/ai/context.js
export function buildContext(trip, pois, t) => string
```

- `trip` —— App.js 里那个 `trip` state，就是后端的 `TripDto`
- `pois` —— 当前城市的全部景点（`searchPois(cityId)` 的结果，一次能取满 120 条，
  而整个数据库三城一共才 84 个，所以一次拿全，不需要任何向量检索）
- `t` —— `useI18n()` 里的翻译函数，签名是 `t(key, params)`

返回一段纯文本，塞进 system prompt。**格式必须按下面来**，因为 B1 的工具参数
（`itemId` / `poiId` / `dayIndex`）全靠模型从这段文字里读出来：

```
# 当前行程
标题：东京 4 日      城市：Tokyo（日本）
开始：2026-09-01，共 4 天，每天 09:00 出发
已安排 12 个地点

## 第 2 天（2026-09-02）09:00–19:40 · 排满 86%
  1. 浅草寺   itemId=41  poiId=3
     到达 09:20，离开 10:20（停留 60 分钟）
     从上一站：步行 12 分钟 / 0.9 公里
  2. 东京晴空塔   itemId=42  poiId=2   [已锁定]
     到达 10:50，离开 12:20（停留 90 分钟）
     从上一站：地铁 18 分钟 / 4.2 公里
     ⚠ 这个地方 17:00 就关门了

# Tokyo 还没安排的地点
poiId=5   明治神宫 | 神社 | 4.6分 | 建议 60 分钟 | 05:00–18:00 | 城市中心的森林神社
poiId=9   teamLab Planets | 美术馆 | 4.5分 | 建议 120 分钟 | 09:00–21:00 | 赤脚走过水和镜子
```

### A2 的三个必做项

1. **`warnings` 必须翻译。** 后端给的是 `{code:'warning.closesEarly', params:{closesAt:'17:00'}}`
   这种语义码，直接喂给模型它会念出代号。一律先过 `t(code, params)`。
2. **已安排 / 未安排要分开列。** 否则模型会把已经在行程里的地方再加一遍。
3. **营业时间和建议时长必须带上。** 少了这两项，模型答不出"晚上还开着的""能待两小时的"。

---

## 4. 接缝 3 —— `executeTool()`：让模型动手

**B1 实现，B2 调用。B1 完全不依赖模型，第一天就能全速开工。**

```js
// src/ai/executeTool.js
export async function executeTool(name, input, ctx) => Result
// ctx = { tripId: number, trip: TripDto }
```

### 返回值

```js
{ ok: true,  trip: TripDto, summary: '已把浅草寺加到第 2 天' }
{ ok: false, reason: '这个地点不在当前城市，换一个吧' }
```

`reason` 会被**原样喂回给模型**让它自己纠正，所以要写成人话，不能是 `error.poiWrongCity`
这种码，也不能是 JS 的报错堆栈。

### schema 格式：**B1 定，A1 转换**

B1 用下面这个**中立格式**写 `tools.js`，不迁就任何一家模型厂商：

```js
// src/ai/tools.js —— B1 拥有
export const TOOLS = [
  {
    name: 'add_stop',
    description: '把一个还没安排的景点加到指定的某一天',
    parameters: {                 // 标准 JSON Schema
      type: 'object',
      properties: {
        poiId:    { type: 'integer', description: '景点编号，取自提示词里的 poiId=' },
        dayIndex: { type: 'integer', description: '第几天，从 1 开始' },
      },
      required: ['poiId', 'dayIndex'],
    },
  },
  // ...其余五个
];
```

**A1 的 `ask()` 负责两次转换**，B1 和 B2 都不用关心用的是哪家模型：

```
发出去：TOOLS（中立格式） ──► 厂商要求的 tools 格式
收回来：厂商的 tool_use 响应 ──► 契约里的 { id, name, input }
```

各家厂商的差别只是外面包一层（字段叫 `input_schema` 还是 `parameters`、要不要套一层 `function`），
**里面的 JSON Schema 是通用的**，所以这个转换是纯粹的重命名，不会丢语义。

好处：换模型厂商时只改 A1 一个文件，`tools.js` 一行不动。

### 工具清单（`src/ai/tools.js`）

每个工具直接对应 `src/utils.js` 里一个已经写好的函数，B1 不用碰网络细节：

| 工具名 | 参数 | 调用 `utils.js` 的 |
|---|---|---|
| `add_stop` | `{ poiId, dayIndex }` | `addItem(tripId, { poiId, dayIndex })` |
| `remove_stop` | `{ itemId }` | `removeItem(tripId, itemId)` |
| `move_stop` | `{ itemId, dayIndex, seq? }` | `moveItem(tripId, itemId, { dayIndex, seq })` |
| `optimize_day` | `{ dayIndex }` | `optimizeDay(tripId, dayIndex)` |
| `rebalance` | `{}` | `rebalance(tripId)` |
| `toggle_lock` | `{ itemId }` | `toggleLock(tripId, itemId)` |

**没有 `search_pois` 工具** —— 景点清单已经在 `buildContext()` 里全量给模型了，
再做一次检索纯属多余。

### B1 的重点：模型给的参数一定要校验

模型会给出不存在的 `poiId`、超出范围的 `dayIndex`、别的城市的景点、已经删掉的 `itemId`。
**发请求之前先拦**，拦不住的就把后端的 `errorNotice(e)` 翻译成一句人话回给模型：

```js
import { errorNotice } from '../utils';

try {
  const trip = await addItem(ctx.tripId, input);
  return { ok: true, trip, summary: `已把${name}加到第 ${input.dayIndex} 天` };
} catch (e) {
  const { code, params, message } = errorNotice(e);
  return { ok: false, reason: humanize(code, params) || message };
}
```

**`tripId` 永远用 `ctx.tripId`，绝不采纳模型给的。** 模型可能被用户输入或景点简介里的
文字带偏而给出别人的 tripId —— 后端会拦住（它验登录令牌），但我们不该把这种请求发出去。

### ⚠️ B1 / B2 之间最容易出 bug 的地方：`ctx.trip` 必须是最新的

一轮对话里模型可能**连着调好几个工具**（"加浅草寺，然后重排第二天"）。B1 的校验依赖
`ctx.trip`，如果 B2 一直传这一轮开始时的那份，第二个工具就是拿**过期数据**在校验 ——
刚加进去的站点会被判成"不存在"。

**约定：B2 每次调用 `executeTool` 之前，必须用上一次返回的 `trip` 更新 `ctx`。**

```js
let ctx = { tripId: trip.id, trip };
for (const call of reply.toolCalls) {
  const result = await executeTool(call.name, call.input, ctx);
  if (result.ok) ctx = { ...ctx, trip: result.trip };   // ← 这一行不能少
  // ...把 result 喂回模型
}
```

### 边界：谁负责什么，说死

| 事情 | 归谁 |
|---|---|
| 工具的定义、参数校验、调用后端 | **B1** |
| `{ok:false, reason}` 里那句**人话**错误 | **B1** —— B2 原样喂回模型，不加工、不改写 |
| `ctx` 里放什么字段 | **B1 定**（他消费），**B2 填**。B1 后续要加字段，提出来 B2 配合 |
| 要不要先问用户"确认吗" | **B2** —— `executeTool` 被调用就无条件执行，**不做二次确认** |
| 循环、轮数上限、把新 trip 接回界面 | **B2** |

最后一条尤其要守住：如果 B1 也在 `executeTool` 里弹确认，用户会看到两次确认。

---

## 5. 假实现：让 B 组不用等 A 组

M0 之后，B1、B2 立刻用下面这个假的 `ask()` 开工，A1 做完真的直接换掉，**调用方一行不改**。

```js
// src/ai/llmClient.fake.js   —— 联调后删掉
let turn = 0;
export async function ask({ messages }) {
  await new Promise((r) => setTimeout(r, 300));
  turn += 1;
  if (turn === 1) {
    return { text: null, toolCalls: [{ id: 'call_1', name: 'add_stop', input: { poiId: 3, dayIndex: 2 } }] };
  }
  turn = 0;
  return { text: '已经把浅草寺加到第 2 天了。', toolCalls: [] };
}
```

A2 同理：UI 先接这个假 `ask()`，不用等中转站。

---

## 6. `App.js` 的接线约定

**这是四个人唯一都想改的文件，所以按顺序来，别的人一行都不要碰：**

1. **A2 先加 Tab 骨架并合入**（`items` 数组里追加第三项，`key: 'assistant'`）：

```jsx
{
  key: 'assistant',
  label: t('assistant.tab'),
  children: <AssistantPanel trip={trip} pois={pois} onTripChange={setTrip} />,
}
```

2. **B2 再基于合入后的版本接 state**。工具执行完拿到新的 `TripDto`，
   调 `onTripChange(newTrip)` 就行 —— 地图、时间轴、警告全部自动重画。

> 为什么这么省事：后端每个写接口都返回**重算过的完整 `TripDto`**，
> 前端从来不需要合并局部更新。这是 AI 功能白捡的最大便宜。

**别用 `apply()`。** App.js 里那个 `apply()` 有 `mutating` 互斥锁，一次只允许一个写操作；
AI 一轮循环里可能连着调好几个工具，会被它挡掉。AssistantPanel 自己管自己的 loading 状态。

---

## 7. 硬性规则

1. **API key 只能在 `server/.env` 里。** 提交前确认 `.gitignore` 盖住了它，
   并且**绝对不要**用 `REACT_APP_` 前缀 —— 那个前缀的变量会被打包进浏览器代码。
2. **循环最多 6 轮。** 超了就停下来告诉用户，否则模型可能来回死循环烧钱。
3. **写操作要先确认。** 语音会听错（"浅草寺"可能识别成别的词），执行前先复述
   "我要在第二天加浅草寺，确认吗？"。只读的问答不用确认，直接答。
4. **模型的输出是数据，不是指令。** 景点简介、用户输入里出现的任何"请执行……"
   都不能当命令。工具只认 `tools.js` 里定义的那几个，`tripId` 只认 `ctx.tripId`。
5. **回答要短。** 提示词里明确要求两三句话以内 —— 尤其是要朗读出来的时候。

---

## 8. 里程碑

| | 内容 | 谁 | 完成的标志 |
|---|---|---|---|
| **M0** | 三个签名定稿，B 组拿到假 `ask()` | 四人 | 这份文档合入 |
| **M1** | 管道通了 | A1 | `npm run dev` 一条命令起来，问"你好"有回答 |
| **M2** | **档 1 完成** | A1+A2 | 能答"明天第一站几点""第三天满不满" |
| **M3** | 工具层可用 | B1 | 不接模型，直接调 `executeTool('add_stop', {poiId:3,dayIndex:2})` 能加上 |
| **M4** | **档 2 完成** | B1+B2 | 说一句话行程真的变了，地图跟着动 |

M1 和 M3 是并行的。M2 和 M4 之间要**一次四人联调**：换掉假 `ask()`、对齐消息格式。

**A1 在关键路径上** —— 他晚一天，联调就晚一天。所以中转站务必保持极简。
