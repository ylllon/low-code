# 低码页面预览与打包校验 MVP 技术方案

## 1. 目标与范围（MVP）

### 1.1 目标

在当前项目基础上，以最小改动实现两件事：

1. 可在浏览器中预览当前画布生成页面的实际效果（真实 dev server 渲染）。
2. 可校验当前生成代码是否能通过打包工具（Vite）构建。

### 1.2 非目标（本期不做）

1. 不做云端容器隔离构建。
2. 不做多租户构建队列。
3. 不做源码级 AST 自动修复。
4. 不做跨仓库依赖注入。

---

## 2. 现状与最小改动原则

### 2.1 已有能力（可复用）

当前代码已经具备：

1. 项目预览进程生命周期管理（start/status/stop/stop-all）：
   - `service/src/controllers/projectController.js`
   - `service/src/services/previewService.js`
2. 前端预览状态管理：
   - `src/views/PageLayoutView/project-preview.types.ts`
   - `src/views/PageLayoutView/AppLeftPanel/OutlineDrawer.vue`
   - `src/views/PageLayoutView/AppPreviewer/AppPreviewer.vue`
3. 画布 DSL -> Vue SFC 源码生成能力（且 DSL 已 sidecar 化）。

### 2.2 MVP 实现策略

采用双通道，先保证可落地：

1. 运行预览通道（已有）：继续使用 `/project/v1/preview/start` 启动项目 dev server，在 iframe 中查看实际效果。
2. 构建校验通道（新增）：新增后端接口执行一次真实 `vite build`（或项目 build 脚本），返回结构化结果与日志摘要。

---

## 3. 架构总览（MVP）

```text
画布编辑 -> 生成源码并保存到文件系统
        -> [预览按钮] 调用 preview/start -> iframe 打开 previewUrl
        -> [校验按钮] 调用 preview/validate-build -> 返回 pass/fail + 日志 + 错误码
```

关键点：

1. 预览与校验解耦，互不阻塞。
2. 校验以“真实项目构建”作为最终判定，避免只做语法检查导致误判。
3. 返回稳定错误码，前端做可视化提示和交互分流。

---

## 4. 接口设计

## 4.1 统一响应结构（建议）

在保持现有 `state/data` 风格下，增加 `code` 字段，便于前端分支处理：

```json
{
  "state": true,
  "code": "OK",
  "data": {}
}
```

失败：

```json
{
  "state": false,
  "code": "VALIDATE_BUILD_FAILED",
  "title": "构建校验失败",
  "message": "vite build 失败",
  "data": {
    "logTail": []
  }
}
```

## 4.2 复用接口（不改协议）

1. `POST /project/v1/preview/start`
2. `GET /project/v1/preview/status`
3. `POST /project/v1/preview/stop`
4. `POST /project/v1/preview/stop-all`
5. `POST /project/v1/preview/heartbeat`

## 4.3 新增接口：构建校验

### 4.3.1 `POST /project/v1/preview/validate-build`

用途：触发一次真实构建校验，验证生成代码能否被打包工具处理。

请求体：

```json
{
  "projectName": "low-code",
  "projectPath": "D:/yl/workspace/low-code/low-code",
  "timeoutMs": 120000
}
```

成功响应（通过）：

```json
{
  "state": true,
  "code": "OK",
  "data": {
    "passed": true,
    "durationMs": 23145,
    "command": "pnpm run build-only",
    "logTail": [
      "vite v5.2.11 building for production...",
      "✓ built in 33.12s"
    ],
    "diagnostics": []
  }
}
```

成功响应（未通过）：

```json
{
  "state": true,
  "code": "VALIDATE_BUILD_FAILED",
  "data": {
    "passed": false,
    "durationMs": 8420,
    "command": "pnpm run build-only",
    "logTail": [
      "error during build:",
      "src/views/LowCodePage.vue:12:5 ..."
    ],
    "diagnostics": [
      {
        "level": "error",
        "file": "src/views/LowCodePage.vue",
        "line": 12,
        "column": 5,
        "message": "Element is missing end tag."
      }
    ]
  }
}
```

协议说明：

1. `state=true` 表示“接口执行完成”，`passed` 决定是否通过。
2. `state=false` 表示“接口执行异常”（例如路径不合法、依赖缺失、命令不可执行）。

### 4.3.2 可选接口（第二阶段）

1. `GET /project/v1/preview/validate-history?projectName=...`
2. `POST /project/v1/preview/validate-cancel`

MVP 可不实现。

---

## 5. 状态机设计

## 5.1 运行预览状态机（复用现有）

状态集合：

1. `idle`
2. `needs-install`
3. `starting`
4. `running`
5. `error`

状态迁移：

