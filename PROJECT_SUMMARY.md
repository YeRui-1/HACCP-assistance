# HACCP AI 助手 — 项目总结报告

## 项目概述

食品安全 HACCP 计划辅助生成系统。管理员设计问卷模板，用户填写问卷（含生产流程图），系统调用 DeepSeek AI 参考模版自动生成完整 HACCP 计划书。前后端分离架构，支持中英文双语。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JS，SPA 单页应用，零依赖 |
| 后端 | Python FastAPI + SQLite |
| AI | DeepSeek API（OpenAI SDK 兼容调用） |
| 存储 | 前端 localStorage（回退） + 后端 SQLite（主） |
| 通信 | RESTful API，JSON 格式，CORS 全开放 |

## 项目结构

```
d:\HACCP assistance/
├── index.html                            # SPA 入口，四个视图容器
├── 菊粉生产企业HACCP计划书模版.md          # HACCP 计划参考模版（AI 提示词用）
├── css/style.css                         # 全局样式（~630 行）
├── js/
│   ├── app.js                            # 路由分发、密码验证、语言切换
│   ├── admin.js                          # 管理后台（模板管理 + 报告管理）
│   ├── questionnaire.js                  # 动态问卷渲染 + 流程图
│   ├── results.js                        # 报告列表 + 报告详情展示
│   ├── i18n.js                           # 中英文词条（~170 key）
│   └── mock-data.js                      # HACCP 计划 mock 数据（AI 失败时 fallback）
├── backend/
│   ├── main.py                           # FastAPI 应用，14 个端点
│   ├── database.py                       # SQLite 数据层，模板 + 报告 CRUD
│   ├── ai_service.py                     # AI 服务：提示词构建 + DeepSeek API 调用
│   ├── requirements.txt                  # fastapi, uvicorn, pydantic, openai
│   └── .env                              # DeepSeek API Key（不提交 git）
└── .gitignore
```

## 用户端功能

### 大厅页
- 两张功能卡片：「填写问卷」「查看结果」

### 动态问卷
- 管理员完全自定义章节和题目
- 支持 8 种题型：文本、多行文本、数字、日期、下拉选择、单选、多选、表格题
- 表单验证、实时保存、必填校验

### 生产流程图
- 独立章节类型，可与其他章节混排
- 每个步骤包含：名称、描述、关键限值、设备名称
- 原料/辅料/添加剂（名称、用量、作用）— 可动态增删行
- 工艺参数（名称、参数值、单位）— 可动态增删行
- 步骤支持上移/下移/删除

### 结果页

**报告列表视图**（默认入口）：
- 展示所有已生成的历史报告（按时间倒序）
- "新建报告"按钮 → 返回问卷页
- 点击任意报告进入详情
- 无报告时显示空状态引导

**报告详情视图**：
- 左侧侧边栏：返回列表链接 + 章节导航 + 历史报告快速切换
- 主体内容依次为：
  1. 产品描述（用户填写的产品信息表）
  2. 生产流程（AI 根据流程图步骤生成的生产过程叙述）
  3. 生产流程图（用户填写的步骤卡片）
  4. HACCP 计划章节（危害分析、CCP、关键限值、监控程序、纠正措施、验证程序、记录保存）— AI 生成

**报告生命周期**：
- 提交问卷 → 自动调用 AI 生成报告 → 保存到后端 → 直接展示
- 再次进入结果页 → 显示报告列表（不重新调用 AI）
- 查看历史报告 → 从后端加载（秒开）
- 切换语言 → 自动重渲染双语内容

### 中英文切换
- 顶部 EN/中 按钮，全局生效
- 覆盖全部 UI 文案 + AI 生成的双语内容 + 题型标签
- 切换时自动重渲染当前页面

## 管理后台功能

### 入口
- 顶部「管理」按钮 → 密码弹窗（`admin123`）

### 左侧菜单
- 模板管理（默认）
- 用户报告

