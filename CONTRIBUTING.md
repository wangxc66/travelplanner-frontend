# 参与开发

前端仓库。后端在 [travelplanner](https://github.com/wangxc66/travelplanner)，
两边的流程是一样的。开发时两个都要跑起来。

## 第一次上手

```bash
git clone https://github.com/wangxc66/travelplanner-frontend.git
cd travelplanner-frontend
npm install
npm start
```

后端要同时开着（在另一个终端里 `./gradlew bootRun`）。`package.json` 里配了
`proxy: http://localhost:8080`，所以前端代码里写 `/api/...` 就行，不用拼完整地址。

两个已经配好、不用你动的东西：

- `.env.development` **是故意提交进仓库的**，里面是 dev server 的配置（不是密钥），
  文件里的注释解释了为什么。不要删它，删了在校园网/VPN 下 `npm start` 会起不来。
- Google Maps key 是可选的。不填就用开源底图，填了就渲染 Google 地图。要填的话
  新建 `.env.local`（已 ignore，不会被提交）：

  ```
  REACT_APP_GOOGLE_MAPS_API_KEY=你自己的key
  ```

  别把 key 写进 `.env.development` 或者贴到群里——仓库是 public 的。

## 日常流程

1. **从最新的 main 开分支**，一人一分支，不要几个人共用一个：

   ```bash
   git checkout main && git pull
   git checkout -b feat/trip-timeline
   ```

   命名：`feat/` 新功能，`fix/` 修 bug，`docs/` 只改文档。

2. **小步提交。** 一个 commit 只做一件事，消息写「做了什么」而不是「改了哪个文件」：
   `Keep the map centred when a stop is dragged` 好过 `update MapView.js`。

3. **推上去，开 PR：**

   ```bash
   git push -u origin feat/trip-timeline
   ```

   PR 模板会自动带出来，照着填，改了界面就贴图。CI 会自动跑 `npm run build`，绿了才能合。

4. **等一个 approve**，然后合进 main。合完删掉分支（GitHub 会给按钮）。

## 不要提交的东西

`.gitignore` 已经挡掉了 `node_modules/`、`build/`、`.env.local`、IDE 配置。
另外**任何 API key 都不要进仓库**，即使是在注释里。

不小心提交了 key 的话，改掉它然后立刻去 Google Cloud 控制台吊销旧的——从 git 历史里
删掉不等于它没泄露过。

## 冲突了怎么办

先在自己分支上把 main 同步进来，在本地解决完再推：

```bash
git checkout main && git pull
git checkout feat/trip-timeline
git merge main
```

解决冲突 → `git add` → `git commit` → `git push`。

`package-lock.json` 冲突的话别手动改，删掉它然后 `npm install` 重新生成。

不要用 `git push --force`，也不要在别人的分支上 rebase。

## 卡住了

在 issue 或者 PR 里直接 @wangxc66，把浏览器控制台的完整报错贴上来。
