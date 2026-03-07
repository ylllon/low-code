# my-low-code 项目功能与结构分析

> 分析时间：2026-03-04  
> 分析范围：仓库当前代码（`src`、`plugin`、`scripts`、配置文件）

## 1. 项目定位（当前状态）

该项目是一个基于 **Vue 3 + Vite + Pinia + Vue Router** 的低代码平台前端雏形，已经具备了“应用壳层 + 登录鉴权骨架 + 动态权限路由 + 编辑器三栏布局基础UI”的主干能力，但核心低代码能力（组件编排、画布渲染、动作编排、数据源管理）仍处于占位或半完成状态。

## 2. 技术栈与工程基础

- 前端框架：Vue 3（`<script setup lang="ts">`）
- 构建工具：Vite 5
- 路由：vue-router 4（使用自定义 `createYlRouter` 二次封装）
- 状态管理：Pinia
- HTTP：Axios（封装了 `BaseAxios` + 统一拦截）
- 存储：`vue-ls`（本地存储 token/user）
- UI图标：`@icon-park/vue-next`
- 加密工具：`jssm4`
- 工程化：ESLint + Prettier + Husky + lint-staged + commitizen + commitlint

关键入口：

- `src/main.ts`：创建应用，注册 `pinia`、`router`、`core`
- `src/router.ts`：调用 `createYlRouter(...)` 组装路由
- `src/core/index.ts`：核心插件安装（记录 Vue 实例 + 指令注册）
- `vite.config.ts`：本地开发端口 `8000`，`/api` 代理到 `http://localhost:3000`

## 3. 目录结构（按职责）

```text
src/
  App.vue                    # 根组件，仅渲染 RouterView，并发送 HMR ws 消息
  main.ts                    # 应用入口
  router.ts                  # 路由入口（createYlRouter）

  assets/                    # 全局样式、变量、图片
  components/
    AppNavigator.vue         # 顶部导航（数据源/布局/动作）

  core/                      # 平台核心能力层
    api/                     # Axios封装、错误处理、权限相关API
    config/constant.ts       # token key、SM4常量
    store/                   # 核心 Pinia store + Vue实例/当前webapp存储
    utils/                   # 权限判断、移动端判断、环境、工具函数
    vue/
      create-yl-router.ts    # 路由二次封装（多webapp + 鉴权前置）
      webapp.ts              # BaseWebapp，承载 beforeEach/afterEach/权限注入
      directive.ts           # v-action 权限指令
      components/dialog-result/  # PC/Mobile 弹窗

  views/                     # 业务视图层
    index.ts                 # 业务 webapp 配置（routes/baseUrl/client 等）
    router/
      basic-router.ts        # 基础路由（login、根重定向）
      permission-router.ts   # 权限路由（/app 下三大模块）

    login/login.vue
    DataSourceView/Index.vue
    ActionsView/Index.vue
    PageLayoutView/
      Index.vue
      AppLeftPanel/
      AppPreviewer/
      AppRightPanel/

plugin/
  filePlugin.js              # 自定义 Vite 插件（监听 ws:log）

scripts/
  check.ts                   # 质量检查脚本（当前执行 lint）
  pre-commit.ts              # 提交前脚本（执行 check + git add .）
```

## 4. 核心功能分析

### 4.1 登录与权限主流程

当前项目已经形成了完整的“登录 -> token持久化 -> 路由守卫 -> 权限路由注入”的骨架：

1. `login.vue` 调用 `useCoreStore().passwordLogin(...)`
2. `core/store/index.ts` 中 `setToken` 将 token 写入本地存储（`vue-ls`）
3. 路由由 `createYlRouter` 创建，并统一挂 `beforeEach`
4. `BaseWebapp.beforeEach` 中根据 token、白名单、角色信息决定跳转
5. 需要时通过 `getPermission` 拉取用户权限并动态 `addRoute`

对应能力点：

