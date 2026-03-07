# 低码 DSL 与渲染系统文档版落地规范

## 1. 文档目标

本文档用于指导当前项目落地一套可演进的低码 DSL（Domain Specific Language）与渲染系统，实现以下能力：

1. 新开页面基于 DSL + 组件库构建。
2. 页面可导出为 JSON 文件。
3. 在另一页面/工程导入同一 JSON 后可复现页面结构与行为。
4. DSL 可版本化升级，具备向后兼容策略。

本文档重点是“工程可落地规范”，不是概念介绍。

---

## 2. 范围定义

### 2.1 本期范围（V1）

1. 静态页面复现：布局、样式、基础属性、组件树。
2. 基础事件动作：点击触发动作链（如设置变量、请求、跳转）。
3. 导出/导入协议与合法性校验。
4. DSL 版本字段与最小迁移机制（V1.x）。

### 2.2 非目标（V1 不做）

1. 任意 JavaScript 表达式执行（避免 `eval`）。
2. 复杂跨页面状态同步（全局状态总线可后续迭代）。
3. 可视化逻辑编排器（仅支持 JSON 动作流定义）。
4. 企业级权限编排、多租户隔离（后续版本再补）。

---

## 3. 设计原则

1. **单一事实源**：画布和源码都以 DSL 为准。
2. **确定性渲染**：同一 DSL + 同一组件版本 => 同一结果。
3. **可迁移**：DSL 必须携带版本信息，支持迁移函数。
4. **可降级**：未知组件/字段可回退并提示，不可直接崩溃。
5. **安全优先**：表达式、事件动作采用白名单与沙箱策略。

---

## 4. DSL 顶层结构规范

```json
{
  "meta": {
    "dslVersion": "1.0.0",
    "engineVersion": "1.0.0",
    "componentLibVersion": "2026.03",
    "createdAt": "2026-03-05T12:00:00.000Z",
    "updatedAt": "2026-03-05T12:00:00.000Z"
  },
  "page": {
    "id": "page_home",
    "name": "首页",
    "route": "/home",
    "canvas": {
      "width": 1440,
      "height": 900,
      "background": "#ffffff"
    }
  },
  "resources": {
    "theme": "default-light",
    "assets": [],
    "i18n": {}
  },
  "state": {
    "vars": {},
    "queries": [],
    "computed": []
  },
  "nodes": [],
  "actions": []
}
```

### 4.1 顶层字段约束

1. `meta` 必填：包含版本与时间信息。
2. `page` 必填：页面主信息与画布参数。
3. `resources` 选填：主题、资源、文案等。
4. `state` 选填：变量、查询、计算定义。
5. `nodes` 必填：组件树数据。
6. `actions` 选填：事件动作流定义。

---

## 5. 节点（nodes）模型规范

### 5.1 Node 基本结构

```json
{
  "id": "btn_submit",
  "type": "button",
  "componentVersion": "1.0.0",
  "layout": {
    "mode": "absolute",
    "x": 100,
    "y": 120,
    "w": 120,
    "h": 36,
    "zIndex": 1
  },
  "props": {
    "text": "提交"
  },
  "style": {
    "color": "#ffffff",
    "backgroundColor": "#1677ff"
  },
  "bindings": {
    "disabled": "{{ state.vars.loading }}"
  },
  "events": {
    "click": ["action_submit"]
  },
  "children": []
}
```

### 5.2 Node 字段要求

1. `id`：全局唯一，不可变（用于 diff、引用、选中状态）。
2. `type`：组件类型标识，需在组件注册表中存在。
3. `componentVersion`：组件语义版本，用于迁移判断。
4. `layout`：布局模型，V1 先支持 `absolute`。
5. `props`：组件属性值（静态值）。
6. `style`：样式字典（CSS 驼峰或 kebab 统一约定）。
7. `bindings`：受限表达式绑定。
8. `events`：事件到动作链 ID 映射。
9. `children`：子节点数组（容器组件使用）。

### 5.3 布局约束