1. `openProject` -> `needs-install` 或 `idle`
2. `clickPreview`（依赖已安装）`idle -> starting`
3. `startSuccess` `starting -> running`
4. `startFail` `starting -> error`
5. `clickStop` `running -> idle`（若依赖缺失则回 `needs-install`）
6. `runtimeCrash` `running -> error`

### 5.1.1 预览展示模式子状态（本次决策）

为避免“预览进程状态”和“展示方式”相互耦合，新增展示子状态：

1. `overlay`：全屏覆盖层 iframe（默认）
2. `new-tab`：浏览器新标签页

决策：

1. MVP 默认 `overlay`，保证编辑上下文连续与进程可控。
2. 同时提供 `new-tab` 作为辅助入口，用于高保真调试和真实浏览器行为验证。

子状态迁移（仅影响展示，不改变运行状态）：

1. `clickPreview`：按当前模式打开预览（若未运行先触发 `start`）。
2. `clickOpenInNewTab`：`overlay -> new-tab`（仅展示切换，不重复启动进程）。
3. `clickBackToOverlay`：`new-tab -> overlay`（复用同一 `previewUrl`）。
4. `closeOverlay`：触发 `stop`（MVP 行为，避免遗留进程）。
5. `closeNewTab`：停止发送心跳；后端在心跳超时后自动 stop（兜底仍保留 `stop-all`）。

## 5.2 构建校验状态机（新增）

建议新增独立子状态，避免污染预览状态：

状态集合：

1. `unknown`（未校验/源码已变更）
2. `validating`
3. `pass`
4. `fail`
5. `error`（接口异常）

迁移规则：

1. `saveSourceSuccess` -> `unknown`
2. `clickValidate` `unknown|pass|fail -> validating`
3. `validatePass` `validating -> pass`
4. `validateFail` `validating -> fail`
5. `validateError` `validating -> error`
6. `sourceDirty=true` 时强制回到 `unknown`

---

## 6. 错误码设计

## 6.1 命名规则

`模块_语义`，统一大写下划线：

1. `PREVIEW_*`：运行预览相关
2. `VALIDATE_*`：构建校验相关
3. `PROJECT_*`：项目路径与目录相关
4. `SYSTEM_*`：系统级错误

## 6.2 错误码清单（MVP）

1. `OK`
   - 含义：接口执行成功
2. `PROJECT_PATH_INVALID`
   - 场景：projectPath 不存在或不是目录
3. `PROJECT_NAME_REQUIRED`
   - 场景：projectName 和 projectPath 都为空
4. `DEPENDENCIES_MISSING`
   - 场景：未检测到 node_modules
5. `PREVIEW_SCRIPT_MISSING`
   - 场景：package.json 无 dev/start 脚本
6. `PREVIEW_START_TIMEOUT`
   - 场景：启动超时或进程提前退出
7. `PREVIEW_SPAWN_EINVAL`
   - 场景：Windows spawn 参数不兼容
8. `PREVIEW_PROCESS_NOT_FOUND`
   - 场景：停止不存在的预览进程
9. `VALIDATE_SCRIPT_MISSING`
   - 场景：无 build/build-only 脚本
10. `VALIDATE_BUILD_FAILED`
    - 场景：构建执行完成但失败
11. `VALIDATE_TIMEOUT`
    - 场景：构建超时
12. `SYSTEM_INTERNAL_ERROR`
    - 场景：未分类异常

## 6.3 前端映射策略

1. `DEPENDENCIES_MISSING`：展示“请先安装依赖”并给出安装命令。
2. `VALIDATE_BUILD_FAILED`：高亮“构建失败”，展示日志和定位信息。
3. `PREVIEW_START_TIMEOUT`：展示“预览启动超时”，提供“查看日志”。
4. `SYSTEM_INTERNAL_ERROR`：通用异常提示，建议重试并保留日志下载。

---

## 7. 前端交互设计（MVP）

## 7.1 按钮与入口

在中间区域头部（已有“保存源码/查看运行预览”附近）新增一个按钮：

1. `校验构建`

并明确预览入口策略：

1. `查看运行预览`：默认走全屏 `overlay`。
2. `在新标签打开`：作为辅助入口，使用同一 `previewUrl`，不重复启动进程。

行为：

1. 未保存源码（`sourceDirty=true`）时点击：
   - 提示“请先保存源码再校验”，提供“立即保存并校验”二次确认。
2. 保存后点击：
   - 进入 `validating`，按钮显示 loading。
3. 校验结果：
   - `pass`：绿色状态 + “构建通过”
   - `fail`：红色状态 + “构建失败（查看日志）”
   - `error`：橙色状态 + “校验异常（重试）”

## 7.2 信息展示区域

建议在源码 tab 顶部工具条扩展：

1. 最近一次校验时间
2. 校验状态徽标（unknown/validating/pass/fail/error）
3. “查看日志”抽屉入口

## 7.3 日志抽屉（最小）