### 模板管理页
- 模板列表表格：名称、描述、发布状态、更新时间、操作
- 操作：新建、编辑、发布、复制、删除
- 已发布模板禁止删除

### 编辑问卷
- 章节列表拖拽排序，流程章节带特殊图标
- 编辑/测试模式切换
- 题型编辑器（标题、类型、必填、选项/列配置）
- 流程章节：默认步骤模板 textarea

### 用户报告管理
- 报告列表表格：ID、生成时间、语言、操作
- 点击「查看」展开完整报告（AI 摘要 + 全部 HACCP 章节）
- 点击「删除」确认后删除

## 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/template` | 获取已发布模板（用户端） |
| GET | `/api/templates` | 模板列表 |
| GET | `/api/templates/{id}` | 单个模板完整内容 |
| POST | `/api/templates` | 创建模板 |
| PUT | `/api/templates/{id}` | 更新模板 |
| DELETE | `/api/templates/{id}` | 删除模板 |
| POST | `/api/templates/{id}/publish` | 发布模板 |
| GET | `/api/usage` | Mock 用量数据 |
| POST | `/api/generate_report` | AI 生成 HACCP 报告（DeepSeek） |
| POST | `/api/reports` | 保存报告 |
| GET | `/api/reports` | 报告列表（不含大字段） |
| GET | `/api/reports/{id}` | 报告详情（含完整 plan） |
| DELETE | `/api/reports/{id}` | 删除报告 |

## 数据库

### templates 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT | 模板名称 |
| description | TEXT | 描述 |
| content | TEXT(JSON) | `{questionnaire: {sections: [...]}}` |
| is_published | INTEGER | 0=草稿 / 1=已发布 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### reports 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| title | TEXT | 报告标题（生成时间） |
| template_id | INTEGER | 关联模板 ID |
| answers | TEXT(JSON) | 用户问卷答案 |
| flowcharts | TEXT(JSON) | 生产流程图数据 |
| plan | TEXT(JSON) | AI 生成的完整 HACCP 计划 |
| language | TEXT | zh / en |
| created_at | TEXT | 生成时间 |

## 数据存储策略

| 数据 | 主存储 | 回退 |
|------|--------|------|
| 问卷模板 | SQLite（API） | localStorage |
| 用户答案 | localStorage | — |
| 流程图数据 | localStorage（按 sectionId 分键） | — |
| AI 报告 | SQLite（API） | — |
| 报告历史列表 | localStorage | — |
| 语言偏好 | localStorage | — |

## AI 报告生成流程

1. 用户提交问卷 → 前端收集 answers + template + flowcharts
2. 后端加载参考模版（`菊粉生产企业HACCP计划书模版.md`）作为格式参考
3. 构建系统提示词（模版 + JSON schema）+ 用户提示词（答案文本化）
4. 调用 DeepSeek API（`deepseek-chat`，`response_format=json_object`）
5. 校验返回 JSON 完整性，缺失章节填充占位
6. 前端渲染双语 HACCP 计划，自动保存到后端 reports 表
7. `DEEPSEEK_API_KEY` 配置：环境变量 或 `backend/.env` 文件

## UI 特点

- 靛蓝色主调 + 柔和渐变背景
- 毛玻璃导航栏
- 卡片 hover 上浮 + 阴影加深
- 输入框 focus 发光环
- 页面切换 fadeIn 动画
- 报告列表卡片式布局
- 空状态统一图标引导
- 响应式适配移动端

## Git 历史

```
e6a24e7 feat: Implement AI report generation and management features
472aa13 完善了生产流程图的填写
268a72a 丰富了流程图细节（参数，设备），并调整流程图为章节
9a0f9af 更改了界面UI，提升了质感
ccd0c58 添加 .gitignore，移除缓存/数据库文件
```

## 启动方式

```bash
# 1. 配置 DeepSeek API Key（二选一）
#    方式A：环境变量 set DEEPSEEK_API_KEY=sk-xxxx
#    方式B：写入 backend/.env 文件

# 2. 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# 3. 前端
# 浏览器打开 index.html
```
