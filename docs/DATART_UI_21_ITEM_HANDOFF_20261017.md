# Datart UI 21 项优化 — 开发交接文档（2026-10-17）

> **最新核查提示（2026-10-18）：以第 16 节的逐项复核为最新状态；上文第 1–8 节是历史基线。用户后续要求取消手机分辨率预设、图层顶部搜索区，不能将其误报为待恢复的功能。**

> **文档性质**：截至代码提交 `b9c9777403a4959715ba4c571e3ecdb6733ad2c1` 的开发状态快照；记录修改和未修改的范围，不代表生产环境验收完成。
>
> **仓库**：`NJgaoyang/datart`　**分支**：`dev20261017`　**审查基线**：`3966d0fe961a04cba1eab28f5190490e9a3bb222`（开始本轮 21 项 UI 优化之前）  
> **本轮范围**：基线以来 **24 个提交**，涉及前端、浏览器测试、CI 和文档；本交接只覆盖下列 21 项 UI 工作及其关联风险。

## 1. 一页结论

- **已改代码**：21 项均已有至少部分代码、测试或基线工作；其中部分项具备主要功能，部分项只有阶段性落地。**“代码已改”不等于“问题已在真实浏览器完全解决”。**
- **仍未完成的能力**：平板独立布局/真正连续重排、触控实机命中验收、手机横屏及任意宽度预览、无权限状态的独立提示、保存失败重试和跨路由离开拦截、图表请求级去重/取消、整套设计 Token/暗色规范，以及真实浏览器 E2E 接入持续集成。
- **已验证**：代码提交 `b9c9777403` 的 GitHub Actions `39035494318` 结果为 **success**：前端锁定依赖安装、`check:grid`、生产构建、bundle 基线，后端编译/定向测试、独立布局迁移测试全部成功。
- **未验证**：没有证据证明本轮 Playwright 在已登录的真实 Datart 测试实例运行过；没有鼠标热区的实际像素偏差、各浏览器/缩放倍率的截图结果，也没有真实 100/500/1000 个图表的 FPS、首屏或内存验收数据。
- **范围约束**：自动布局仍是 **桌面 72 列 / 手机 24 列两套独立持久化坐标**；窗口缩窄不能自动写入另一套坐标。自由布局的既有 `react-draggable` / `react-resizable` 机制未在本轮重写。不要把历史 v1/v2 布局迁移悄悄放回新布局运行时。

状态定义：**已改（待验收）**＝核心代码已落地但真实交互未验收；**部分完成**＝只完成一部分目标，存在明确未实现的功能。表格中的“剩余”是 **尚未修改或尚未验收**，不得视作完成。

## 2. P0 — 操作可靠性（1–5）

| 编号 | 目前已修改 | 仍未修改 / 必须验证 | 状态 |
|---|---|---|---|
| **1. 桌面/移动响应式策略** | `utils/gridViewport.ts` 使设备模式由显式选择决定，窄桌面不会误用 `mRect`；桌面在低宽度时维持最小可读宽度并可横向滚动；后续提交优化了连续宽度适配。 | **没有真正独立的平板布局**；不是把任意宽度自动重新排成任意列数。需验证 1920/1366/1024/768/375px、浏览器缩放、收展侧栏后坐标及保存不串端。 | **部分完成** |
| **2. 三点按钮点击热区 / 拖拽遮罩** | `StyledWidgetToolBar.tsx`、`WidgetDropdownList.tsx`、`WidgetWrapper.tsx`、`WidgetDndHandleMask.tsx`、`BlockMaskLayer.tsx`：隔离菜单按钮与筛选输入、阻断触发拖拽的指针事件，调整浮层可见性及遮罩命中。 | **尚无已登录实例的真实点击证据**。必须点击可见省略号 SVG 的中心，比较 `elementFromPoint` 目标，覆盖菜单、日期选择器、触屏及不同缩放。 | **已改（待验收）** |
| **3. 统一测量画布宽度** | `useGridWidgetHeight.ts` 统一计算画布宽度、行高和设备选择；`DashboardGridLayout.tsx` 使用传入 `measuredWidth`，移除内部第二套 `useContainerWidth` 观测。 | 必须验证隐藏/显示侧栏、持续拖拽分栏、窗口 resize、DPR/浏览器 zoom 后，无定位跳跃和点击偏移。 | **已改（待验收）** |
| **4. 左导航栏尺寸** | `pages/MainPage/pages/VizPage/index.tsx` 与 `hooks/useSplitSizes.ts` 基于 Split 容器的 ResizeObserver 宽度计算折叠比例及限制。 | 还需小屏、触屏、窗口缩放、快速连续展开/折叠的浏览器验收；没有提供完整分栏视觉对比基准。 | **已改（待验收）** |
| **5. 筛选 Widget 尺寸约束** | `hooks/useGridLayoutMap.ts` 根据控件种类与容器像素宽度换算 `minW/minH/maxH`，不再所有筛选器共用固定移动高度 3；增加对应专项测试。 | 已有保存布局的超小旧组件、超长中英文标签、日期区间/树控件极端宽度仍要验证；尚无所有控件的内容测量自动纠偏。 | **部分完成** |

## 3. P1 — 编辑体验（6–15）

| 编号 | 目前已修改 | 仍未修改 / 必须验证 | 状态 |
|---|---|---|---|
| **6. 编辑工具栏自适应** | `BoardToolBar/ToolBar.tsx`、`BoardToolBar.tsx`：按容器宽度将复制、粘贴、删除、层级等次级操作收入“更多编辑操作”菜单，主操作区可滚动。 | 需验收键盘/触屏下的菜单焦点、操作状态、窄窗口可发现性及国际化文本溢出。 | **已改（待验收）** |
| **7. Widget 操作显隐一致性** | 工具按钮 hover、`focus-within`、焦点可见及粗指针显示规则已调整；不可见按钮避免挡住图表指针操作。 | 不同类型 Widget、阅读/编辑/锁定状态下是否统一，需真实键盘 Tab 和屏幕阅读器验收。 | **已改（待验收）** |
| **8. 点击目标尺寸** | `styles/dashboardUiTokens.ts` 集中鼠标端 36×32、粗指针 44×44 的操作目标基础值；CSS 和单测已引用。 | 真实屏幕上 SVG 中心与点击目标对齐、菜单显示位置及触屏精度，**尚无测试实例报告**。 | **部分完成** |
| **9. 日期与复杂筛选自适应** | `ControllerWidgetCore.tsx` 使用容器查询；窄控件的表单标签/输入区域改为上下布局，宽度与溢出约束已调整。 | 日期弹层、中文长字段、浏览器缩放、级联筛选和极端小尺寸尚未完成整套布局验收。 | **部分完成** |
| **10. 移动端预览** | `AutoBoardEditor.tsx` 加入 320 / 340 / 375 / 430 / 768px 预设宽度，修改预览宽度不直接重写桌面坐标。 | **未实现** 手机横屏专用预设、任意自定义宽度输入、真正第三套平板持久化布局。 | **部分完成** |
| **11. 滚动提示** | 编辑和阅读网格不再隐藏全部滚动条，改用 8px 可见滚动条并允许横向滚动。 | 需要 Firefox、Safari、Windows 系统滚动条、触控惯性滚动验收。 | **已改（待验收）** |
| **12. 空白/数据状态** | `AutoBoardEditor.tsx` 加了空仪表板提示；`DataChartWidget/chartViewState.ts` 和 `DataChartWidgetCore.tsx` 区分 loading / error / empty / ready，添加专项测试。 | **尚未提供独立的“无权限”状态和统一重试/处理指引**；不同图表插件的空态体验仍需统一。 | **部分完成** |
| **13. 键盘快捷键** | `hooks/useBoardEditorHotkeys.ts`、`utils/gridKeyboard.ts`：方向键微调、批量锁定和输入框焦点避让，并有单测。 | 需要真实浏览器 Tab、方向键、撤销/重做、输入控件快捷键冲突验收；大图层多选行为另测。 | **已改（待验收）** |
| **14. 图层管理** | `LayerPanel/layerSearch.ts`、`LayerTree.tsx`、`LayerTreeItem.tsx`：搜索、组件类型过滤、定位画布，以及选中组件批量锁定/解锁和移动端显示/隐藏；新增测试。 | 图层树大型数据量性能、组内嵌套搜索、键盘操作、批量误操作撤销仍待验证。 | **已改（待验收）** |
| **15. 保存状态 / 退出编辑** | `BoardHeader/EditorHeader.tsx`、`utils/boardUnsavedState.ts`：保存中、未保存提示及从编辑页退出确认；附单测。 | **未形成完整的已保存/保存失败重试状态机**；尚未覆盖所有跨路由、刷新/关闭标签页的未保存保护。 | **部分完成** |