1. V1 仅支持 `absolute` + 数值坐标。
2. V2 可扩展 `flex` / `grid`。
3. 坐标、尺寸应归一化为整数，便于稳定导出 diff。

---

## 6. 动作（actions）模型规范

### 6.1 Action 基本结构

```json
{
  "id": "action_submit",
  "type": "request",
  "config": {
    "method": "POST",
    "url": "/api/form/submit",
    "body": {
      "name": "{{ state.vars.name }}"
    }
  },
  "onSuccess": ["action_toast_success"],
  "onError": ["action_toast_error"]
}
```

### 6.2 V1 支持动作类型

1. `setState`：更新 `state.vars`。
2. `request`：发起 HTTP 请求。
3. `navigate`：页面跳转（路由）。
4. `message`：消息提示。

### 6.3 执行模型

1. 同一事件绑定多个动作时按顺序执行。
2. `request` 可分支到 `onSuccess/onError`。
3. 动作执行上下文包含：
   - `state`
   - `event`
   - `node`
   - `runtime`

---

## 7. 组件注册表（Component Registry）规范

### 7.1 目标

将 DSL `type` 与实际 Vue 组件渲染器解耦，保证导入 JSON 可移植。

### 7.2 TypeScript 接口建议

```ts
export interface ComponentDescriptor {
  type: string
  version: string
  title: string
  category: string
  defaultProps: Record<string, any>
  defaultStyle?: Record<string, any>
  propSchema: Record<string, any>
  eventSchema?: Record<string, any>
  supportsChildren: boolean
  render: (ctx: RenderContext) => any
  migrators?: Array<(node: DslNode) => DslNode>
}

export interface ComponentRegistry {
  register: (descriptor: ComponentDescriptor) => void
  get: (type: string) => ComponentDescriptor | undefined
  has: (type: string) => boolean
  list: () => ComponentDescriptor[]
}
```

### 7.3 注册表约束

1. `type` 必须唯一。
2. 同类型多版本需明确定义迁移策略。
3. 未注册类型导入时渲染为 `UnknownBlock` 占位组件。

---

## 8. 渲染引擎规范

### 8.1 渲染流程

1. 读取 JSON。
2. 执行结构校验（schema）。
3. 执行版本迁移（dsl + node）。
4. 构建运行时上下文（state、actionMap、registry）。
5. 从根节点递归渲染组件树。

### 8.2 渲染模式

1. 编辑态：保留选中框、拖拽锚点、辅助线。
2. 预览态：仅渲染真实组件，不渲染编辑辅助层。
3. 导出快照：可选纯节点渲染（用于回归测试）。

### 8.3 运行时状态

```ts
interface RuntimeState {
  vars: Record<string, any>
  queryCache: Record<string, any>
  actionMap: Record<string, DslAction>
}
```

---

## 9. 导出/导入协议规范

### 9.1 导出协议

1. 导出对象必须是完整 DSL 顶层结构。
2. 导出前进行 `normalize`：
   - 去除编辑器临时字段（如选中态、拖拽态）。
   - 排序稳定化（节点、字段顺序固定）。
   - 补全必要默认值。
3. 导出文件建议后缀：`.lcdsl.json`。

### 9.2 导入协议

1. 文件读取后先做 JSON parse 与 schema 校验。
2. 校验通过后执行迁移，再进入渲染。
3. 对未知组件、无效动作给出可视化告警列表。
4. 导入结果返回：

```json
{
  "ok": true,
  "warnings": [
    "组件 type=foo 未注册，已降级为 UnknownBlock"
  ]
}
```

### 9.3 API 草案（前端/服务端均可复用）

1. `POST /dsl/validate`
2. `POST /dsl/migrate`
3. `POST /dsl/import`
4. `GET /dsl/export/:pageId`

---

## 10. 版本与迁移规范

### 10.1 版本策略

1. DSL 使用语义化版本：`major.minor.patch`。
2. `major` 变更允许不兼容，必须提供迁移器。
3. `minor` 新增字段应保持向后兼容。

### 10.2 迁移器接口

```ts
interface DslMigrator {
  from: string
  to: string
  migrate: (dsl: DslDocument) => DslDocument
}
```

