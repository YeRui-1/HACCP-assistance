# 本轮新增功能总结

> 当前分支: `current-update` | 日期: 2026-07-01

---

## 一、流程图编辑器 (Step 4) 布局优化

### 涉及文件
- **`css/style.css`** — 新增 `~330行` CSS (在 `.fcp-svg-wrap svg` 之后)
- **`js/profile.js`** — SVG尺寸 + 步骤列表高度

### 改动详情

**css/style.css** — 在 `.fcp-svg-wrap svg { max-width: none; }` 之后插入全部新样式:
```css
/* ===== 档案 - 流程图编辑器 (Step 4) ===== */
.pf-fc-editor-wrap       — 外层容器
.pf-fc-toolbar           — 工具栏
.pf-fc-columns           — 双栏网格布局: 左420px + 右自适应
.pf-fc-left              — 左栏: 滚轮滚动、高度撑满
.pf-fc-right             — 右栏: SVG预览区带滚动
.pf-fc-editor-section    — 编辑区块卡片
.pf-fc-editor-section h5 — 区块标题
.pf-fc-svg-wrap          — SVG容器
.pf-fc-svg-wrap svg      — SVG自适应(max-width:100%)
/* --- 步骤列表 --- */
.fcp-step-list / .fcp-step-item / .fcp-step-num / .fcp-step-num.ccp
.fcp-step-input / .fcp-move-btn / .fcp-ccp-btn / .fcp-step-del
/* --- 添步骤行 --- */
.fcp-add-step
/* --- 箭头标注列表 --- */
.fcp-arrow-list / .fcp-arrow-item / .fcp-arrow-tag(.green/.red)
.fcp-arrow-del / .fcp-arrow-add
/* --- 空状态提示 --- */
.fcp-empty-hint
/* --- 图例 --- */
.pf-fc-legend / .fcp-legend-box / .fcp-legend-line
/* --- 响应式 --- */
@media (max-width: 900px) { ... }
```
**注意**: 原有的 `@media (max-width: 900px)` 规则被替换为新的响应式规则(去掉了 `fcp-layout/fcp-sidebar/fcp-tab-content`)

**js/profile.js** — 3处修改:
1. **SVG尺寸自适应** (第558-560行):
   ```js
   // 旧: svg.setAttribute('width', 1600);
   // 新: svg.setAttribute('width', '100%'); svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
   ```
2. **去掉内联max-height** (第628-634行): 步骤列表 `max-height:250px`、左侧输入箭头 `max-height:100px`、右侧输出箭头 `max-height:100px`、返工箭头 `max-height:80px` 全部移除，改为由左栏 `overflow-y: auto` 统一管理滚动

---

## 二、Word文档导出功能 (查看结果页)

### 涉及文件
- **`js/results.js`** — 新增 `exportToWord()` 函数 + 导出按钮

### 改动详情

**1. 侧边栏导出按钮** (`render15minSidebar` 和 `renderSidebar` 两个函数):

在每个侧边栏 > 顶部插入蓝色 `📄 导出Word` 按钮:
```js
var exportLabel = lang === 'en' ? '📄 Export Word' : '📄 导出Word';
nav.innerHTML = '<div ...><button id="btnExportWord" ...>' + exportLabel + '</button></div>';
nav.innerHTML += '<ul ...>' + items.map(...) + '</ul>';
// 绑定事件
var exportBtn = document.getElementById('btnExportWord');
if (exportBtn) exportBtn.addEventListener('click', exportToWord);
```

**2. `exportToWord()` 函数** (第638行开始，~290行):
- 数据源合并: 优先 `haccp_profile_data`(档案步骤1-3)，补充 `haccp_15min_submitted`(15min问卷)
- 生成Word兼容HTML(.doc格式)，UTF-8 BOM头
- 8个章节，2~8章各新起一页 (`page-break-before: always`)

**输出内容:**
| 章节 | 内容 |
|------|------|
| 一 | HACCP小组组成: 企业名/部门/审核人/其他项目/成员表 |
| 二 | 产品描述: 7项字段 + 自定义额外项目 |
| 三 | 预期用途: 6项字段 + 自定义额外项目 |
| 四 | 产品与生产流程: 产品信息10项/配方表/操作步骤表/流程图确认 |
| 五 | CCP判定结果: bio/chem/phys三行/步骤 |
| 六 | 危害分析: 按步骤/材料分组，三行(生物+化学+物理)/步骤; 无某类危害填"无显著XX危害" |
| 七 | 关键限制与监控: 执行标准/监控表/纠偏措施表 |
| 八 | 记录与报表: 保存期限/格式要求 |

---

## 三、AI辅助CCP判定 (问卷第2步)