- token 过期监听（本地存储过期后自动失效处理）
- refresh token 框架（逻辑有预留）
- 401/403 全局错误弹窗与回退登录
- `v-action` 指令可按菜单权限隐藏按钮

### 4.2 路由组织方式

路由采用“基础路由 + 权限路由”分层：

- 基础路由：`/login`、`/` 重定向
- 权限路由：`/app` 下挂
  - `/app/dataSource`
  - `/app/layout`
  - `/app/actions`

这套结构适合低代码平台常见“三段式”能力分区（数据源、页面编排、动作逻辑）。

### 4.3 页面壳层与交互基础

- `AppView.vue`：提供统一壳层（顶部导航 + 子路由内容）
- `AppNavigator.vue`：
  - 顶部模块切换
  - 实时时钟（`useTime`）
  - 退出登录
  - 开发模式开关（仅本地状态）
  - 发布按钮（当前仅 UI）

### 4.4 低代码编辑器区域（布局模块）

`PageLayoutView/Index.vue` 已搭建三栏布局：

- 左侧：`AppLeftPanel`
  - 大纲抽屉（Outline）
  - 组件抽屉（Blocks）
- 中间：`AppPreviewer`（当前空实现）
- 右侧：`AppRightPanel`（当前空实现）

其中 `BlocksDrawer.vue`、`OutlineDrawer.vue` 已有结构和样式，但关键渲染/拖拽逻辑大多注释，说明模块处于脚手架阶段。

### 4.5 请求层与错误处理

请求层封装较完整：

- `BaseAxios` 提供统一 request/response 拦截
- 支持将 `PUT/DELETE` 转 `POST`（通过 `X-DestRequestMethod`）
- 自动附加 `Authorization`
- 统一解析后端 `{state, data}` 响应结构
- 统一处理异常并弹出 `dialog-result`

### 4.6 自定义 Vite 插件

`plugin/filePlugin.js` 注入了开发服务器 websocket 监听（`log` 事件），`App.vue` 在 HMR 场景主动发送日志消息。这部分更偏实验/调试用途，非业务主链路。

## 5. 当前功能完成度评估

### 已具备（可运行骨架）

- 工程化构建、格式化、lint、pre-commit 基础链路
- 应用启动与路由体系
- 登录与 token 缓存流程
- 动态权限路由注入框架
- 顶部导航与主框架页面
- 页面编排模块的三栏骨架与基础交互

### 未完成或占位（核心业务待补）

- 数据源模块（`DataSourceView/Index.vue` 仅占位）
- 动作模块（`ActionsView/Index.vue` 仅占位）
- 画布预览区与右侧属性面板（空实现）
- 组件拖拽、区块元数据、页面 schema 持久化
- 菜单与权限映射（`setMenus` 逻辑注释）

## 6. 关键风险与代码观察

1. 注释和字符串存在较多乱码（疑似历史编码不一致），影响可维护性。  
2. `views/index.ts` 中定义了 `checkRouteWhite(...)`，但基类守卫主要读取 `to.meta.checkRouteWhite`，该方法当前未见实际调用链。  
3. `package.json` 的 `scripts` 中包含 `"fast-glob": "^3.2.11"`，像是误放的依赖项。  
4. `login.vue` 使用硬编码账号密码（`zs/zs`），应替换为真实表单流程。  
5. `scripts/pre-commit.ts` 会执行 `git add .`，可能把无关文件一并纳入提交。  
6. `plugin/filePlugin.js` 中目录判断使用 `fs.lstatSync(paths).isDirectory`（缺少 `()`），逻辑存在瑕疵风险。

## 7. 结论

这是一个“低代码平台前端骨架已成型、核心编辑能力待落地”的项目。架构上已经搭好了：

- 权限与路由扩展机制
- 核心能力层（core）
- 业务视图分层
- 工程化流程

下一阶段的重点应集中在：

- 补齐 `layout` 模块的实际编辑能力（组件库、拖拽、schema、属性编辑）
- 完成数据源与动作模块的真实业务流
- 清理编码/脚本/调试残留，提升可维护性与可交付性
