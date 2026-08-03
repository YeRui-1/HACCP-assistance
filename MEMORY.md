# HACCP AI 助手 — 项目总览

## 定位
食品生产企业 HACCP 计划在线编制工具。用户通过 15 分钟快速问卷完成危害分析、CCP 判定、关键限值、监控、纠偏、验证全流程，生成标准化 HACCP 计划书。

## 技术栈
- **前端**: Vanilla JS SPA，无框架，localStorage + fetch API
- **后端**: FastAPI + SQLite + JWT, `backend/main.py` (1759行)
- **AI**: DeepSeek Chat API，无 key 时走本地启发式 mock
- **流程图**: Mermaid.js + draw.io embed + 自定义 SVG 渲染器
- **i18n**: 自研 `|||` 分隔符双语系统，1561 个 key (`js/i18n.js`)

## 页面架构 (8 页 SPA)
| 页面 | 功能 |
|------|------|
| 首页大厅 | 入口 + 状态概览 + 登录/注册 |
| 创建档案 (profile) | 公司/团队/产品描述/流程图 |
| 15min 问卷 (questionnaire) | 7 步完整 HACCP 编制 (4446 行) |
| 查看结果 (results) | HACCP 计划书 + Word 导出 |
| 记录管理 (records) | 监控/纠偏/验证运行记录 |
| 验证程序 (verification) | HACCP 体系验证 |
| 管理后台 (admin) | 模板管理 + 演示数据编辑器 + 报告 |
| 模板预览 (flowchart-preview.html) | 独立流程图编辑器 |

## 数据层
- **localStorage**: 16 个 `haccp_*` key，主存储
- **后端 SQLite**: `users` / `templates` / `plans` 三表
- **演示数据**: `data/demo_inulin_full.json` (43 字段完整 HACCP 计划) + `data/demo_inulin.json` (流程图数据)
- **同步**: 问卷提交时 await POST plans，验证/记录 fire-and-forget PUT
- **数据流**: 问卷按键自动存 localStorage → 管理后台「从问卷保存」→ API 同步服务器文件

## 后端 API (24 端点)
- `POST /api/auth/register|login` + `GET /api/auth/me`
- `GET|POST /api/plans` + `GET|PUT|DELETE /api/plans/{id}`
- `GET|PUT /api/demo/data` (演示数据，自动检测完整计划并同步写两个文件)
- `GET /api/demo-full` 已移除，改为直接 GET `/data/demo_inulin_full.json` (静态挂载)
- 6 个 AI 端点: fill-from-text, ccp-judgment, critical-limits, monitoring, corrective-actions, verification
- 模板 CRUD + 报告生成

## 演示数据工作流
1. 管理后台 → 📥 加载完整示例 → localStorage
2. 问卷页面填改数据 → 每次按键自动存 localStorage
3. 管理后台 → 📤 从问卷保存 → PUT API + localStorage backup
4. 🗑 清除问卷数据 → 清除 16 key + 自动刷新

## 关键修复记录 (本次会话)
- CCP 判定关键词匹配: `kw.split("|||")[0]` 修复 bilingual 关键词不匹配
- hazardDesc 渲染: 3 处漏加 `I18n.b()`
- CCP 决策树 40+ 处硬编码中文 → i18n key
- flowchart-preview.html 全页面双语化
- CSS: 768px/480px 断点 + focus-visible + reduced-motion
- 52 个空 catch 块加 console.warn
- 流程图数据 `|||` 双语化 (35+41 对)
- localStorage 清理: 删除重复 key，统一 `haccp_` 前缀
- demo_inulin_full.json 完整 HACCP 示例 (15 步骤 + 4 组员 + 配方)
- 问卷自动保存: `data-q15-field` 输入框每次按键存 localStorage
