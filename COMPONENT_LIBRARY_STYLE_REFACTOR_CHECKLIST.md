# 组件库样式改造清单（按当前项目结构可直接落地）

## 1. 目标与范围

本清单将前面对 `DataRoom/data-room-ui` 的分析映射到当前项目，聚焦以下两层改造：

1. 编辑器壳层样式：左中右三栏、组件库面板、属性面板、画布工具栏、图层面板。
2. 组件定义驱动样式：组件元数据、默认样式、状态样式、画布节点渲染样式。

说明：
1. 本文档是“落地执行版”，每条任务对应到具体文件。
2. 优先级按 `P0 > P1 > P2`，可直接用于迭代排期。

---

## 2. 当前基线（与你项目现状对应）

1. 样式变量已有基础能力，主要在 `src/assets/variable.css`，但变量命名未形成低码设计器专用命名空间，且存在多段 `:root` 混用。
2. 组件库元数据集中在 `src/views/PageLayoutView/component-library.ts`，包含 `icon/color/defaultStyle/propSchema`，已具备 schema 驱动雏形。
3. 左侧组件库样式在 `src/views/PageLayoutView/AppLeftPanel/BlocksDrawer.vue`，当前是“分组 + 卡片 + emoji 图标”。
4. 右侧属性面板样式在 `src/views/PageLayoutView/AppRightPanel/AppRightPanel.vue`，功能完整但“样式规范层”尚未抽离。
5. 画布节点渲染样式在 `src/views/PageLayoutView/AppPreviewer/CanvasNodeCard.vue`，已支持多组件类型渲染，但样式 token 化不足。
6. 画布与标尺样式在 `src/views/PageLayoutView/AppPreviewer/AppPreviewer.vue`，已有对齐/吸附/标尺能力，视觉规范可进一步统一。
7. 左侧目录面板 `src/views/PageLayoutView/AppLeftPanel/OutlineDrawer.vue` 与 `AppLeftPanel.vue` 存在中文文案乱码风险，需要统一 UTF-8 并修复展示。

---

## 3. 文件级改造清单（可排期）

## P0（本期必须完成，先做样式基础设施 + 核心可视区）

| 优先级 | 文件 | 改造项 | 输出物 | 验收标准 | 预估 |
| --- | --- | --- | --- | --- | --- |
| P0 | `src/assets/variable.css` | 建立低码设计器 token 命名空间（建议 `--lc-*`），覆盖颜色、字号、圆角、阴影、间距、边框、状态色。减少通用变量与设计器变量混用。 | 统一 token 表 | 左中右三栏的关键颜色/圆角/阴影可全部由 token 控制，不再硬编码散落。 | 0.5d |
| P0 | `src/assets/main.css` | 新增设计器样式聚合入口（如引入 `PageLayoutView` 专属样式文件），避免 SFC 内重复基础样式。 | 样式入口拆分完成 | 删除至少 30% 重复面板基础样式定义（边框、卡片、标题等）。 | 0.5d |
| P0 | `src/views/PageLayoutView/component-library.ts` | 组件元数据扩展：增加 `iconKey`、`previewType`、`stateStyles(normal/hover/active)`、`groupOrder`。把“视觉定义”和“业务 props”可分区组织。 | 元数据结构升级 | 新增字段不破坏现有渲染；旧节点可向后兼容。 | 1d |
| P0 | `src/views/PageLayoutView/AppLeftPanel/BlocksDrawer.vue` | 组件库卡片升级为“图标 + 名称 + 副标题 + 状态态（hover/drag）”，图标从 emoji 迁移到 Element Plus Icon。增加分组标题视觉层级。 | 新版组件库样式 | 从列表中一眼可识别组件类型，拖拽态和选中态可视。 | 1d |
| P0 | `src/views/PageLayoutView/AppPreviewer/CanvasNodeCard.vue` | 节点卡片样式 token 化，头部/内容区样式统一；数据源标签、删除按钮、选中态边框统一规范。 | 节点卡片视觉规范 | 任意组件节点在画布上的视觉风格一致，状态（默认/选中/锁定）清晰。 | 1d |
| P0 | `src/views/PageLayoutView/AppRightPanel/AppRightPanel.vue` | 抽象“设置面板样式骨架”：区块标题、表单间距、标签样式、空态样式、按钮区。对齐 DataRoom 的 `settingWrap` 思路。 | 属性面板统一视觉 | 属性/样式/数据三个 Tab 的视觉一致性明显提升，无局部临时样式突兀。 | 1d |

## P1（增强体验，提升专业感与一致性）

