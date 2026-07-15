/**
 * Inulin Production Process Flowchart - Mermaid Definition
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
  L1["1. 菊芋验收 (CQP-1)|||1. Jerusalem Artichoke Receiving (CQP-1)"]:::cqp
  L2["2. 清洗 (OPRP-1)|||2. Washing (OPRP-1)"]:::oprp
  L3["3. 粉碎 (OPRP-2)|||3. Crushing (OPRP-2)"]:::oprp
  L4["4. 匀浆|||4. Homogenization"]
  L5["5. 加热加压提取|||5. Heat & Pressure Extraction"]
  L6["6. 减压浓缩|||6. Vacuum Concentration"]
  L7["7. 一级膜过滤 (CCP-1)|||7. Primary Membrane Filtration (CCP-1)"]:::ccp
  L8["8. 脱色 (OPRP-3)|||8. Decolorization (OPRP-3)"]:::oprp

  %% 输入输出
  L2_sub["地下水 超声波清洗机 30min,40℃|||Groundwater, Ultrasonic Cleaner, 30min, 40℃"]:::io
  L2_waste["废水|||Wastewater"]:::io
  L3_sub["粉碎机/捣碎机 →5mm|||Crusher/Masher →5mm"]:::io
  L4_sub["纯净水 超声波(50~100W;40KHZ)12min|||Purified Water, Ultrasonic (50~100W;40KHz), 12min"]:::io
  L5_waste["废渣|||Waste Residue"]:::io
  L6_out["纯水|||Pure Water"]:::io
  L7_sub["搅拌机,絮凝沉淀,滤机|||Mixer, Flocculation, Filter"]:::io
  L7_out["蛋白质和纤维素|||Protein & Cellulose"]:::io
  L8_in["活性炭|||Activated Carbon"]:::io
  L8_out["废活性炭|||Spent Activated Carbon"]:::io

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
  L6 -.->|循环提取|||Recirculation Extraction| L5

  %% === 连接左右 ===
  L8 -->|菊粉溶液|||Inulin Solution| R1

  %% === 右侧流程（纯化与干燥） ===
  R1["9. 脱离子 (OPRP-4)|||9. Deionization (OPRP-4)"]:::oprp
  R2["10. 二级膜过滤 (CCP-2)|||10. Secondary Membrane Filtration (CCP-2)"]:::ccp
  R3["11. 醇降|||11. Alcohol Precipitation"]
  R4["12. 干燥 (CCP-3)|||12. Drying (CCP-3)"]:::ccp
  R5["13. 金属检测 (CCP-4)|||13. Metal Detection (CCP-4)"]:::ccp
  R6["14. 包装 (OPRP-5)|||14. Packaging (OPRP-5)"]:::oprp
  R7["15. 成品储存与运输|||15. Storage & Distribution"]

  %% 右侧标注
  R1_in["交换树脂|||Ion Exchange Resin"]:::io
  R1_out["饱和树脂|||Saturated Resin"]:::io
  R2_out["粗菊粉溶液|||Crude Inulin Solution"]:::io
  R3_in["乙醇|||Ethanol"]:::io
  R3_out["沉淀|||Precipitate"]:::io
  R4_sub["烘干设备 120-180℃|||Drying Equipment, 120-180℃"]:::io
  R5_out["不合格产品|||Non-conforming Product"]:::io

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
  R2 -.->|脱离子菊粉溶液|||Deionized Inulin Solution| R1
  `
};

// 挂载到 window 供 flowchart-viewer.js 使用
if (typeof window !== 'undefined') {
  window.INULIN_FLOWCHART = INULIN_FLOWCHART;
}