### 涉及文件
- **`js/questionnaire-15min.js`** — UI按钮 + `aiCcpJudgment()` + 汇总表增强

### 改动详情 (⚠️ 注意: 本功能正在实施中，你可能需要拉新版本后重新做这部分)

**1. 步骤编辑页按钮** (第723-728行左右):
```js
// 新增按钮: 🤖 AI辅助CCP判定  +  📋 手动CCP判断
// 原 "CCP判断" 按钮改名 "📋 手动CCP判断"
html += '<button class="btn btn-primary btn-sm" id="aiCcpBtn" ...>🤖 AI辅助CCP判定</button>';
html += '<button class="btn btn-outline btn-sm" id="ccpJudgeBtn" ...>📋 手动CCP判断</button>';
html += '<span id="aiCcpHint" ...></span>';  // AI状态提示
```

**2. `aiCcpJudgment(data)` 函数** (在 `evaluateCCPFromQA` 之前插入):
- 构建步骤Payload发POST到 `/api/ai/ccp-judgment`
- 成功后写入 `data.ccpSteps[si].hazards[bio/chem/phys]` (含 q1-q5, isCCP, hazardDesc, aiReasoning)
- 自动跳转汇总表 (`data.ccpPageMode = 'summary'`)
- 失败降级提示

**3. 按钮绑定** (第1966行附近):
```js
var aiBtn=content.querySelector('#aiCcpBtn');
if(aiBtn)aiBtn.addEventListener('click',function(){collectSectionData(content,data);aiCcpJudgment(data);});
```

**4. CCP汇总表增强** (`renderCcpSummary`):
- 新增AI标识列: 有aiReasoning的显示 `🤖 AI分析` 标签
- 新增"AI分析依据"列(有AI数据时显示)
- 顶部紫色提示栏: "AI辅助判定完成 — 请人工复核"

---

## 四、危害分析无限循环修复

### 涉及文件
- **`js/questionnaire-15min.js`**

### 问题
`loadStepHazards()` 加载 `data/step_hazards.json` 失败时没有缓存空结果，导致 `autoMatchStepHazards()` 反复触发 → 页面卡死

### 修复 (3处)

**1. `loadStepHazards` — .catch() 中缓存空数组**:
```js
.catch(function(err) {
    clearTimeout(timeoutId);
    _stepHazardsCache = [];   // 新增: 缓存空数组
    _stepHazardsMap = new Map(); // 新增
    console.warn('步骤危害数据库加载失败:', err);
    return [];
});
```

**2. `autoMatchStepHazards` — 指纹改用实际步骤名**(第2923行附近):
```js
// 旧: data._hazardStepFingerprint = 'none';  ← 导致死循环
// 新: data._hazardStepFingerprint = fcSteps.join(',');  ← 匹配不上时也写实际指纹
```

**3. `refreshStepHazards` — 同样修复**(第2798行附近):
```js
// 新增: 失败时也保存指纹 + 重新渲染去掉loading
data._hazardStepFingerprint = fcSteps.join(',');
if (!stepDb || stepDb.length === 0) {
    data._unmatchedSteps = fcSteps;
    saveData(data);
    renderActiveSection();
    renderSectionNav();
    return;
}
```

---

## 五、profile.js — return 导出列表微调

移除了 `fcEditStep` 从公开API中 (与其他函数一致，已有Profile.fcEditStep的oninput调用)

---

## 迁移步骤 (拉新版本后重做)

### 1. CSS (直接复制)
将 `css/style.css` 中 `/* ===== 档案 - 流程图编辑器 (Step 4) ===== */` 到 `@media` 响应式结束之间所有新增CSS复制到新版本同一位置。

⚠️ 注意 `@media (max-width: 900px)` 块需要替换(不是新增)。

### 2. profile.js
- SVG宽度: `'width', '100%'` + `preserveAspectRatio`
- 去掉4处 `style="max-height:XXXpx;"` 内联限制
- ⚠️ return 导出列表可能需要对照新版调整

### 3. results.js
- 两个侧边栏函数各加export按钮HTML + 绑定
- 新增完整 `exportToWord()` 函数 (~290行，在 `return { init }` 前)

### 4. questionnaire-15min.js
- 步骤编辑页: AI按钮 + btn-outline样式的手动按钮 + hint span
- `aiCcpJudgment()` + `tryMockCcpJudgment()` 函数 (在 `evaluateCCPFromQA` 前)
- 按钮绑定 `aiCcpBtn`
- CCP汇总表: AI标签 + 推理列 + AI提示栏
- 3处无限循环修复

---

## 未完成

- **AI CCP判定** — 按钮和UI已加，但需要验证后端 `/api/ai/ccp-judgment` 接口调通
- **中英文翻译 (Phase 2)** — Word导出目前全中文，尚未做i18n