字段：

1. `command`
2. `durationMs`
3. `logTail`（最多 200 行）
4. `diagnostics`（file/line/column/message）

交互：

1. 支持复制日志
2. 支持一键跳转到源码（若 file 匹配当前编辑文件）

## 7.4 预览交互决策（本次落地）

### 7.4.1 决策结论

1. 主模式：全屏覆盖层 iframe（`overlay`）。
2. 辅模式：新标签页（`new-tab`）。

### 7.4.2 交互规则

1. 用户首次点击“查看运行预览”：
   - 若状态 `idle`：先启动，再打开 `overlay`。
   - 若状态 `running`：直接打开 `overlay`。
2. 用户在 `overlay` 点击“在新标签打开”：
   - 调用 `window.open(previewUrl, '_blank')`；
   - 当前进程不重启，继续复用。
3. 用户关闭 `overlay`：
   - 立即调用 `preview/stop`，回收进程（MVP 强约束）。
4. 用户关闭新标签页：
   - 前端停止心跳上报；
   - 后端在超时窗口（如 60s）内自动回收对应预览进程；
   - 主界面“停止预览”按钮和窗口关闭 `stop-all` 仍作为兜底。

### 7.4.3 文案建议

1. `overlay` 顶部提示：“当前为编辑内预览，关闭后将停止运行进程。”
2. `new-tab` 提示：“该标签关闭后将停止心跳，进程会在超时后自动回收。”

---

## 8. 后端实现要点（MVP）

## 8.1 新增 service 方法

在 `service/src/services/previewService.js` 新增：

1. `validateBuild(params)`
2. `refreshPreviewHeartbeat(params)`

核心流程：

1. 解析项目路径（复用 `resolveProjectPath`）。
2. 检查依赖（复用 `hasInstalledDependencies`）。
3. 读取 `package.json`：
   - 优先脚本：`build-only`
   - 其次：`build`
4. 按 package manager 执行脚本（复用 `buildSpawnCommand` 兼容 Windows）。
5. 收集日志尾部，超时中断进程。
6. 正常退出码 `0` -> `passed=true`，否则 `passed=false` 并解析 diagnostics。

## 8.2 新增 controller 路由

在 `service/src/controllers/projectController.js` 新增：

1. `POST /project/v1/preview/validate-build`
2. `POST /project/v1/preview/heartbeat`

仅做参数提取、调用 service、组装统一响应。

---

## 9. 数据结构建议（前端）

在 `ProjectPreviewState` 上增量扩展：

```ts
export type BuildValidationStatus = 'unknown' | 'validating' | 'pass' | 'fail' | 'error'

export interface BuildValidationState {
  status: BuildValidationStatus
  code: string
  message: string
  command: string
  durationMs: number
  logTail: string[]
  diagnostics: Array<{
    level: 'error' | 'warning'
    file: string
    line: number
    column: number
    message: string
  }>
  validatedAt: number
}
```

建议 `ProjectPreviewState` 增加字段：

1. `validation: BuildValidationState`

---

## 10. 迭代计划（最小 2 天版）

## Day 1

1. 后端：
   - 新增 `validateBuild` service
   - 新增 `validate-build` 路由
   - 错误码落地
2. 本地联调：
   - 成功构建项目
   - 构建失败项目
   - 超时场景

## Day 2

1. 前端：
   - 增加“校验构建”按钮
   - 增加 validation 子状态机
   - 增加日志抽屉
2. 验收：
   - 校验通过/失败可稳定复现
   - 状态与提示文案一致

---

## 11. 验收标准（MVP）

1. 预览功能：
   - 点击预览可打开运行页面；
   - 关闭预览可停止进程。
2. 校验功能：
   - 点击“校验构建”在 120s 内返回结果；
   - 成功与失败都能给出清晰提示；
   - 失败时可查看日志并定位到文件行列（若可解析）。
3. 稳定性：
   - 连续 10 次校验无僵尸进程；
   - Windows 下无 `spawn EINVAL` 回归。

---

## 12. 风险与兜底

1. 风险：某些项目 `build` 脚本包含自定义交互命令，可能阻塞。
   - 兜底：强制 `--mode production` 且设置超时 kill。
2. 风险：日志格式不统一，diagnostics 解析不稳定。
   - 兜底：至少返回 `logTail` 原文可人工定位。
3. 风险：项目过大导致构建时间长。
   - 兜底：先返回“正在校验”并支持后续做异步任务化（第二阶段）。

---

## 13. 第二阶段建议（可选）

1. 增加“快速校验”（`vue-tsc --noEmit`）+“严格校验”（`vite build`）双按钮。
2. 支持“仅校验当前页面影响范围”。
3. 增加校验历史和趋势统计。
4. 增加 CI webhook，在发布时复用同一错误码体系。