## 4. P2 — 性能、设计规范与浏览器回归（16–21）

| 编号 | 目前已修改 | 仍未修改 / 必须验证 | 状态 |
|---|---|---|---|
| **16. 首屏分包** | `vite.config.ts` 将少用的管理工具页面单独分组，并保留循环依赖敏感的 `app/vendor` 策略；`scripts/report-dashboard-bundles.mjs` 及 CI 保存了 bundle 体积检查入口。 | **并未完成展示页、编辑器、所有复杂图表的场景级细分包**；必须先测真实网络瀑布与白屏/循环依赖风险。 | **部分完成** |
| **17. 筛选表单同步** | `ControllerWidgetCore.tsx` 把 `form.setFieldsValue` 从计算渲染迁移至 `useEffect`，避免 render 阶段改写表单。 | 需验证级联筛选、重置、同步更新和大量筛选器的重复渲染；无量化耗时数据。 | **已改（待验收）** |
| **18. 自动刷新/网络压力** | `utils/widgetRefreshScheduler.ts` 提供共享 1 秒 ticker、后台页暂停及每秒最多 8 个刷新任务；`hooks/useWidgetAutoFetch.ts` 接入可见性判断与调度，附单测。 | **尚无服务端请求级去重、完善的在途请求取消/合并和生产负载指标**；100/500/1000 个真实图表需测试。 | **部分完成** |
| **19. 弹层统一** | `ControllerWidgetCore.tsx` 优先将弹层挂载到 `document.fullscreenElement`，否则共用 `document.body`，替代每个控件单独创建固定定位根节点。 | 需验证全屏、嵌入、滚动、遮挡层级、日期/树/下拉等弹层；不等于已完成全应用 Popover/Modal 治理。 | **已改（待验收）** |
| **20. 设计 Token/视觉规范** | `styles/dashboardUiTokens.ts` 已抽取少量交互尺寸 Token（按钮、触摸目标、工具栏和筛选断点），并添加约束测试。 | **未完成全项目颜色、间距、字体、暗色主题、错误状态和组件库视觉 Token 的统一**；还存在硬编码文案及局部样式。 | **部分完成** |
| **21. 真实浏览器回归** | 新增 `frontend/e2e/` 下的 Playwright 配置和 SVG 中心点击、菜单显示、日期控件热区不交叠及 1920/1366/1024/768px 检查；还新增 `scripts/dashboard-hit-target-audit.js`。 | **尚未在已登录 Datart 测试环境执行并记录通过结果；Playwright 未纳入默认 CI**。目前脚本只覆盖部分编辑路径，拖拽/缩放/保存重开、手机视口、跨浏览器及截图基线仍要扩展。 | **部分完成** |

## 5. 本轮关键提交与代码入口

以 `3966d0fe` 为 UI 工作基线，后续 24 个提交依次包含：

| 阶段 | 代表提交 | 核心内容 |
|---|---|---|
| P0 基础 | `8e2a68b9`、`deda5b68`、`d4b55767`、`7df905d8` | 设备模式与宽度、侧栏 ResizeObserver、命中区域、筛选器按类型限宽 |
| P1 编辑 | `c6c32a73`、`1c8361ca`、`8797a849`、`10be4495` | 图层管理、手机宽度预览、键盘/批量锁定、未保存提示 |
| P1 补强 | `75333e30`、`23305176`、`7871c483`、`f231457b`、`e0e5fda0` | 搜索、定位、批量显示/隐藏、紧凑操作菜单、图表空态 |
| P2 基础 | `b4980424`、`ecb8d2a0`、`e01b4723`、`b9c97774` | 刷新调度、bundle 基线、UI Token、需登录测试环境的 Playwright 脚手架 |

当前可用的主要资料：

- `docs/DATART_UI_21_ITEM_OPTIMIZATION_20261017.md`：**较早时间的进度快照**，其中“批量锁定尚未实现”等记录已被后续提交更新。**本交接文档的状态优先于旧快照**。
- `docs/DATART_GRID_LAYOUT_V2_PLAN_20261017.md`：RGL v2 改造设计与历史布局隔离原则，部分早期尺寸/宽度实现描述已经过时；请以当前代码为准。
- `docs/GRID_LAYOUT_MIGRATION_CLI.md`：独立历史布局离线迁移及回滚。
- `frontend/e2e/README.md`：浏览器验收启动步骤；测试要求 **授权的非生产 Datart 实例**。

## 6. 测试及交付证据

**最近一次已通过的代码提交**：`b9c9777403a4959715ba4c571e3ecdb6733ad2c1`。  
**对应 CI**：https://github.com/NJgaoyang/datart/actions/runs/39035494318 （`success`）。

已完成的 CI 任务：锁定前端依赖安装、TypeScript、Grid 专项单测、100/500/1000 Widget 核心 Compactor CPU 基准脚本、生产前端构建、bundle 体积采集、后端编译与定向 Java 测试、离线迁移测试。

未完成的验收证据：

1. Playwright 在具备登录态、真实控件的测试 Datart 中成功执行的报告与截图；
2. 1920 / 1366 / 1024 / 768 / 375 CSS px、多 DPR、浏览器 zoom 与侧栏展开/收起后的真实交互检查；
3. 自动布局拖拽、8 向缩放、锁定、组、Undo/Redo、保存重开、手机显示/隐藏不串数据的完整走查；
4. 大规模真实图表页面的首屏、输入延迟、FPS、CPU/内存/网络瀑布以及包大小优化前后对比；
5. 手机触摸、键盘可访问性、Firefox/Safari 等跨浏览器验收。

请勿把 `npm run bench:grid` 的纯压缩算法耗时当作图表渲染帧率；也不要把浏览器测试脚本“存在”当作“已运行”。

## 7. 下次接手的明确优先顺序（只针对尚未完成的部分）

1. **先跑真实浏览器验收（P0-1～P0-5、21）**：准备有图表、日期/下拉筛选、锁定和移动隐藏控件的测试仪表板；Playwright 使用独立测试账号的 storageState，禁止提交凭据；记录点击 SVG 中心、悬停/选中、DatePicker 与三个点热区、缩放前后 Widget 身份和坐标。发现真实问题才修改该路径。
2. **补 P1 缺口（10、12、15）**：手机横屏/自定义预览宽度、无权限与查询错误区别、保存成功/失败/重试及跨路由离开保护。保持新旧布局数据独立。
3. **补响应式边界（1、5、9）**：平板/窄窗口优化应以“**不覆写另一设备坐标**”为先；对历史超小筛选控件提供清晰的尺寸提示而非静默改写；复杂筛选器按类型测试。
4. **再补 P2（16、18、20、21）**：建立多入口首屏性能基线，按场景逐步安全拆包；图表查询合并/取消需明确后端承载边界；扩展设计 Token 和真实浏览器回归。不要直接把全部 vendor 强行细拆。
5. **每次修改只执行对应单测与构建检查**，有高风险共享变更才扩大回归；修复应附失败用例/浏览器截图，避免重复改造或无限试错。

