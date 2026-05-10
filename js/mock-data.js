// 模拟 HACCP 计划数据 — 双语版
const mockHaccpPlan = {
  productDescription: {
    title: { zh: '产品描述', en: 'Product Description' },
    content: {
      zh: `
        <p>本 HACCP 计划基于您在问卷中提交的产品信息生成。产品基本信息已在问卷中详细记录，后续接入 AI 后将自动生成完整的产品描述。</p>
        <h3>HACCP 计划概述</h3>
        <p>本计划涵盖从原料采购到成品运输的全过程，识别并控制了生产过程中的生物性、化学性和物理性危害，确定了关键控制点（CCP），建立了监控、纠偏和验证程序。</p>
      `,
      en: `
        <p>This HACCP plan is generated based on the product information you submitted in the questionnaire. Product details have been recorded and will be used by AI to generate a complete product description upon integration.</p>
        <h3>HACCP Plan Overview</h3>
        <p>This plan covers the entire process from raw material procurement to finished product transportation. It identifies and controls biological, chemical, and physical hazards throughout production, establishes Critical Control Points (CCPs), and sets up monitoring, corrective action, and verification procedures.</p>
      `
    }
  },
  hazardAnalysis: {
    title: { zh: '危害分析', en: 'Hazard Analysis' },
    content: {
      zh: `
        <p>根据工艺流程，我们对每个步骤进行了危害分析，识别潜在的生物性、化学性和物理性危害。</p>
        <h3>危害分析工作表</h3>
        <table>
          <thead><tr><th>工艺步骤</th><th>潜在危害</th><th>危害类别</th><th>风险等级</th><th>控制措施</th></tr></thead>
          <tbody>
            <tr><td>原料验收</td><td>致病菌污染、农药残留</td><td>生物性/化学性</td><td>高</td><td>供应商审核、索取检验报告、进货检验</td></tr>
            <tr><td>原料贮存</td><td>微生物繁殖</td><td>生物性</td><td>中</td><td>控制贮存温度、先进先出管理</td></tr>
            <tr><td>热处理</td><td>致病菌残存</td><td>生物性</td><td>高</td><td>控制温度和时间参数（CCP）</td></tr>
            <tr><td>冷却</td><td>微生物繁殖</td><td>生物性</td><td>中</td><td>快速冷却、控制冷却时间</td></tr>
            <tr><td>包装</td><td>异物混入</td><td>物理性</td><td>低</td><td>金属检测、目视检查</td></tr>
            <tr><td>金属检测</td><td>金属异物</td><td>物理性</td><td>高</td><td>金属探测器、标准测试块校准（CCP）</td></tr>
            <tr><td>成品贮存</td><td>微生物繁殖</td><td>生物性</td><td>低</td><td>控制贮存温度、定期检查</td></tr>
            <tr><td>运输</td><td>温度波动导致变质</td><td>生物性</td><td>中</td><td>冷链运输、温度记录仪</td></tr>
          </tbody>
        </table>
      `,
      en: `
        <p>Based on the process flow, we analyzed each step to identify potential biological, chemical, and physical hazards.</p>
        <h3>Hazard Analysis Worksheet</h3>
        <table>
          <thead><tr><th>Process Step</th><th>Potential Hazard</th><th>Category</th><th>Risk Level</th><th>Control Measure</th></tr></thead>
          <tbody>
            <tr><td>Receiving</td><td>Pathogens, pesticide residues</td><td>Biological/Chemical</td><td>High</td><td>Supplier audit, COA verification, incoming inspection</td></tr>
            <tr><td>Storage</td><td>Microbial growth</td><td>Biological</td><td>Medium</td><td>Temperature control, FIFO management</td></tr>
            <tr><td>Thermal Processing</td><td>Pathogen survival</td><td>Biological</td><td>High</td><td>Control temperature and time (CCP)</td></tr>
            <tr><td>Cooling</td><td>Microbial growth</td><td>Biological</td><td>Medium</td><td>Rapid cooling, control cooling time</td></tr>
            <tr><td>Packaging</td><td>Foreign material</td><td>Physical</td><td>Low</td><td>Metal detection, visual inspection</td></tr>
            <tr><td>Metal Detection</td><td>Metal fragments</td><td>Physical</td><td>High</td><td>Metal detector, test piece calibration (CCP)</td></tr>
            <tr><td>Finished Product Storage</td><td>Microbial growth</td><td>Biological</td><td>Low</td><td>Temperature control, periodic inspection</td></tr>
            <tr><td>Transportation</td><td>Temperature abuse</td><td>Biological</td><td>Medium</td><td>Cold chain, temperature data logger</td></tr>
          </tbody>
        </table>
      `
    }
  },
  ccp: {
    title: { zh: '关键控制点（CCP）', en: 'Critical Control Points (CCP)' },
    content: {
      zh: `
        <p>通过判断树分析，确定了以下关键控制点（CCP）：</p>
        <h3>CCP 判定结果</h3>
        <table>
          <thead><tr><th>CCP 编号</th><th>工艺步骤</th><th>显著危害</th><th>判定依据</th></tr></thead>
          <tbody>
            <tr><td>CCP-1</td><td>原料验收</td><td>致病菌、农药残留</td><td>后续工序无法消除该危害，必须在此步骤控制</td></tr>
            <tr><td>CCP-2</td><td>热处理</td><td>致病菌残存</td><td>此步骤专门设计用于消除致病菌，后续无杀菌工序</td></tr>
            <tr><td>CCP-3</td><td>金属检测</td><td>金属异物</td><td>后续无去除金属异物的工序</td></tr>
          </tbody>
        </table>
      `,
      en: `
        <p>Using decision tree analysis, the following Critical Control Points (CCPs) were identified:</p>
        <h3>CCP Determination</h3>
        <table>
          <thead><tr><th>CCP No.</th><th>Process Step</th><th>Significant Hazard</th><th>Justification</th></tr></thead>
          <tbody>
            <tr><td>CCP-1</td><td>Receiving</td><td>Pathogens, pesticide residues</td><td>Subsequent steps cannot eliminate this hazard; must be controlled here</td></tr>
            <tr><td>CCP-2</td><td>Thermal Processing</td><td>Pathogen survival</td><td>This step is specifically designed to eliminate pathogens; no subsequent sterilization</td></tr>
            <tr><td>CCP-3</td><td>Metal Detection</td><td>Metal fragments</td><td>No subsequent step can remove metal fragments</td></tr>
          </tbody>
        </table>
      `
    }
  },
  criticalLimits: {
    title: { zh: '关键限值', en: 'Critical Limits' },
    content: {
      zh: `
        <p>为每个 CCP 设定可测量的关键限值：</p>
        <h3>关键限值表</h3>
        <table>
          <thead><tr><th>CCP</th><th>关键限值</th><th>来源/依据</th></tr></thead>
          <tbody>
            <tr><td>CCP-1 原料验收</td><td>每批原料附有合格检验报告；供应商在合格名录内</td><td>企业标准 / GB 标准</td></tr>
            <tr><td>CCP-2 热处理</td><td>中心温度 ≥ 72°C，持续时间 ≥ 15 秒</td><td>《食品卫生通则》 / 巴氏杀菌标准</td></tr>
            <tr><td>CCP-3 金属检测</td><td>Fe ≤ 1.5mm，SUS ≤ 2.5mm 的测试块均被检测并剔除</td><td>行业标准 / 设备规格</td></tr>
          </tbody>
        </table>
      `,
      en: `
        <p>Establish measurable critical limits for each CCP:</p>
        <h3>Critical Limits Table</h3>
        <table>
          <thead><tr><th>CCP</th><th>Critical Limit</th><th>Source/Basis</th></tr></thead>
          <tbody>
            <tr><td>CCP-1 Receiving</td><td>Each batch must have a valid COA; supplier must be on approved list</td><td>Company standard / National standard</td></tr>
            <tr><td>CCP-2 Thermal Processing</td><td>Core temperature ≥ 72°C, hold time ≥ 15 seconds</td><td>Codex General Principles / Pasteurization standard</td></tr>
            <tr><td>CCP-3 Metal Detection</td><td>Test pieces Fe ≤ 1.5mm, SUS ≤ 2.5mm must be detected and rejected</td><td>Industry standard / Equipment specification</td></tr>
          </tbody>
        </table>
      `
    }
  },
  monitoring: {
    title: { zh: '监控程序', en: 'Monitoring Procedures' },
    content: {
      zh: `
        <p>针对每个 CCP 的监控方案：</p>
        <h3>监控程序表</h3>
        <table>
          <thead><tr><th>CCP</th><th>监控对象</th><th>监控方法</th><th>监控频率</th><th>监控人员</th></tr></thead>
          <tbody>
            <tr><td>CCP-1 原料验收</td><td>检验报告、供应商资质</td><td>查验文件</td><td>每批</td><td>品控员</td></tr>
            <tr><td>CCP-2 热处理</td><td>温度、时间</td><td>温度计/计时器</td><td>连续监控</td><td>操作工</td></tr>
            <tr><td>CCP-3 金属检测</td><td>金属检测仪灵敏度</td><td>标准测试块</td><td>生产前/中/后各一次，每小时一次</td><td>操作工</td></tr>
          </tbody>
        </table>
      `,
      en: `
        <p>Monitoring plan for each CCP:</p>
        <h3>Monitoring Procedures Table</h3>
        <table>
          <thead><tr><th>CCP</th><th>Monitoring Target</th><th>Method</th><th>Frequency</th><th>Responsible Person</th></tr></thead>
          <tbody>
            <tr><td>CCP-1 Receiving</td><td>COA, supplier qualification</td><td>Document review</td><td>Each batch</td><td>QC Inspector</td></tr>
            <tr><td>CCP-2 Thermal Processing</td><td>Temperature, time</td><td>Thermometer / Timer</td><td>Continuous</td><td>Operator</td></tr>
            <tr><td>CCP-3 Metal Detection</td><td>Detector sensitivity</td><td>Standard test pieces</td><td>Start/mid/end of production + hourly</td><td>Operator</td></tr>
          </tbody>
        </table>
      `
    }
  },
  correctiveActions: {
    title: { zh: '纠正措施', en: 'Corrective Actions' },
    content: {
      zh: `
        <p>当监控发现 CCP 偏离关键限值时，应采取以下纠正措施：</p>
        <h3>纠正措施表</h3>
        <table>
          <thead><tr><th>CCP</th><th>偏离情况</th><th>纠正措施</th><th>责任人</th></tr></thead>
          <tbody>
            <tr><td>CCP-1 原料验收</td><td>原料无合格报告或供应商不在名录</td><td>拒收该批原料；标记并隔离；通知采购部门</td><td>品控主管</td></tr>
            <tr><td>CCP-2 热处理</td><td>温度或时间低于关键限值</td><td>立即调整设备参数；受影响产品隔离评估；对设备进行检修</td><td>生产主管</td></tr>
            <tr><td>CCP-3 金属检测</td><td>测试块未被检测出</td><td>停止生产；自上次合格测试以来的产品重新检测；校准或维修设备</td><td>品控主管</td></tr>
          </tbody>
        </table>
      `,
      en: `
        <p>When monitoring detects a deviation from critical limits at a CCP, the following corrective actions shall be taken:</p>
        <h3>Corrective Actions Table</h3>
        <table>
          <thead><tr><th>CCP</th><th>Deviation</th><th>Corrective Action</th><th>Responsible Person</th></tr></thead>
          <tbody>
            <tr><td>CCP-1 Receiving</td><td>No valid COA or supplier not on approved list</td><td>Reject the batch; tag and isolate; notify procurement</td><td>QC Supervisor</td></tr>
            <tr><td>CCP-2 Thermal Processing</td><td>Temperature or time below critical limit</td><td>Adjust equipment immediately; isolate and evaluate affected product; inspect equipment</td><td>Production Supervisor</td></tr>
            <tr><td>CCP-3 Metal Detection</td><td>Test piece not detected</td><td>Stop production; re-inspect all products since last valid test; calibrate or repair equipment</td><td>QC Supervisor</td></tr>
          </tbody>
        </table>
      `
    }
  },
  verification: {
    title: { zh: '验证程序', en: 'Verification Procedures' },
    content: {
      zh: `
        <p>为确保 HACCP 体系有效运行，需定期进行验证：</p>
        <h3>验证活动</h3>
        <table>
          <thead><tr><th>验证项目</th><th>验证方法</th><th>频率</th><th>责任人</th></tr></thead>
          <tbody>
            <tr><td>CCP 记录审核</td><td>检查监控记录是否完整、正确</td><td>每周</td><td>品控主管</td></tr>
            <tr><td>监控设备校准</td><td>使用标准方法校准温度计、金属检测仪等</td><td>每月 / 按计划</td><td>设备部门</td></tr>
            <tr><td>HACCP 计划复审</td><td>评审计划是否仍然适用，是否需要更新</td><td>每年 / 工艺变更时</td><td>HACCP 小组</td></tr>
            <tr><td>成品检验</td><td>微生物检测、理化检测</td><td>每批</td><td>实验室</td></tr>
            <tr><td>内部审核</td><td>按审核计划检查体系运行的符合性</td><td>每半年</td><td>内审员</td></tr>
          </tbody>
        </table>
      `,
      en: `
        <p>To ensure the HACCP system operates effectively, regular verification is required:</p>
        <h3>Verification Activities</h3>
        <table>
          <thead><tr><th>Verification Item</th><th>Method</th><th>Frequency</th><th>Responsible Person</th></tr></thead>
          <tbody>
            <tr><td>CCP Record Review</td><td>Check monitoring records for completeness and accuracy</td><td>Weekly</td><td>QC Supervisor</td></tr>
            <tr><td>Equipment Calibration</td><td>Calibrate thermometers, metal detectors, etc. using standard methods</td><td>Monthly / Per schedule</td><td>Maintenance Dept.</td></tr>
            <tr><td>HACCP Plan Reassessment</td><td>Review whether the plan remains applicable and needs updating</td><td>Annually / When process changes</td><td>HACCP Team</td></tr>
            <tr><td>Finished Product Testing</td><td>Microbiological and chemical testing</td><td>Each batch</td><td>Laboratory</td></tr>
            <tr><td>Internal Audit</td><td>Audit system compliance per audit plan</td><td>Semi-annually</td><td>Internal Auditor</td></tr>
          </tbody>
        </table>
      `
    }
  },
  recordKeeping: {
    title: { zh: '记录保存', en: 'Record Keeping' },
    content: {
      zh: `
        <p>HACCP 体系运行过程中需保存以下记录：</p>
        <h3>记录清单</h3>
        <table>
          <thead><tr><th>记录名称</th><th>内容</th><th>保存期限</th><th>保管部门</th></tr></thead>
          <tbody>
            <tr><td>原料验收记录</td><td>日期、供应商、批次号、检验结果、判定</td><td>2 年</td><td>品控部</td></tr>
            <tr><td>CCP 监控记录</td><td>CCP编号、时间、监测值、记录人</td><td>2 年</td><td>生产部</td></tr>
            <tr><td>纠偏行动记录</td><td>偏离描述、纠偏措施、受影响产品处理</td><td>2 年</td><td>品控部</td></tr>
            <tr><td>设备校准记录</td><td>设备名称、校准日期、校准结果</td><td>2 年</td><td>设备部</td></tr>
            <tr><td>验证记录</td><td>验证项目、结果、审核人</td><td>3 年</td><td>品控部</td></tr>
            <tr><td>HACCP 计划审批记录</td><td>版本号、修订内容、审批人、日期</td><td>永久</td><td>品控部</td></tr>
          </tbody>
        </table>
      `,
      en: `
        <p>The following records must be maintained during HACCP system operation:</p>
        <h3>Record List</h3>
        <table>
          <thead><tr><th>Record Name</th><th>Content</th><th>Retention</th><th>Department</th></tr></thead>
          <tbody>
            <tr><td>Receiving Records</td><td>Date, supplier, batch no., test results, disposition</td><td>2 years</td><td>QC Dept.</td></tr>
            <tr><td>CCP Monitoring Records</td><td>CCP no., time, measured value, recorder</td><td>2 years</td><td>Production Dept.</td></tr>
            <tr><td>Corrective Action Records</td><td>Deviation description, corrective action, affected product disposition</td><td>2 years</td><td>QC Dept.</td></tr>
            <tr><td>Calibration Records</td><td>Equipment name, calibration date, results</td><td>2 years</td><td>Maintenance Dept.</td></tr>
            <tr><td>Verification Records</td><td>Verification item, results, reviewer</td><td>3 years</td><td>QC Dept.</td></tr>
            <tr><td>HACCP Plan Approval Records</td><td>Version, revision notes, approver, date</td><td>Permanent</td><td>QC Dept.</td></tr>
          </tbody>
        </table>
      `
    }
  }
};

// 章节顺序
const sectionOrder = [
  'productDescription',
  'hazardAnalysis',
  'ccp',
  'criticalLimits',
  'monitoring',
  'correctiveActions',
  'verification',
  'recordKeeping'
];
