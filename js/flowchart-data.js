/**
 * 菊粉生产工艺流程图 - Mermaid 定义
 * 直接在浏览器端由 Mermaid.js 渲染为 SVG
 */
const INULIN_FLOWCHART = {
  mermaid: `graph TD
  %% 样式定义
  classDef ccp fill:#fff3e0,stroke:#ff9800,stroke-width:2px;
  classDef oprp fill:#e3f2fd,stroke:#1976d2,stroke-width:2px;
  classDef cqp fill:#e8f5e9,stroke:#43a047,stroke-width:2px;
  classDef io fill:#f3e5f5,stroke:#8e24aa,stroke-width:1px;

  %% === 左侧流程（前处理与提取） ===
  L1["1. 菊芋验收 (CQP-1)"]:::cqp
  L2["2. 清洗 (OPRP-1)"]:::oprp
  L3["3. 粉碎 (OPRP-2)"]:::oprp
  L4["4. 匀浆"]
  L5["5. 加热加压提取"]
  L6["6. 减压浓缩"]
  L7["7. 一级膜过滤 (CCP-1)"]:::ccp
  L8["8. 脱色 (OPRP-3)"]:::oprp

  %% 输入输出
  L2_sub["地下水 超声波清洗机 30min,40℃"]:::io
  L2_waste["废水"]:::io
  L3_sub["粉碎机/捣碎机 →5mm"]:::io
  L4_sub["纯净水 超声波(50~100W;40KHZ)12min"]:::io
  L5_waste["废渣"]:::io
  L6_out["纯水"]:::io
  L7_sub["搅拌机,絮凝沉淀,滤机"]:::io
  L7_out["蛋白质和纤维素"]:::io
  L8_in["活性炭"]:::io
  L8_out["废活性炭"]:::io

  %% 左侧主流程
  L1 --> L2 --> L3 --> L4 --> L5 --> L6 --> L7 --> L8

  %% 左侧标注连接
  L2_sub -.-> L2
  L2 -.-> L2_waste
  L3_sub -.-> L3
  L4_sub -.-> L4
  L5 -.-> L5_waste
  L6_out -.-> L6
  L7_sub -.-> L7
  L7 -.-> L7_out
  L8_in -.-> L8
  L8 -.-> L8_out

  %% 回流
  L6 -.->|循环提取| L5

  %% === 连接左右 ===
  L8 -->|菊粉溶液| R1

  %% === 右侧流程（纯化与干燥） ===
  R1["9. 脱离子 (OPRP-4)"]:::oprp
  R2["10. 二级膜过滤 (CCP-2)"]:::ccp
  R3["11. 醇降"]
  R4["12. 干燥 (CCP-3)"]:::ccp
  R5["13. 金属检测 (CCP-4)"]:::ccp
  R6["14. 包装 (OPRP-5)"]:::oprp
  R7["15. 成品储存与运输"]

  %% 右侧标注
  R1_in["交换树脂"]:::io
  R1_out["饱和树脂"]:::io
  R2_out["粗菊粉溶液"]:::io
  R3_in["乙醇"]:::io
  R3_out["沉淀"]:::io
  R4_sub["烘干设备 120-180℃"]:::io
  R5_out["不合格产品"]:::io

  %% 右侧主流程
  R1 --> R2 --> R3 --> R4 --> R5 --> R6 --> R7

  %% 右侧标注
  R1_in -.-> R1
  R1 -.-> R1_out
  R2 -.-> R2_out
  R3_in -.-> R3
  R3 -.-> R3_out
  R4_sub -.-> R4
  R5 -.-> R5_out

  %% 右侧回流
  R2 -.->|脱离子菊粉溶液| R1
  `
};

// 挂载到 window 供 flowchart-viewer.js 使用
if (typeof window !== 'undefined') {
  window.INULIN_FLOWCHART = INULIN_FLOWCHART;
}