### 验证命令

```bash
git fetch origin
git switch dev20261017
git pull --ff-only origin dev20261017

cd frontend
npm ci --legacy-peer-deps
npm run check:grid
npm run build
npm run report:bundles

# 仅有可访问的非生产 Datart 实例及授权登录态时：
cd e2e
npm install
npx playwright install chromium
# 按 frontend/e2e/README.md 设置 DATART_TEST_* 环境变量
npm test
```

**禁止事项**：不要用旧版 RGL 运行时覆盖新版；不要静默转换历史仪表板；不要因 CSS/响应式适配重写现有 Widget `pRect/mRect`；不要把自由布局强行改为网格；不要在真实生产账号上做破坏性拖拽/删除/保存测试。

## 8. 交接核对

- [x] 已核对 `dev20261017` 当前代码 HEAD、21 项代码入口及提交记录。
- [x] 已核对对应 CI 成功状态。
- [x] 已区分“已经修改的代码”和“尚未修改/尚未验证的能力”。
- [ ] 真实浏览器/真实数据源验收。
- [ ] 未完成子项实现及相应专项测试。
- [ ] 性能和跨浏览器指标达标后，再评估生产上线。

## 9. 续接开发记录（2026-10-17，基于 dev20261017）

> **本节晚于上述历史快照。** 第 1–8 节仍是截至 `b9c9777403` 的交接状态，后续工作以本节和最新代码为准。下面的「实现」仍不等于真实浏览器验收。