### 10.3 迁移顺序

按版本链路逐级迁移，不允许跨版本跳过未定义迁移器。

---

## 11. 安全与稳定性规范

1. 禁止 DSL 中执行任意 JS 代码。
2. 表达式仅支持受限语法（变量路径、布尔、比较、基础运算）。
3. `request.url` 需支持域名白名单或代理前缀约束。
4. 富文本/HTML 输出必须转义或严格白名单。
5. 导入时对深度、节点数做上限保护，防止恶意 JSON。

---

## 12. 测试与验收标准

### 12.1 单元测试

1. schema 校验。
2. 迁移器输入输出。
3. 表达式求值。
4. 动作执行器分支流程。

### 12.2 集成测试

1. 导出 JSON -> 导入 JSON -> 页面一致性。
2. 未知组件降级渲染。
3. 版本迁移后渲染稳定。

### 12.3 验收指标（V1）

1. 100% 支持组件库中 V1 组件的结构复现。
2. 导入失败可给出明确错误定位（字段路径级别）。
3. 1,000 节点页面导入到首屏渲染时间可控（目标 < 2s，本机开发环境）。

---

## 13. 分阶段落地路线图（可直接排期）

### P0（必须）

1. 定义 `DslDocument`、`DslNode`、`DslAction` 类型与 JSON Schema。
2. 实现组件注册表与未知组件降级渲染。
3. 实现 DSL 渲染器（静态节点树 + 基础样式布局）。
4. 实现导入/导出基础链路（本地文件读写）。

### P1（高优先）

1. 实现基础动作系统（`setState/request/navigate/message`）。
2. 实现表达式绑定引擎（受限语法）。
3. 实现 DSL 迁移框架与首个迁移器样例。
4. 实现导入告警面板与错误路径提示。

### P2（中优先）

1. 扩展布局模型（flex/grid）。
2. 增加主题资源、全局变量、资源映射。
3. 导出文件签名与校验（可选）。

### P3（优化项）

1. 大页面性能优化（节点索引、局部更新）。
2. 运行态/编辑态隔离渲染优化。
3. DSL 可视化对比工具（导入前后 diff）。

---

## 14. 与当前项目的对接建议

1. 将现有 `AppPreviewer` 中的 `SCHEMA_START/END` 机制升级为标准 `DslDocument` 存储。
2. 将当前组件库 `component-library.ts` 升级为注册表描述符（增加 `propSchema/eventSchema/defaults`）。
3. 将当前画布块数组 `canvasBlocks` 迁移为 `nodes` 子集，逐步过渡，避免一次性重构风险。
4. 在导入流程中优先支持“同工程复现”，再做“跨工程复现”。

---

## 15. 风险清单与应对

1. **风险**：组件版本不一致导致复现差异。  
   **应对**：导出携带 `componentLibVersion` + 节点级 `componentVersion` + 迁移器。

2. **风险**：表达式能力不足影响业务灵活性。  
   **应对**：V1 先受限语法，V2 增强表达式函数白名单。

3. **风险**：导入 JSON 质量不稳定。  
   **应对**：强校验 + 可视化错误定位 + 降级渲染。

4. **风险**：大页面渲染性能下降。  
   **应对**：节点扁平索引、按需渲染、diff 更新。

---

## 16. 交付清单（文档对应产物）

1. DSL 类型定义文件（TS）。
2. JSON Schema 文件（校验）。
3. 组件注册表实现。
4. DSL 渲染器实现。
5. 导入导出服务模块。
6. 迁移器框架与样例迁移器。
7. 自动化测试（单测 + 集成）。

---

## 17. 里程碑建议（示例）

1. 里程碑 M1（1 周）：DSL 类型 + Schema + 静态渲染 MVP。
2. 里程碑 M2（1-2 周）：导入导出 + 注册表 + 降级策略。
3. 里程碑 M3（1-2 周）：动作系统 + 绑定表达式 + 迁移框架。
4. 里程碑 M4（1 周）：稳定性与性能优化 + 验收回归。

