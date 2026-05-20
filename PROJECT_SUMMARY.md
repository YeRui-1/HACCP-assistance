# HACCP AI 助手 — 项目总结报告

## 项目概述

食品安全 HACCP 计划辅助生成系统。管理员设计问卷模板，用户填写问卷，系统自动生成标准 HACCP 计划。前后端分离架构，支持中英文双语。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JS，SPA 单页应用，零依赖 |
| 后端 | Python FastAPI + SQLite |
| 存储 | 前端 localStorage（回退） + 后端 SQLite（主） |
| 通信 | RESTful API，JSON 格式，CORS 全开放 |

## 项目结构

```
d:\HACCP assistance/
├── index.html                    # SPA 入口，四个视图容器
├── css/style.css                 # 全局样式（~630 行）
├── js/
│   ├── app.js                    # 路由分发、密码验证、语言切换
│   ├── admin.js                  # 管理后台（~620 行）
│   ├── questionnaire.js          # 动态问卷渲染 + 流程图（~600 行）
│   ├── results.js                # 结果展示（~290 行）
│   ├── i18n.js                   # 中英文词条（~140 key）
│   └── mock-data.js              # HACCP 计划 mock 数据（双语）
├── backend/
│   ├── main.py                   # FastAPI 应用，10 个端点
│   ├── database.py               # SQLite 数据层，多模板管理
│   └── requirements.txt
└── .gitignore
```

## 用户端功能

### 大厅页
- 两张功能卡片：「填写问卷」「查看结果」
- 结果卡片实时显示状态（已有计划 / 暂无计划）

### 动态问卷
- 由管理员完全自定义章节和题目
- 支持 8 种题型：

| 题型 | 控件 | 说明 |
|------|------|------|
| 文本 | `<input text>` | 单行文本 |
| 多行文本 | `<textarea>` | 长文本 |
| 数字 | `<input number>` | 数值输入 |
| 日期 | `<input date>` | 日期选择 |
| 下拉选择 | `<select>` | 单选下拉 |
| 单选 | `<radio>` 组 | 选项互斥 |
| 多选 | `<checkbox>` 组 | 选项多选 |
| 表格题 | 可编辑 `<table>` | 自定义列，动态增删行 |

- 表单验证、实时保存、必填校验

### 生产流程图
- 独立章节类型，可与其他章节混排拖拽
- 每个步骤包含：
  - 步骤名称、描述
  - 关键限值、设备名称
  - 原料/辅料/添加剂（名称、用量、作用）— 可动态增删行
  - 工艺参数（名称、参数值、单位）— 可动态增删行
- 步骤支持上移/下移/删除

### 结果页
- AI 分析报告（自动调用后端，加载中动画，失败红色提示）
- 生产流程图展示
- 用户答案表（章节/题目/答案 三列）
- HACCP 计划模拟章节（危害分析、CCP、关键限值、监控程序、纠正措施、验证程序、记录保存）

### 中英文切换
- 顶部 EN/中 按钮
- 覆盖全部 UI 文案 + mock 数据 + 题型标签

## 管理后台功能

### 入口
- 顶部「管理」按钮 → 密码弹窗（`admin123`）

### 左侧菜单
- 模板管理（默认）
- 查看结果

### 模板管理页
- 模板列表表格：名称、描述、发布状态（徽章）、更新时间、操作
- 操作：新建（弹窗）、编辑、发布、复制、删除
- 已发布模板禁止删除
- 全部数据通过 API 持久化到 SQLite

### 编辑问卷
- 从模板列表进入，顶部显示模板名称 + 「返回模板列表」
- 左侧章节列表：拖拽排序（HTML5 Drag & Drop）、流程章节带 🔄 图标、双击标题/点击 ✎ 按钮改名、删除按钮
- 右侧编辑区：普通章节为题目编辑器（标题、类型、必填、选项/列配置），流程章节为默认步骤模板 textarea
- 编辑/测试模式切换

### 查看用户提交结果
- 按章节展示用户答卷
- 表格题展示为 HTML table
- 「生成 AI 报告」按钮（调用后端）

## 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/template` | 获取已发布模板（用户端用） |
| GET | `/api/templates` | 模板列表（不含 content） |
| GET | `/api/templates/{id}` | 单个模板完整内容 |
| POST | `/api/templates` | 创建模板（支持 copy_from_id） |
| PUT | `/api/templates/{id}` | 更新模板 |
| DELETE | `/api/templates/{id}` | 删除模板（已发布拒绝） |
| POST | `/api/templates/{id}/publish` | 发布模板 |
| GET | `/api/usage` | Mock 用量数据 |
| POST | `/api/generate_report` | Mock AI 报告 |

## 数据库

SQLite 单表 `templates`：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT | 模板名称 |
| description | TEXT | 描述 |
| content | TEXT(JSON) | `{questionnaire: {sections: [...]}}` |
| is_published | INTEGER | 0=草稿 / 1=已发布 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

自动迁移：启动时补齐旧表缺失的列。

## 数据存储策略

| 数据 | 主存储 | 回退 |
|------|--------|------|
| 问卷模板 | SQLite（API） | localStorage |
| 用户答案 | localStorage | — |
| 流程图数据 | localStorage（按 sectionId 分键） | — |
| 语言偏好 | localStorage | — |

管理员编辑时自动 `syncToBackend()`，前端加载时先 `syncTemplateFromBackend()`。后端不可用时静默回退到 localStorage。

## UI 特点

- 靛蓝色主调（`#4f46e5`）+ 柔和渐变背景
- 毛玻璃导航栏（`backdrop-filter: blur`）
- 卡片 hover 上浮 + 阴影加深
- 输入框 focus 发光环
- 页面切换 fadeIn 动画
- 按钮渐变 + 微上浮
- 空状态统一图标提示
- 响应式适配移动端

## Git 历史

```
ccd0c58 添加 .gitignore，移除缓存/数据库文件
4487d60 初始提交：HACCP AI 助手
```

## 待改进项

| 优先级 | 问题 | 说明 |
|--------|------|------|
| 高 | AI 报告接入 | 当前为 mock，需对接真实 AI |
| 高 | 用户答案持久化 | 目前仅存 localStorage，需后端接口 |
| 中 | 多人编辑冲突 | 无版本控制或锁机制 |
| 中 | 步骤排序 | 需拖拽替代上移/下移 |
| 低 | 模板数据迁移 | `flowchart` 旧键清理 |

## 启动方式

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# 前端
# 浏览器直接打开 index.html
```