| 项目 | 新提交 | 本轮新增能力 | 未完成 / 验收限制 |
|---|---|---|---|
| **10. 移动预览** | [`cead6ef`](https://github.com/NJgaoyang/datart/commit/cead6ef139c642a1304227b143bec2319e2f82da) | 新增 667×375、736×414、812×375 横屏预设，自定义 280–1024px 宽度、非法值不应用；竖屏和平板模拟保持可用 | 均使用**显式 Mobile / 24 列**，不创建平板第三套坐标，未完成真机截图与缩放验收 |
| **12. 图表状态** | [`bbc0abe`](https://github.com/NJgaoyang/datart/commit/bbc0abe82595efd63dc82970e792852946d4951b) | HTTP 403 明确识别为无权限；一般查询失败有手动“重新查询”；保存错误状态不会显示原始 SQL；重试期间禁止重复提交 | 403 以结构化 HTTP 状态判断，不能将任意错误文案猜测为无权限；业务响应体的权限错误码、嵌入/分享实例还需联合验收 |
| **15. 保存反馈** | [`2c0e36b`](https://github.com/NJgaoyang/datart/commit/2c0e36b4e27ea149c40ea95580fedb77f0014d61) | 提供保存中/已保存/未保存/失败状态；请求失败仍留在编辑器并允许重试；有未保存修改时刷新/关闭标签页提示 | React Router 当前是传统 `BrowserRouter`；未接入安全可用的跨 SPA 内部路由阻断器，不能宣称所有导航受到保护 |

补充说明：

- 本轮新增专项测试：`mobilePreviewSize.test.ts`、`widgetQueryError.test.ts`、`boardSaveStatus.test.ts`，以及扩展 `chartViewState.test.ts`。以上测试入口已经添加到 `frontend/package.json` 的 `test:grid`。
- `cead6ef` 的 CI [39037355384](https://github.com/NJgaoyang/datart/actions/runs/39037355384) 已显示 **success**。
- `2c0e36b` 的 CI [39037788152](https://github.com/NJgaoyang/datart/actions/runs/39037788152) 中，前端 TypeScript、专项 Grid 单测、Compactor CPU 基准、生产构建和包体积采集步骤已显示 **success**；完整工作流结论请以 GitHub Actions 页面最新状态为准。文档更新提交如触发后续工作流，需单独查看其结果。
- **没有真实已登录 Datart 测试实例的 Playwright 执行证据。** 不得将 CI 的 JSDOM 单测或生产构建视为真实鼠标热区、保存重开、移动触摸与跨浏览器验收通过。

下一步仍按第 7 节推进：先在授权的非生产实例跑 P0-1～5 和第 21 项真实交互；然后处理第 15 项跨 SPA 路由保护、第 1/5/9 项边界和第 16/18/20/21 项性能与规范。特别注意当前应用入口 `AppRouter.tsx` 使用 `BrowserRouter`，不可直接添加仅适用于 data router 的阻断 Hook；任何导航方案都需要测试返回、手动退出、保存后退出、刷新及登录重定向，不得污染浏览器历史。

本轮代码的定向复核命令（依赖安装完成后）：

```bash
cd frontend
npm run checkTs
npx vitest run src/app/pages/DashBoardPage/utils/__tests__/mobilePreviewSize.test.ts src/app/pages/DashBoardPage/utils/__tests__/widgetQueryError.test.ts src/app/pages/DashBoardPage/utils/__tests__/boardSaveStatus.test.ts src/app/pages/DashBoardPage/components/Widgets/DataChartWidget/__tests__/chartViewState.test.ts
npm run build
```

## 10. 紧急修复：登录白屏与后台页分包循环依赖（2026-10-17）

- **报告现象**：浏览器在登录页报 `Uncaught ReferenceError: Cannot access 'v' before initialization at admin-tools.43ad351f.js:1:4641`，页面无法显示。
- **代码层面发现**：`frontend/vite.config.ts` 曾将 4 个管理页面源码强制划分到 `admin-tools`，其他源码划分到 `app`，会在应用共享模块互相引用时制造跨 chunk 的初始化顺序风险。**没有拿到报错 JS 的 sourcemap，因此严格意义上属于高概率根因而非已证明的精确变量映射。**
- **修复策略**：撤销强制 `admin-tools` 分包，全部应用源码维持一个 `app` chunk，依赖仍在 `vendor` chunk；没有更改登录业务流程或任意布局数据。Bundle 体积脚本新增 `admin-tools` 回归检查，避免之后无意恢复高风险拆分。该策略优先保证登录和仪表板入口可用，牺牲部分管理页的场景级 JS 延迟加载，后续必须先用实际浏览器证明安全再做新的分包优化。
- **验收尚需**：在授权开发/测试环境以**最新 commit 重新构建并部署**，清理旧版静态资源缓存，打开无缓存登录窗口核对 Network 加载资源和 Console，无 `admin-tools.*.js`、无初始化异常，能登录进入仪表板。随后再抽查后台管理页与分享页。GitHub Actions 代码构建通过只能证明编译/打包，**不能代替真实浏览器运行验证**。
- **环境限制**：排查时开发机 `VM-0-13-tencentos` 远程代理离线，无法读取实际服务器运行进程或直接部署，因此没有声明开发机已修复。

## 11. 移动端统一自适应预览（2026-10-17）

- **产品约束**：移动端只有一套自动布局，不允许为 320/340/375/430/横屏/平板等分辨率分别选择与维护布局；桌面和移动端仍各有自己的布局数据（`pRect` 72 列、`mRect` 24 列），窗口伸缩只影响呈现宽度，不修改持久化坐标。
- **编辑器**：移除 `AutoBoardEditor` 里的预设尺寸下拉框、自定义宽度输入、默认 340×640px 固定预览尺寸。移动预览占满编辑区域的可用宽高，容器 ResizeObserver 实时计算画布宽度与 24 列网格；不在任何宽度下切换到另一份手机布局。
- **实际移动端**：继续沿用 `MobileBoard` 的单份 `mRect` 网格和控件容器自适应规则；日期标签、日期范围等控件按所在容器宽度伸缩，而非设备型号。
- **清理**：删除仅供分辨率选择的 `mobilePreviewSize.ts` 和旧预设测试；在 `gridViewport.test.ts` 覆盖 280、320、340、375、430、600、768、900、1200px 下始终使用 `sm` 及实时宽度。
- **验证**：已在开发机 Chromium 使用真实编辑预览样式检查 280～900px 的容器连续伸缩、没有预设选择输入与横向溢出；还需使用已登录的真实仪表板检查各 Widget 的内容和拖拽保存。
## 12. 移动预览宽度与移动控件最小尺寸（2026-10-17）

- **Web 编辑器预览**：统一移动 24 列布局不变。宽屏 Web 编辑区域中手机预览视觉最大宽度为 430px，窄编辑区域自动缩小；这是编辑器容器的展示上限，不是手机分辨率预设。真实移动端 `MobileBoard` 仍按自身容器宽度自动缩放。
- **组件缩放限制**：移动日期范围筛选 `rangeTime` 的最小拖拽高度从 3 行调到 2 行（36px 日期输入仍可操作），最小宽度调整为 16/24 列；其他移动筛选器允许缩到 1 行、最小宽度为 4/24 列。图表、按钮、媒体和容器保留原有自由缩放；桌面端限制不变。
- **数据安全**：本次仅调整移动编辑器画布宽度 CSS 和移动端 GridLayout 交互约束，不批量改写旧 `mRect`，不会修改 `pRect`。已有尺寸需要用户明确拖拽后才写入移动布局并保存。过小的控件可能截断内容，应由编辑者保留合理尺寸。
- **专项验证**：`useGridLayoutMap.test.tsx` 与 `gridViewport.test.ts` 验证新约束、两套布局隔离和旧 mRect 保留。线上开发机真实保存/重开与触屏拖拽需进一步验收。

## 13. 图层列表简化与仪表板默认零间距（2026-10-18）

- **图层列表**：移除桌面编辑器组件列表顶部的「搜索组件」「全部组件类型」及同区域批量锁定/移动显隐按钮，直接展示组件层级树；单/多选与拖拽排序保留，移动端显示仍由独立「移动端展示」面板控制。
- **新建自动布局**：桌面和移动端的组件间距（margin）与画布四周内边距（padding）默认均为零。覆盖新 `initAutoBoardConfig`、旧 Beta3 初始化以及移动缺省回退逻辑；其他已有仪表板明确保存的间距仍得到尊重。
- **「测试1」当前历史设置**：开发机上的现有配置仍为桌面 padding 8、margin 4；移动端 padding 4、margin 2，因此需要专门备份「测试1」的 config 后归零。仅操作该测试仪表板，不批量覆盖其他已有仪表板，不修改 `pRect/mRect`。
- **测试**：定向覆盖零默认值、用户自定义值保留、现有图层辅助函数和网格间距，共 13 个测试通过；TypeScript 检查通过。部署后需要登录真实环境核对顶部/左侧空隙。

## 14. 数据预览列宽、表连接稳定布局与 1px 组件间距（2026-10-18）

- **共享数据预览表**：`VirtualTable` 不再把父容器多余宽度按比例均分给列；Ant Design 表头与 react-window 表体使用同一组显式像素宽度。内容总宽不足容器时右侧留白，超过容器则横向滚动，应用于复用该组件的数据源及数据集结果预览。
- **字段名称与异常长值**：`getColumnWidthMap` 采用可见字段显示名进行标题测量，数据内容宽度超过 360px 时保持合理显示上限与溢出处理，避免内部 SQL 字段标识夸大短列宽。
- **结构化视图 Join 编辑**：`StructView` 将表连接操作区域组织成稳定的列结构，执行/删除按钮不再随 hover display 切换，删除固定右上角、条件行的加减操作占位稳定；字段下拉根据显示字段最后一节测量宽度，同一 Join 条件行对齐，去除表单下方多余空白并缩小相邻条件间距。
- **组件默认上下左右间距为 1**：桌面和移动端新建自动布局的 margin/padding 全部 1px，旧版 Beta3 初始化和移动缺省回退同步。已存在的用户自定义非零值原样保留；开发机仅对「测试1」的四组历史 0 值做过独立备份并改为 1，不修改任意仪表板坐标。
- **验证**：数据视图、Join 宽度与仪表板默认值共 41 个定向单测和 TypeScript 检查通过；Chromium 真浏览器中的共享虚拟表格在 1120px 父容器里，表头/单元格实际宽度为 88、120、135px，无多余拉伸。实际登录后的编辑页面完整增删条件和保存重开仍待验收。

## 15. 数据集长注释省略与移动端共享函数权限（2026-10-18）

- **数据集字段显示**：新增 `DatasetCommentLabel`，数据集模型字段、分组节点、计算字段和 SchemaTable 数据预览表头，在注释超长时保留前部 22 个 Unicode 字符、尾部省略号；悬停 Tooltip 显示完整原始 `sourceComment/comment`。自定义字段别名继续优先，字段数据及持久化内容不裁剪。使用 CSS `text-overflow: ellipsis` 适配实际容器宽度。
- **移动/共享查看报错根因**：开发机 2026-10-18 日志确认，`POST /shares/function/support/{sourceId}`（`@SkipLogin`）调用 `SourceServiceImpl.requirePermission`，因匿名请求 `getCurrentUser()==null` 产生空指针。不是手机 CSS。
- **安全修复**：`ShareServiceImpl.supportedStdFunctions` 要求有效且未过期的 VIEW 执行令牌，仅允许 `token.vizId` 所指 View 对应的 `sourceId`；随后 `runAs(token.permissionBy)` 执行原有数据源 READ 权限检查，并在 finally 中 `releaseRunAs` 恢复上下文。禁止使用不匹配的数据源、缺失令牌或越权访问；不直接绕过 `requirePermission`。
- **回归**：`ShareSupportedFunctionSecurityTest` 覆盖 View-Source 配对与拒绝跨数据源/错误资源/缺失身份；前端 `DatasetCommentLabel.test.tsx` 覆盖前缀省略、完整 tooltip 数据、自定义别名保留。待移动端实际分享令牌下进一步验证授权成功、过期和非关联数据源拒绝，以及日常用户登录流程。

## 16. 当前分支逐项核查与下一阶段待办（2026-10-18，HEAD `daad673`）

> 此节是基于 GitHub `dev20261017` 代码及 `39050766508` CI **success** 的最新审查。审查时授权开发机 `VM-0-13-tencentos` 远程连接显示 **offline**，故不能宣称本次已重跑登录态浏览器测试或验证部署进程。**项目仍按桌面 pRect/72 列 + 单份移动 mRect/24 列运行**，不是分手机型号保存多套布局。谨遵“定向测试，不做每次全量回归；避免重复改造”。下表中“待验收”不等于功能未编码。

| # | 功能 | 最新状态 | 真正剩余的工作 |
|---|---|---|---|
| **1** | 响应式和设备布局 | **代码已改，边界待验收** | 1920/1366/1024/768/375、DPR、窗口缩放、折叠侧栏、横竖屏下的拖拽/重开与 pRect/mRect 隔离；**不需要再做手机尺寸预设或第三套平板持久化布局** |
| **2** | 三点菜单热区 / 遮罩 | **代码已改，待真机验收** | SVG 中心 `elementFromPoint`、菜单点按、筛选区域与拖拽命中冲突、真实触摸 |
| **3** | 画布宽度统一测量 | **代码已改，待验收** | 分栏连续拖拽、resize、不同 zoom/DPR 下像素命中与画布无跳动 |
| **4** | 导航分栏宽度 | **代码已改，待验收** | 小屏、展开/收起、连续改变宽度的真实浏览器截图和命中 |
| **5** | 筛选器缩放约束 | **部分完成** | 移动端 rangeTime 最小 2 行、其他筛选 1 行已落地；旧超小组件、超长文字与极限缩放的可操作性尚无端到端证据 |
| **6** | 编辑工具栏自适应 | **代码已改，待验收** | 极窄编辑器的更多操作、键盘与触屏焦点、不同文案长度 |
| **7** | Widget 操作显隐 | **代码已改，待验收** | 阅读/编辑/锁定、键盘焦点、粗指针触摸、可访问性 |
| **8** | 点击热区尺寸 | **部分完成** | `dashboardUiTokens.ts` 有按钮与 44px 触摸基础值；仍缺 SVG 目标位置与实际触摸验证 |
| **9** | 日期及复杂筛选适配 | **部分完成** | 已采用单套移动容器自适应；需验证日期弹层、级联下拉/树、长字段、内容溢出，不应按设备分辨率保存多套 |
| **10** | 移动预览 | **按最新产品要求已实现，待验收** | **已移除** 尺寸预设/输入框；宽屏 Web 编辑器仅用最大 430px 的预览显示框，实际移动仍自适应；需验证保存/重开 |
| **11** | 滚动指示 | **代码已改，待跨浏览器验收** | Safari、Firefox、触控惯性、横向表格滚动 |
| **12** | 图表空态/403/重试 | **代码已改，部分联合验收缺失** | 有 `forbidden/error/empty/loading`、单次重试；需测试分享模式、HTTP 403 与业务体错误码、插件间统一空态 |
| **13** | 键盘操作 | **代码已改，待浏览器验收** | 输入焦点避让、箭头移动、多选/撤销、Tab 焦点 |
| **14** | 图层管理 | **按最新要求简化，待验收** | 用户明确要求移除组件列表顶部搜索/类型筛选与该区批量工具；**不作为“漏实现”恢复**。保留层树选择与拖拽、单独移动显隐面板；需验证复杂层级操作 |
| **15** | 保存提示/失败重试/离开防护 | **部分完成（明确代码缺口）** | `EditorHeader` 有保存中/已保存/失败重试，按钮退出确认及 `beforeunload`；**缺少 BrowserRouter 内部 SPA 路由跳转的统一阻断**。不得直接在传统 BrowserRouter 上套 data-router-only `useBlocker` |
| **16** | 首屏拆包 | **部分完成（明确代码缺口）** | 强拆 `admin-tools` 已造成登录 TDZ 白屏并回退；现在 `app/vendor` 大包。先收集真实网络瀑布，再做不跨循环依赖的按路由/场景安全分包 |
| **17** | 筛选表单状态同步 | **代码已改，待验收** | `setFieldsValue` 放入 effect；级联、同步更新、重置、重复渲染的实际操作与耗时 |
| **18** | 自动刷新/网络请求 | **部分完成（明确代码缺口）** | 已有共享 ticker、可见性调度、150ms 批处理、待发及在途取消入口；**尚无完整相同请求去重、取消竞态/回退可靠性验证与 100/500/1000 真实 Widget 负载报告** |
| **19** | 弹层定位一致性 | **代码已改，待验收** | 全屏、嵌入、滚动及复杂下拉的层级、锚点与遮挡 |
| **20** | 设计 Token | **部分完成（明确代码缺口）** | 目前主要是操作尺寸 5 个 Token；颜色、边距、文字层级、暗色主题、跨组件统一仍未系统化 |
| **21** | 浏览器 E2E / CI | **部分完成（明确代码缺口）** | 仅 `frontend/e2e/specs/dashboard-interactions.spec.ts`、Chromium 配置，依赖外部 `DATART_TEST_DASHBOARD_EDITOR_PATH` 与登录 `storageState`；**GitHub Actions 未运行 Playwright**。需要授权的测试实例、真实手机/平板、Firefox/WebKit、截图与保存重开脚本 |

### 项目近期修复：状态更新

- 数据源/数据集数据预览的列宽、表连接稳定布局、移动端统一自适应、移动组件最小高度、默认桌面/移动组件间距 **1px**，代码均已落地；桌面/移动坐标保持独立。已有其他看板的用户自定义间距不会因代码默认值改变。
- 长注释前缀+尾部省略+悬停完整 Tooltip 已覆盖数据集字段树与数据预览表头；仍需真实数据、不同容器宽度确认 Tooltip 遮挡。
- 分享/移动查看中 `SourceServiceImpl.getCurrentUser()==null` 的空指针根因已针对性修复在 `ShareServiceImpl.supportedStdFunctions`，仅允许有效 VIEW 分享令牌匹配所属 Source 并在授权 `runAs` 上下文中执行；需要**真正有效/过期/越权令牌端到端验收**，不能只根据 HTTP 400 说明正常移动查询已通过。
- 当前 HEAD `daad673` 的 GitHub Actions `39050766508` 已 **success**。原后端 CI 指定测试集**漏掉新加的** `ShareSupportedFunctionSecurityTest`；本次将其补进 `.github/workflows/dashboard-grid-v2.yml`，后续提交自动验证。

### 接下来只做未完成部分的优先级

1. **P0 验收**（#1–5、#21）：连接授权开发/测试机，获取独立测试用户登录状态，在现有 `e2e` 基础上覆盖菜单真实点击、侧栏、日期/表格横向滚动、移动触摸、拖拽与保存重开；记录截图与失败轨迹。远程设备离线时不声称执行过。
2. **P1 功能缺口**（#15、#5/9/12）：先设计兼容 `BrowserRouter` 的站内未保存拦截并测试保存成功跳转、失败保留、返回、刷新、登录重定向；然后修正极端尺寸的真实控件问题与分享业务错误码，绝不静默改写旧 `pRect/mRect`。
3. **P2**（#18、#16、#20）：补实际 Query 取消/去重的正确性测试与真实负载报告；在证明登录/分享/管理入口不出现 TDZ 后才尝试拆包；渐进统一 Token。
4. **保持用户已经确定的产品取舍**：移动端一个自适应布局（不是按设备型号选择布局），Web 编辑器最大 430px 只是视觉预览框；图层列表不恢复顶部搜索区；新建默认间距为 1px。
5. **仅跑被改模块的单测、TypeScript / 安全所需构建**；不因单个 CSS 或小修复反复全回归。需要服务端运行时验收时，先保证开发机在线并做好回滚。


## 17. #15 — BrowserRouter 站内未保存离开拦截（2026-10-18）

- **新增 `appHistory.ts`**：在不迁移现有 `Routes` 与应用结构的前提下，用共享 `history@5` 浏览器历史替换主应用内层 `BrowserRouter` 为 `unstable_HistoryRouter`。因目前 react-router v6.30 HistoryRouter 的 History 类型期望包含 `createURL`、`encodeLocation` 和 `listen.delta`，加入显式适配器，监听回传 `delta:null`；保持原有 `PUBLIC_URL` basename 与路由配置不变。独立分享页的 BrowserRouter 未修改。
- **新增 `utils/blockBoardNavigation.ts`**：只在编辑器有未保存修改或正在保存时注册历史阻断，拦截 PUSH / REPLACE / POP；未保存时明确确认离开、取消则保留编辑器，保存中禁止导航，确认后先解除阻断再 `transition.retry()`，避免返回栈污染/重复弹窗。编辑器主动取消或成功保存后的退出则提前解除阻断，仍保留此前刷新/关标签的 `beforeunload` 提示。
- **专项测试**：`blockBoardNavigation.test.ts` 覆盖 PUSH、REPLACE、POP、取消后重试、保存中禁止离开、无修改时允许离开；`boardRouterIntegration.test.tsx` 用真实 `HistoryRouter + Link + Routes` 验证批准离开后 UI 实际导航。配合旧 `boardSaveStatus`、`boardUnsavedState` 测试和 `npm run checkTs`。使用 `history@5.3.0` 显式依赖并锁定安装。
- **风险与未完成验证**：主路由共享 history 是高风险入口变更，必须检查登录、用户路由、SPA 导航和刷新及保存成功/失败流程，之后再部署。不能只以 JSDOM 单测宣称浏览器端完全验收，也不能误改移动端 `mRect` 或桌面 `pRect`。

## 18. #18 请求去重与在途取消可靠性（2026-10-18）

- **请求去重**：`widgetDataBatcher.ts` 新增同一 boardId、widgetId、完整 requestParams（含过滤器、分页、排序等）作为标识的活跃 Promise 复用。同一组件、完全相同的并发请求只发送一次；不同组件绝不共享结果；结果完成/失败及时移除记录，避免误复用旧数据。不支持序列化的请求退化为原流程。
- **最新筛选优先**：同一 Widget 的查询参数变化时，自动取消之前尚在排队或仍在途的请求，旧结果即使晚于新请求返回也不会再 resolve；新请求不会复用旧的拒绝状态。后端支持的 `/execute/cancel/{queryId}` 用于尝试停止在途 SQL；取消后的批量失败回退会跳过已取消请求。
- **错误状态**：增加类型化 `WidgetFetchCancelledError`，`thunk.ts` 中取消只是卸载/新筛选的正常行为，不再错误地显示“图表查询失败”；真正的权限/网络/SQL 错误保留原有错误提示。
- **定向测试**：新增 `widgetDataBatcher.test.ts` 6 项，涵盖相同查询合并、不同 Widget 隔离、排队取消后重发、在途晚到后重发、快速更换筛选条件、旧结果乱序返回；`npm run checkTs` 通过。
- **剩余**：完整端到端加载 100/500/1000 个 Widget 的网络数量、总耗时、浏览器 FPS/内存仍需有授权的登录状态实测；分享模式的请求路径不直接使用本批处理器，应另测；服务端实际取消 SQL 是否及时释放资源需要专门压测。

## 19. 分享链接窄屏视图复用真正的移动布局（2026-10-18）

- **用户反馈**：分享出去的 `/shareDashboard/:token` 在手机上仍使用 PC 端 `AutoBoardCore`，一整行日期筛选、查询按钮和表格列被挤到右侧，手机页面出现横向裁剪。根因在 `DashboardForShare` 分享入口未选择 `MobileBoard` 的 `mRect` 呈现层。
- **修复逻辑**：当分享模式 `share` 且仪表板为 `auto`、可见窗口不超过 960px 时，自动复用 `MobileBoard.tsx` 已实现的单套 24 列移动排布组件 `MobileBoardContent`，从 `mRect` 读取坐标、移动控件弹层、卡片紧凑高度与表格内部滚动规则均与普通移动展示一致。桌面大于阈值和定时任务 `schedule` 保持原样；**960px 只决定 PC/移动呈现方式，不是多个手机分辨率预设或持久化断点**，设备旋转或窗口缩放自动重新判断，不重写 `pRect/mRect`。
- **分享令牌安全**：新增 `SharedMobileBoardCore` 只复用移动呈现层，不调用普通 `MobileBoard` 的 `fetchBoardDetail`（需要登录）；分享页继续由 `fetchShareVizInfo` 取得已有看板数据，`BoardInitProvider` 保留 `renderMode='share'`，移动可见 Widget 的异步加载也明确传入分享模式，继续使用令牌授权的 `shares/execute`。公开分享令牌授权不再受内部导航 `mobileVisible` 开关限制。
- **界面细节**：移动分享页保留精简标题栏，无内部组织返回按钮；分享页原有更多/刷新按钮以及定时导出路径不变。
- **定向测试**：`shareMobileLayout.test.ts` 测试 280～960px、桌面和定时导出边界；`DashboardForShareResponsive.test.tsx` 用 React 实际挂载切换 375px→1200px，确认注入 `isMobile` 的移动/桌面布局选择，TypeScript 检查通过。真正手机下的有效分享令牌查询和触屏滚动仍需在授权 URL 上验收。

## 20. #21 浏览器验收第一批：生产包冒烟进入 CI，移动分享真机测试可按授权运行（2026-10-18）

- **CI 自动执行（无凭据）**：新增 `frontend/e2e/specs/bundle-entry-smoke.spec.ts`：用 Playwright Chromium 加载本次 `vite build` 的 `/login` 与 `/shareDashboard.html` 多入口，检测跨 chunk 初始化 TDZ / JS 致命异常、旧 `admin-tools` 分包回归和登录白屏。 `.github/workflows/dashboard-grid-v2.yml` 在既有前端构建后启动本地 `vite preview`，安装锁定版本 Playwright + Chromium 并运行 **仅** `chromium-smoke` 项目；失败时上传不含登录凭据的烟测诊断。
- **开发机实跑证据**：从此前构建的真实 `build/` 产物，使用本地 `vite preview`，Playwright **2/2 通过**，浏览器 1.63.0 对应 Chromium headless-shell 1243。首次未锁定新版 Playwright 所需浏览器版本引发“可执行文件不存在”的环境失败，已固定 Playwright `1.63.0`，补 `e2e/package-lock.json`，之后实跑成功；不得将前一次基础设施失败混为业务页面失败。
- **授权分享端到端（显式 opt-in）**：新增 `shared-mobile.spec.ts`（320、375、430、768、900、960px 单套 `mRect`、页面宽度、分享模式请求不回退登录态、日期弹层/存在滚动表格时检查），`shared-desktop.spec.ts`（375→1200px 验证回到 `pRect`）。必须设置 `DATART_TEST_SHARED_DASHBOARD_PATH` 并在可访问的测试 Datart 运行；无授权路径时 **skip**，不能声称真数据浏览器验证通过。原 `chromium-editor` 仍需专用测试账号与 `DATART_TEST_STORAGE_STATE`。
- **隐私与范围**：新 `e2e/.gitignore` 排除存储状态、trace 与测试产物；CI 只运行无凭据的生产包入口冒烟，授权分享/登录编辑测试不上传含 token 的轨迹。README 提供分项目命令；增加的浏览器脚手架不改任何 `pRect/mRect`、组件间距或业务接口。
- **仍未完成的 #21**：完整已登录可变更隔离测试仪表板的拖拽、保存失败/重试、刷新/重开，Firefox/WebKit、真实物理手机触摸、DPR/zoom、100/500/1000 Widget 性能、真实分享 token 运行结果。后续只对发现的确切缺口继续修复。

## 21. #12 业务错误码与分享查询一致性；#21 修复 CI Playwright Registry（2026-10-18）

- **CI 修复（确定性环境问题）**：第 20 节的首轮 Actions `39093376778` 前端步骤安装 Playwright 时 `ENOTFOUND mirrors.tencentyun.com`，在浏览器测试开始前失败；后端、迁移、TypeScript、单测、构建步骤已成功。根因是 `frontend/e2e/package-lock.json` 内 3 个 Playwright 包的 `resolved` 错误指向腾讯云镜像。更新为 `https://registry.npmjs.org/`，CI 的 `npm ci` 指定标准 Registry。开发机按标准 Registry **干净 npm ci 成功**，并确认 Playwright 1.63.0；须查看下一次 GitHub Actions 是否最终运行真实 Chromium 冒烟并成功。
- **#12 业务响应失败**：新增无 UI 循环依赖的 `src/app/utils/queryResponse.ts`，正确拒绝 `HTTP 200 + { success:false,errCode,... }` 而不是把 `data:null` 当空结果；只携带 `errCode` 不把后端 SQL/敏感调试消息向看板传播。对于已有结构化 HTTP 403、`response.data.errCode===403`、`errCode===403` 等安全可判定字段才显示“无权限”，不根据文本“403”猜测权限。
- **请求接入**：普通单图表、批量图表、批量失败降级单图表均使用响应包解封装；单图表失败不再重复发起第二次请求；普通/分享 `fetchChartDataSet` 均检查业务失败并保留 Axios HTTP 403 原状，图表错误状态使用既有 `getWidgetQueryErrorMessage` 分类。
- **定向测试**：`widgetQueryError.test.ts`、`widgetDataBatcher.test.ts`、新增 `fetchChartDataSetResponse.test.ts` 共 **16 项**通过，包含 HTTP 200 业务失败、结构化 403、安全消息、共享 token 请求、单请求失败不重复发送、多组件 Batch 降级；前端 `npm run checkTs` 通过。用户可见的空态、权限态及分享查询实际浏览器效果仍需有权限的真实账号/令牌独立验收。
- **仍有后端边界**：当前服务端通用异常处理把部分 `PermissionDeniedException` 返回 HTTP 400 且不含结构化 `errCode`；在没有可靠状态码时前端显示普通查询失败，不擅自根据错误文案判为“无权限”。如需所有权限异常精确区分，应进一步约定服务端 API 统一返回 HTTP 403 和业务 403，并单独回归旧客户端。

## 22. #5/#9 移动端复杂筛选器与弹层宽度（2026-10-18）

- **根因**：`ControllerWidgetCore` 通过 `ConfigProvider.getPopupContainer` 把 AntD DatePicker / Select 弹层挂到 `document.body` / Fullscreen，先前写在 `.datart-mobile-board` 容器内的 `.ant-picker-dropdown` 样式无法选择到门户节点。范围日历默认双月横排宽约 560px，在 320/375px 手机上会被裁切；长下拉字段在窄 Widget 内没有完整提示。
- **修复**：所有 RangeTime、Time、单选、多选与 TreeSelect 都基于已有 `BoardContext.isMobile` 给弹层添加专属类（AntD 5 `classNames.popup.root`），桌面沿用原行为。全局 `Viz` 样式按门户节点类名限定：移动范围月历纵排；日历容器最大宽度 `min(320px, viewport - 12px)`、内部滚动与视口高度上限；下拉宽度限制在手机可视范围内，最低可用 240px，长选项文本省略并通过 title 查看完整内容；组件表单的超长标签本身可省略，不再挤压输入框。保留现有的日期原值/校验/筛选查询逻辑。
- **自动适配**：只有一个移动端 `mRect`，没有新增手机尺寸预设、也不会改写旧 `pRect/mRect`；编辑器内移动预览因 `isMobile` 为 true 同样应用上述弹层规则，CSS 不依赖外部浏览器窗口大小来判断是否是移动看板。
- **定向测试**：原 `RangeTimeController.test.tsx` 拓展日期范围/单日期弹层，新增 `MobileFilterPopup.test.tsx` 覆盖单选、多选、树形选择与完整长标签，**6/6 通过**，`npm run checkTs` 通过。开发机临时 Vite 单独测试页挂载真实组件与全局样式，Chromium 在 **320、375、430 CSS px** 验证日期弹层纵向排列、面板实际宽度 **288px**、文档没有横向溢出、JS 异常为零；下拉真实选项 title 保留。临时测试入口已删除，不纳入生产代码。
- **待验收**：真正登录态/分享的复杂筛选业务场景、日期时间制式/多层树、横竖屏切换与所有历史极小 Widget；已实现控件适配不等于全部 #5/#9 验收完成。

## 23. #21 授权分享 Chromium 实测与跨浏览器脚手架；#18 大批量请求背压（2026-10-18）

### #21 授权公开分享的真实页面验收

- 在开发机现有公开测试分享上，运行 `chromium-share-mobile` / `chromium-share-desktop` Playwright：**3 passed、1 skipped**（320～960px 单套 `mRect`、日期弹层交互、375→1200px 桌面切换通过）。跳过原因：该测试分享没有满足用例的可水平滚动 AntD 数据表格，**不能把它视为表格滚动已验收**。测试仅发起只读请求，不提交业务写操作，不输出分享令牌。
- 为相同的只读分享测试增加 `firefox-share-mobile` / `firefox-share-desktop` / `webkit-share-mobile` / `webkit-share-desktop` 项目，保持与已有 Chromium 断言相同；同时在测试中记录并断言真实分享 API 不出现 4xx/5xx，验证移动模式请求不回退登录态 `data-provider/execute`。这些项目是 **opt-in**，CI 默认不跑需要 token 的测试，访问令牌不得放入追踪或公开 Artifact。
- **跨浏览器结果界限**：TencentOS 开发机 Playwright Firefox 下载完成，但因缺少 `libx11-xcb1` 对应系统依赖未能启动浏览器，Firefox 4 个用例在启动阶段全部失败，属于**环境阻塞、不是页面验证失败**；WebKit 下载速度极慢，已停止并未运行。待切换到带 Firefox/WebKit 依赖的专用 Ubuntu Browser Runner 再执行；真实物理手机、编辑器登录态仍未完成。

### #18 请求背压与连续到达防饥饿

- 原有 150ms debounce 每到一个 Widget 都重置定时器，持续到达时间间隔小于 150ms 时首批请求可能被**无限推迟**；并发导入大量 Widget 时会把 1000 条数据请求组成一次巨大的批量 HTTP，缺乏前端背压。
- `widgetDataBatcher.ts` 现在仅在第一条待发请求进入队列时启动 150ms 计时，后续请求不延长首批等待。每批最大 **40 Widget**，最多 **2 批 HTTP 同时在途**；其余队列在已发批次完成时自动补位，原有同 Widget 去重、参数变更取消、按 boardId 独立取消、结果映射与失败降级均保留。
- `widgetDataBatcher.test.ts` 新增持续请求防饥饿、40/2 上限、100/500/1000 个**模拟请求**排队并全部正确完成、背压期间独立看板取消等测试；合计 **14/14 通过**，TypeScript `checkTs` 通过。大规模合成测试只证明请求数量与正确性，**不等于真实 100/500/1000 Widget 的 SQL、DOM、内存、FPS 生产性能达标**。
- 不更改服务端批量 API、数据库、`pRect/mRect`、用户自定义组件间距；更新开发机前需独立构建并验证登录/分享入口。仍待授权账号测试跨过滤器取消 SQL 是否及时释放连接、用户感知延迟和移动触摸实机浏览器验收。

## 24. #21 编辑器隔离保存验收、#18 真实浏览器基线、#16 JS 传输压缩、#20 语义 Token（2026-10-18）

### #21 只读 / 写入验收严格分离

- 新增 `e2e/specs/editor-save-reopen.spec.ts` 及独立 `chromium-editor-save` project。仅当同时配置 `DATART_TEST_DASHBOARD_EDITOR_PATH`、`DATART_TEST_STORAGE_STATE`、`DATART_TEST_ALLOW_EDITOR_MUTATION=true` 才执行：真实 React Grid Layout v2 拖拽、模拟第一次保存 HTTP 500、验证错误后仍可重试、重试调用真实保存并重新打开验证原 Widget 坐标。**会修改测试仪表板，必须是专用可丢弃副本**。当前开发机无授权的测试编辑器登录态，不操作用户现有看板，用例实际执行结果为 **1 skipped**，不是通过。
- Firefox/WebKit 的基础分享脚手架上一节已添加。TencentOS Firefox 缺少系统 `libx11-xcb1` 等依赖，浏览器未启动；WebKit 下载停止。需要在官方支持的 Linux/macOS Browser Runner 或实体设备完成。**Playwright 的设备仿真不等于真机。**

### #18 真实环境可重复的只读采样

- 新增 `e2e/specs/shared-performance.spec.ts` 和 `chromium-share-performance` 项目：仅用已授权公开测试分享，测量实际 FCP、DOM 节点、JS 堆内存（浏览器支持时）、渲染 Widget 数、HTTP 查询数/耗时、错误响应和稳定后 1 秒 RAF 帧率采样；输出本地脱敏 JSON，不包含分享 token/业务数据，也不生成模拟 SQL。
- 2026-10-18 开发机 Chromium 单次样本：**375px**：4 Widget、FCP **2280ms**、JS Heap **44.7 MB**、DOM **182**、API **3 次**、请求耗时中位 **188ms** / P95（仅 3 次）**230ms**、采样约 **61.8fps**、横向溢出 0；**1200px**：4 Widget、FCP **2316ms**、JS Heap **53.5 MB**、DOM **793**、API **3 次**、中位 **140ms** / P95 **291ms**、采样约 **61.1fps**、横向溢出 0。2/2 通过。**小样本且刷新稳定后的 RAF 仅反映空闲状态，不可声称达到 100/500/1000 Widget 的真实 SQL/拖拽 FPS/内存目标。**
- 大型独立测试环境 100/500/1000 图表的真实压力、后端 SQL 取消资源释放及有登录态的数据源测试仍未完成。

### #16 不更改分包关系的首屏网络优化

- 开发机实际 HTTP GET `/static/js/app.*.js` 的 Content-Type 为 **`text/javascript`**，虽然服务端 `server.compression.enabled=true`，旧 `mime-types` 仅包含 `application/javascript`，所以 JS Content-Length 仍是 **3,316,178 字节**无压缩；而 CSS 已正确 gzip。
- 补齐 `server/src/main/resources/application.yml` 和 `application-demo.yml` 的 `text/javascript` 压缩 MIME。保持 vendor/app 单 chunk，**不会重现曾发生的 admin-tools TDZ 分包白屏**。新增 `frontend/scripts/check-js-transfer-compression.mjs`，从真实部署的登录 HTML 找到版本 JS，请求 gzip 并断言类型、Content-Encoding、传输体积显著小于解码体积。只有在更新服务端部署并实际 HTTP 验证成功后才能宣称压缩生效。
- 继续禁止未经跨入口浏览器测试的强制细粒度 manualChunks。大文件解析/执行开销和进一步安全拆包仍待独立分支探索。

### #20 设计 Token 逐步统一

- 新增 `dashboardDesignTokens.ts`，明确间距、圆角、字号、行高、浅/深主题语义角色，现有 `MOBILE_BOARD_THEME` 改为从语义 Token 取值，**原来所有浅色视觉值保持完全一致**，不覆盖任何用户持久化布局间距和 `pRect/mRect`。
- `dashboardDesignTokens.test.ts` 与既有尺寸 Token 测试 4/4 通过，前端 `checkTs` 通过。深色 Token 仅定义接口，**尚未全面接入主题切换**；其他桌面、编辑器、图表插件仍待渐进统一。

### 本次范围与剩余

- 只运行改动对应定向测试、TypeScript、前端/后端构建及 CI 冒烟，不做每次全量回归。
- 剩余最大阻塞是**隔离测试账号与可变更仪表板副本、可用 Firefox/WebKit Runner、真实 100/500/1000 数据集**。在没有它们的情况下不伪造成功、不触碰已有用户数据。

## 25. #16 服务端 gzip 实际部署验证与 #20 进一步接入（2026-10-18）

- 已在开发机重新构建服务端 JAR、备份旧 JAR/静态资源后受控重启（原进程结束后新服务恢复 HTTP 200）。默认及 Demo 压缩 MIME 均包含 `text/javascript`。真实 `curl Accept-Encoding:gzip` 验证返回 `Content-Encoding: gzip`。
- Tomcat gzip 采用 chunked 传输，可能没有 `Content-Length`；初版压缩检查误将其当失败，现 `check-js-transfer-compression.mjs` 直接读取原始 HTTP 压缩数据并通过 `gunzipSync` 对比，**实际验证成功**：`app.f8d25ba8.js` 原始 **3,316,933 bytes**、gzip **1,328,450 bytes**（比率 0.401）；`vendor.ace8640f.js` 原始 **9,356,010 bytes**、gzip **2,741,838 bytes**（比率 0.293）。两包合计传输由 **12,672,943 bytes** 减至 **4,070,288 bytes**，节约约 **67.88%**（仅传输字节，非 JS 执行耗时）。未改 manualChunks，未引发 admin-tools TDZ。
- 将 `DASHBOARD_DESIGN_TOKENS` 进一步用于 `MobileTablePresentation.tsx` 的 12 组重复的边距、色值、字号和圆角；与既有 `MOBILE_BOARD_THEME` 共用语义值，浅色外观、已有存储布局无变化。对应 4 项 Token 单测和 TypeScript 已通过。
- 真实编辑器写入验收仍受专用授权测试登录态、独立测试仪表板副本限制；Firefox/WebKit 仍因环境受限未通过完整引擎验收。大量真实图表数据库 SQL 取消效果仍待安全隔离压测。

## 26. 未完成项继续推进：跨浏览器 CI、静态资源缓存、导航 Token 与 JDBC SQL 取消探针（2026-10-18）

- **#21 Firefox/WebKit**：增加 `firefox-smoke`、`webkit-smoke`、`webkit-mobile-smoke` 三个公开入口项目，加上既有 Chromium，共 **8 项登录页/分享 HTML 入口测试**。修改 `.github/workflows/dashboard-grid-v2.yml`：GitHub Ubuntu runner 安装 Playwright chromium/firefox/webkit 与操作系统依赖后运行这 8 项，不要求登录态或分享 Token。能查出跨引擎入口初始化/白屏问题，但不等同于完整私有仪表板、真实手机触摸验收。
- **#16 版本化静态资源浏览器缓存**：`WebMvcConfig` 为 Vite 生成的 `/static/js/**` 和 `/static/css/**` 添加 `Cache-Control: public, max-age=31536000, immutable` 资源映射，HTML 保留原有 `no-cache`。部署采取覆盖保留旧版哈希文件，避免缓存中的旧入口引用 404；新增 `npm run check:static-cache` 验证实际 JS/CSS HTTP 200、immutable 与 HTML 不缓存。此次无需改变 Vite manualChunks、保留之前避免 TDZ 白屏的固定 app/vendor 结构。实际效果须按部署结果确认。
- **#20 继续统一移动端 UI Token**：移动端顶部导航背景、标题文字、底部分隔线、返回图标和空状态的颜色改用 `MOBILE_BOARD_THEME` 从 `dashboardDesignTokens` 获取，浅色默认值完全相同；浅色/深色语义 Token 补齐 nav/icon/divider 角色，不自动打开暗色模式，不更改 `pRect/mRect`。Token 定向单测和 TypeScript 检查通过。
- **#18 真正 JDBC SQL 中断小样本探针**：增加可选 `tools/SqlCancellationProbe.java`，仅在提供独立授权测试 MySQL JDBC URL、用户名、密码环境变量时执行一条 `SELECT SLEEP(8)`，验证不同 owner 不可取消，正确 owner 调用 Registry.cancel 后 SQL 能在规定时间内结束。脚本不会写业务表或运行大批量 SQL；初次探针尝试因错误的连接地址/数据库身份被拒绝，**尚无成功的真实 JDBC 取消延迟结果**。真实 100/500/1000 图表压测仍需独立大型测试数据与账号，不虚构指标。
- **剩余验收**：已登录隔离仪表板拖拽→保存失败→重试→重开的可变更测试、真实 iOS/Android 触屏、真实多图表 SQL/P95/内存压力，以及深色主题完整切换。CI/部署结论以相应成功记录为准。