| 优先级 | 文件 | 改造项 | 输出物 | 验收标准 | 预估 |
| --- | --- | --- | --- | --- | --- |
| P1 | `src/views/PageLayoutView/AppPreviewer/AppPreviewer.vue` | 标尺、吸附线、画布背景、工具栏视觉统一到 token；自由布局和九宫格布局的视觉差异化强化。 | 画布视觉增强 | 标尺/吸附线在浅色背景下可读；九宫格空态和占位态更直观。 | 1d |
| P1 | `src/views/PageLayoutView/AppLeftPanel/AppLeftPanel.vue` | 左侧双 Tab 样式规范化，修复中文乱码文案（UTF-8），统一激活态/悬停态。 | 左栏导航样式统一 | Tab 文案正常显示，状态切换清晰。 | 0.5d |
| P1 | `src/views/PageLayoutView/AppLeftPanel/OutlineDrawer.vue` | 项目目录区块视觉层次优化（项目信息卡、状态标签、路径输入区）；修复中文乱码注释/文案。 | 目录面板优化 | 状态提示信息可读性提升；无乱码；路径输入与按钮样式统一。 | 1d |
| P1 | `src/views/PageLayoutView/Index.vue` | 三栏容器间距与分割线优化，保障 22/56/22 在中小屏下的最小可用宽度策略。 | 布局样式优化 | 1366 宽度下不挤压关键信息；三栏滚动行为符合预期。 | 0.5d |
| P1 | `src/views/PageLayoutView/AppPreviewer/EChartsNodeRenderer.vue` | 图表容器统一留白、标题、空态与加载态样式，使图表组件视觉与其他组件一致。 | 图表节点视觉统一 | 不同图表类型在尺寸变化下保持一致视觉密度。 | 0.5d |

## P2（体系化沉淀，便于后续扩展）

| 优先级 | 文件 | 改造项 | 输出物 | 验收标准 | 预估 |
| --- | --- | --- | --- | --- | --- |
| P2 | `src/views/PageLayoutView/` 新增 `styles/designer-shell.css` | 将左中右公共面板样式、标题样式、空态样式沉淀为可复用 class。 | 设计器壳层样式库 | `BlocksDrawer/AppRightPanel/AppPreviewer` 中重复样式进一步下沉。 | 1d |
| P2 | `src/views/PageLayoutView/` 新增 `styles/designer-component-card.css` | 组件卡片和节点卡片形成统一规范（库卡片 + 画布卡片可共享一部分样式语言）。 | 卡片规范样式库 | 库卡片与画布卡片风格连贯，视觉系统统一。 | 1d |
| P2 | `src/views/PageLayoutView/component-library.ts`（或拆分新文件） | 拆分为 `component-library.meta.ts` 与 `component-library.schema.ts`，降低单文件复杂度。 | 元数据分层 | 组件新增时只改对应文件；阅读成本降低。 | 1d |
| P2 | `src/assets/variable.css` + 文档 | 建立 token 使用规范（哪些 token 允许在业务 SFC 中直接使用）。 | token 规范文档 | 新增样式代码不再出现随意硬编码颜色。 | 0.5d |

---

## 4. 迭代执行顺序（建议）

1. 第 1 步：先完成 `P0` 的 token 层与元数据层（`variable.css`、`component-library.ts`）。
2. 第 2 步：完成组件库与节点卡片视觉统一（`BlocksDrawer.vue`、`CanvasNodeCard.vue`）。
3. 第 3 步：收口属性面板统一样式（`AppRightPanel.vue`）。
4. 第 4 步：进入 `P1`，优化画布细节和左栏体验，修复乱码文案。
5. 第 5 步：`P2` 做样式资产沉淀与结构拆分，降低后续维护成本。

---

## 5. 验收清单（跨文件 DoD）

1. 颜色、圆角、阴影、字体大小 80% 以上来自统一 token，不再散落硬编码。
2. 左侧组件库中每个组件可通过图标和名称快速识别，拖拽态清晰。
3. 右侧属性面板中区块样式一致，三类配置（属性/样式/数据）视觉层次统一。
4. 中间画布节点卡片具备一致的默认态/选中态/锁定态表现。
5. 自由布局与九宫格布局在视觉上易区分，标尺和吸附线清晰可读。
6. 左侧目录与标签文案无乱码，统一 UTF-8 编码。

---

## 6. 风险与注意事项

1. `OutlineDrawer.vue`、`AppLeftPanel.vue` 当前存在明显乱码迹象，改样式时要先统一文件编码，否则会持续污染文案与注释。
2. 组件库元数据字段扩展后，需同步检查 `BlocksDrawer.vue`、`CanvasNodeCard.vue`、`AppRightPanel.vue` 的读取逻辑，避免字段缺失导致渲染回退异常。
3. 样式抽离后要注意 `scoped` 与全局样式优先级冲突，建议公共层尽量使用命名空间类（如 `.lc-*`）。

---

## 7. 预计工作量（总览）

1. P0：约 4d 到 5d。
2. P1：约 3d 到 3.5d。
3. P2：约 2.5d 到 3.5d。
4. 总计：约 9.5d 到 12d（1 人）。

