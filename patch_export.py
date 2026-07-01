import sys

with open('js/results.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the exportToWord function start and end
start = content.find('  function exportToWord() {')
end = content.find('\n  return { init };')

if start < 0 or end < 0:
    print(f'ERROR: start={start}, end={end}')
    sys.exit(1)

# Also find the old "return { init }" that was already replaced
# The new one should be after exportToWord
return_line = content.rfind('  return { init };')
if return_line < start:
    print('ERROR: return before exportToWord')
    sys.exit(1)

new_func = '''  function exportToWord() {
    var pfData = {};
    try { var pfRaw = localStorage.getItem('haccp_profile_data'); if (pfRaw) pfData = JSON.parse(pfRaw); } catch(e) {}
    var q15Data = Results_load15minData() || {};

    // 合并数据
    var data = {};
    var pfKeys = ['companyName','deptName','auditor','haccpTeam','extraItems',
      'pd_rawProps','pd_rawSupply','pd_rawUsage','pd_productProps','pd_productProcess','pd_productStorage','pd_productSales',
      'productExtraItems','iu_consumerExpect','iu_intendedUse','iu_consumptionMethod','iu_targetCustomer','iu_vulnerableGroups',
      'iu_unintendedUse','iuExtraItems'];
    pfKeys.forEach(function(k) {
      if (pfData[k] !== undefined && pfData[k] !== '' && pfData[k] !== null &&
          !(Array.isArray(pfData[k]) && pfData[k].length === 0)) { data[k] = pfData[k]; }
    });
    Object.keys(q15Data).forEach(function(k) { if (data[k] === undefined) data[k] = q15Data[k]; });
    if (!data.companyName && q15Data.companyName) data.companyName = q15Data.companyName;
    if (!data.deptName && q15Data.deptName) data.deptName = q15Data.deptName;

    // 辅助函数
    var esc = function(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    var td = function(v) {
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim()) ||
          (Array.isArray(v) && v.length === 0)) {
        return '<td style="color:#999;font-style:italic;">（未填写）</td>';
      }
      return '<td>' + esc(String(v)) + '</td>';
    };
    var boolYes = function(v) { return v ? '&#10003; 是' : '&#10007; 否'; };
    var emptyCell = function(text) {
      return '<td colspan="5" style="color:#6b7280;font-style:italic;text-align:center;">' + esc(text || '') + '</td>';
    };

    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // Word 文档头部
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]--><style>@page{size:A4;margin:2cm 2.5cm 2cm 2.5cm;mso-header-margin:1.5cm;mso-footer-margin:1.25cm}body{font-family:"宋体",SimSun,serif;font-size:12pt;line-height:1.8;color:#333}h1{font-family:"黑体",SimHei,sans-serif;font-size:18pt;text-align:center;color:#1e3a5f;margin-bottom:8pt;border-bottom:2px solid #1e3a5f;padding-bottom:8pt}h2{font-family:"黑体",SimHei,sans-serif;font-size:14pt;color:#1e40af;margin-top:20pt;margin-bottom:10pt;border-left:4px solid #1e40af;padding-left:8pt}h3{font-family:"黑体",SimHei,sans-serif;font-size:12pt;color:#374151;margin-top:14pt;margin-bottom:8pt}table{width:100%;border-collapse:collapse;margin-bottom:12pt}th{background-color:#1e3a5f;color:#fff;font-size:10.5pt;padding:6pt 8pt;border:1px solid #1e3a5f;text-align:center}td{font-size:10.5pt;padding:5pt 8pt;border:1px solid #999;word-break:break-all}.info-table td:first-child{width:200pt;background-color:#f0f4ff;font-weight:bold}.meta{text-align:right;font-size:10pt;color:#666;margin-bottom:16pt}</style></head><body>' +
      '<h1>HACCP 产品档案</h1><p class="meta">导出日期：' + dateStr + ' | 企业名称：' + esc(data.companyName || '（未填写）') + '</p>';

    // ==================== 一、HACCP小组的组成 ====================
    html += '<h2>一、HACCP小组的组成</h2>';
    html += '<table class="info-table"><tr><td>企业名称</td>' + td(data.companyName) + '</tr><tr><td>制定部门</td>' + td(data.deptName) + '</tr><tr><td>审核人员</td>' + td(data.auditor) + '</tr></table>';
    var ex1 = (data.extraItems || []).filter(function(e) { return e.key || e.value; });
    if (ex1.length > 0) {
      html += '<h3>其他项目</h3><table><thead><tr><th>项目名称</th><th>项目内容</th></tr></thead><tbody>';
      ex1.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }
    html += '<h3>HACCP小组成员</h3><table><thead><tr><th>姓名</th><th>部门</th><th>职责</th><th>权限</th><th>备注</th></tr></thead><tbody>';
    var team = data.haccpTeam || [];
    var teamHtml = '';
    team.forEach(function(m) { teamHtml += '<tr>' + td(m.name) + td(m.dept) + td(m.role) + td(m.authority) + td(m.remark) + '</tr>'; });
    html += (teamHtml || '<tr><td colspan="5" style="color:#999;font-style:italic;text-align:center;">暂无成员信息</td></tr>') + '</tbody></table>';

    // ==================== 二、产品描述 ====================
    html += '<h2 style="page-break-before:always;">二、产品描述</h2>';
    html += '<table class="info-table"><tbody>';
    [
      ['pd_rawProps','原辅料、食品包装材料的名称、类别、成分及其生物、化学和物理特性'],
      ['pd_rawSupply','原辅料、食品包装材料的来源，以及生产、包装、储藏、运输和交付方式'],
      ['pd_rawUsage','原辅料、食品包装材料接收要求、接收方式和使用方式'],
      ['pd_productProps','产品的名称、类别、成分及其生物、化学、物理特性'],
      ['pd_productProcess','产品的加工方式'],
      ['pd_productStorage','产品的包装、储藏、运输和交付方式'],
      ['pd_productSales','产品的销售方式和标识']
    ].forEach(function(f) { html += '<tr><td>' + esc(f[1]) + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</tbody></table>';
    var pe = (data.productExtraItems || []).filter(function(e) { return e.key || e.value; });
    if (pe.length > 0) {
      html += '<h3>其他必要信息</h3><table><thead><tr><th>项目名称</th><th>项目内容</th></tr></thead><tbody>';
      pe.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ==================== 三、预期用途的确定 ====================
    html += '<h2 style="page-break-before:always;">三、预期用途的确定</h2>';
    html += '<table class="info-table"><tbody>';
    [
      ['iu_consumerExpect','顾客对产品的消费或使用期望'],
      ['iu_intendedUse','产品的预期用途和储藏条件，以及保质期'],
      ['iu_consumptionMethod','产品预期的食用或使用方式'],
      ['iu_targetCustomer','产品预期的顾客对象'],
      ['iu_vulnerableGroups','直接消费产品对易受伤害群体的适用性'],
      ['iu_unintendedUse','产品非预期(但极可能出现)的食用或使用方式']
    ].forEach(function(f) { html += '<tr><td>' + esc(f[1]) + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</tbody></table>';
    var iue = (data.iuExtraItems || []).filter(function(e) { return e.key || e.value; });
    if (iue.length > 0) {
      html += '<h3>其他必要信息</h3><table><thead><tr><th>项目名称</th><th>项目内容</th></tr></thead><tbody>';
      iue.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ==================== 四、产品与生产流程 ====================
    html += '<h2 style="page-break-before:always;">四、产品与生产流程</h2>';
    html += '<h3>产品基本信息</h3><table class="info-table">';
    [
      ['productName','产品名称'],['rawMaterials','主要原料'],['additives','添加剂'],
      ['productPH','产品PH值'],['waterActivity','水分活度'],['intendedUse','预期用途'],
      ['storageCondition','储存条件'],['packagingMethod','包装方式'],['targetConsumer','目标消费者'],
      ['shelfLife','保质期']
    ].forEach(function(f) { html += '<tr><td>' + esc(f[1]) + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</table>';

    // 配方
    var formula = (data.formula || []).filter(function(f) { return f.material || f.dosage || f.func; });
    if (formula.length > 0) {
      html += '<h3>配方</h3><table><thead><tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th></tr></thead><tbody>';
      formula.forEach(function(f) { html += '<tr>' + td(f.material) + td(f.dosage) + td(f.func) + '</tr>'; });
      html += '</tbody></table>';
    }

    // 操作步骤
    var steps = data.processSteps || [];
    var stepsHtml = '';
    steps.forEach(function(s, i) {
      if (!s.stepName || !s.stepName.trim()) return;
      stepsHtml += '<tr><td style="text-align:center;">' + (i+1) + '</td>' + td(s.stepName) + td(s.operationMethod) + td(s.parameters) + td(s.controlPoint) + td(s.equipmentName) + '</tr>';
    });
    if (stepsHtml) {
      html += '<h3>生产操作步骤</h3><table><thead><tr><th style="width:40px;">序号</th><th>步骤名称</th><th>操作方法</th><th>工艺参数</th><th>控制点</th><th>设备名称</th></tr></thead><tbody>' + stepsHtml + '</tbody></table>';
    }
    html += '<table class="info-table"><tr><td>流程图现场确认</td><td>' + boolYes(data.flowConfirmed) + '</td></tr></table>';

    // ==================== 五、CCP判定结果 ====================
    var ccpSteps = data.ccpSteps || [];
    if (ccpSteps.length > 0) {
      html += '<h2 style="page-break-before:always;">五、CCP判定结果</h2>';
      html += '<table><thead><tr><th>步骤</th><th>危害类型</th><th>危害描述</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q5</th><th>判定结果</th></tr></thead><tbody>';
      var htLabel = { bio: '生物危害', chem: '化学危害', phys: '物理危害' };
      ccpSteps.forEach(function(s, si) {
        if (!s.hazards) return;
        ['bio','chem','phys'].forEach(function(ht, hi) {
          var h = s.hazards[ht] || {};
          var r = '';
          if (h.isCCP === true) r = '<span style="color:#dc2626;font-weight:bold;">CCP</span>';
          else if (h.isCCP === false) r = '<span style="color:#16a34a;">非CCP</span>';
          else if (h.isCCP === 'modify') r = '<span style="color:#d97706;">需修改</span>';
          else r = '未判定';
          html += '<tr>';
          if (hi === 0) html += '<td rowspan="3" style="vertical-align:middle;font-weight:500;">' + esc(s.stepName || ('步骤'+(si+1))) + '</td>';
          html += '<td>' + htLabel[ht] + '</td><td style="font-size:10pt;">' + esc(h.hazardDesc || '') + '</td>';
          html += '<td style="text-align:center;">' + (h.q1||'—') + '</td><td style="text-align:center;">' + (h.q2||'—') + '</td><td style="text-align:center;">' + (h.q3||'—') + '</td><td style="text-align:center;">' + (h.q4||'—') + '</td><td style="text-align:center;">' + (h.q5||'—') + '</td>';
          html += '<td style="text-align:center;">' + r + '</td></tr>';
        });
      });
      html += '</tbody></table>';
    }

    // ==================== 六、危害分析（按材料/步骤分组，每种材料列出生物+化学+物理三类危害）====================
    html += '<h2 style="page-break-before:always;">六、危害分析</h2>';
    var hazDone = false;

    // --- 6a. 新版格式（hazardWorksheet: 按步骤分组，每步骤有 bio/chem/phys 三类危害）---
    var hw = data.hazardWorksheet || [];
    if (hw.length > 0) {
      hazDone = true;
      html += '<h3>危害分析工作单</h3>';
      html += '<table><thead><tr><th style="width:80px;">加工步骤</th><th style="width:70px;">危害类型</th><th>潜在危害描述</th><th style="width:50px;">严重性</th><th style="width:50px;">可能性</th><th style="width:60px;">显著危害</th><th>控制措施</th></tr></thead><tbody>';
      hw.forEach(function(ws) {
        var sn = ws.stepName || '';
        var hz = ws.hazards || [];
        // 按类型分组：bio → 生物危害, chem → 化学危害, phys → 物理危害
        var groups = { '生物危害': [], '化学危害': [], '物理危害': [] };
        hz.forEach(function(h) {
          var c = h.hazardType || h.category || '';
          if (c === '生物危害' || c === 'biological') groups['生物危害'].push(h);
          else if (c === '化学危害' || c === 'chemical') groups['化学危害'].push(h);
          else if (c === '物理危害' || c === 'physical') groups['物理危害'].push(h);
        });
        // 三行：生物/化学/物理（有可能某类有多条）
        var rowData = [];
        ['生物危害','化学危害','物理危害'].forEach(function(t) {
          var items = groups[t];
          if (items && items.length > 0) {
            items.forEach(function(h) { rowData.push({ type: t, h: h }); });
          } else {
            rowData.push({ type: t, h: null });
          }
        });
        rowData.forEach(function(rd, ri) {
          html += '<tr>';
          if (ri === 0) html += '<td rowspan="' + rowData.length + '" style="vertical-align:middle;font-weight:500;">' + esc(sn || '（未命名）') + '</td>';
          var tc = rd.type === '生物危害' ? '#dc2626' : (rd.type === '化学危害' ? '#d97706' : '#2563eb');
          html += '<td style="color:' + tc + ';font-weight:500;">' + rd.type + '</td>';
          if (rd.h) {
            html += td(rd.h.hazardDesc) + td(rd.h.severity) + td(rd.h.likelihood);
            html += '<td style="text-align:center;">' + (rd.h.isSignificant ? '<span style="color:#dc2626;font-weight:bold;">&#10003; 是</span>' : '—') + '</td>';
            html += td(rd.h.controlMeasure || rd.h.control);
          } else {
            html += '<td colspan="4" style="color:#6b7280;font-style:italic;">无显著' + rd.type + '</td>';
          }
          html += '</tr>';
        });
      });
      html += '</tbody></table>';
    }

    // --- 6b. 旧版格式兼容（hazardBio/Chem/Phys 含 material 字段）---
    if (!hazDone) {
      var bio = data.hazardBio || [];
      var chem = data.hazardChem || [];
      var phys = data.hazardPhys || [];
      // 按 material 字段分组
      var matMap = {};
      bio.forEach(function(h) {
        var m = h.material || '未指定材料';
        if (!matMap[m]) matMap[m] = { bioH: null, chemH: null, physH: null };
        matMap[m].bioH = h;
      });
      chem.forEach(function(h) {
        var m = h.material || '未指定材料';
        if (!matMap[m]) matMap[m] = { bioH: null, chemH: null, physH: null };
        matMap[m].chemH = h;
      });
      phys.forEach(function(h) {
        var m = h.material || '未指定材料';
        if (!matMap[m]) matMap[m] = { bioH: null, chemH: null, physH: null };
        matMap[m].physH = h;
      });
      var mats = Object.keys(matMap);
      if (mats.length > 0) {
        hazDone = true;
        html += '<h3>危害分析（按材料分组）</h3>';
        html += '<table><thead><tr><th style="width:90px;">材料</th><th style="width:70px;">危害类型</th><th>危害描述</th><th style="width:50px;">严重性</th><th style="width:50px;">可能性</th><th>控制措施</th></tr></thead><tbody>';
        mats.forEach(function(mat) {
          var g = matMap[mat];
          [
            { type: '生物危害', color: '#dc2626', h: g.bioH },
            { type: '化学危害', color: '#d97706', h: g.chemH },
            { type: '物理危害', color: '#2563eb', h: g.physH }
          ].forEach(function(r, ri) {
            html += '<tr>';
            if (ri === 0) html += '<td rowspan="3" style="vertical-align:middle;font-weight:500;">' + esc(mat) + '</td>';
            html += '<td style="color:' + r.color + ';font-weight:500;">' + r.type + '</td>';
            if (r.h) {
              html += td(r.h.desc || r.h.detail) + td(r.h.severity) + td(r.h.likelihood) + td(r.h.control);
            } else {
              html += '<td colspan="3" style="color:#6b7280;font-style:italic;">无显著' + r.type + '</td>';
            }
            html += '</tr>';
          });
        });
        html += '</tbody></table>';
      }
    }
    if (!hazDone) {
      html += '<p style="color:#999;font-style:italic;">暂未填写危害分析信息</p>';
    }
    html += '<table class="info-table"><tr><td>团队确认</td><td>' + boolYes(data.hazardConfirmed) + '</td></tr></table>';

    // ==================== 七、关键限制与监控 ====================
    html += '<h2 style="page-break-before:always;">七、关键限制与监控</h2>';
    var sl = { gb:'国标（GB）', industry:'行业标准', enterprise:'企业标准', international:'国际标准' };
    html += '<table class="info-table"><tr><td>执行标准</td>' + td(sl[data.execStandard] || data.execStandard) + '</tr><tr><td>关键限制说明</td>' + td(data.criticalLimits) + '</tr></table>';
    var mon = (data.monitoring || []).filter(function(m) { return m.ccp || m.object || m.method; });
    if (mon.length > 0) {
      html += '<h3>监控程序设置</h3><table><thead><tr><th>CCP</th><th>监控对象</th><th>监控方法</th><th>监控频率</th><th>监控人员</th><th>备注</th></tr></thead><tbody>';
      mon.forEach(function(m) { html += '<tr>' + td(m.ccp) + td(m.object) + td(m.method) + td(m.frequency) + td(m.personnel) + td(m.remark) + '</tr>'; });
      html += '</tbody></table>';
    }
    var ca = (data.correctiveActions || []).filter(function(c) { return c.ccp || c.cl || c.corrective; });
    if (ca.length > 0) {
      html += '<h3>纠偏措施</h3><table><thead><tr><th>CCP</th><th>关键限值(CL)</th><th>纠偏措施</th><th>验证</th><th>记录</th></tr></thead><tbody>';
      ca.forEach(function(c) { html += '<tr>' + td(c.ccp) + td(c.cl) + td(c.corrective) + td(c.verification) + td(c.record) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ==================== 八、记录与报表 ====================
    html += '<h2 style="page-break-before:always;">八、记录与报表</h2>';
    html += '<table class="info-table"><tr><td>记录保存期限</td>' + td(data.recordPeriod) + '</tr><tr><td>记录格式要求</td>' + td(data.recordFormat) + '</tr></table>';
    html += '<p style="text-align:center;color:#999;font-size:9pt;margin-top:30pt;">—— 本文件由 HACCP AI 助手自动生成 ——</p></body></html>';

    // 触发下载
    var blob = new Blob(['﻿' + html], { type: 'application/msword;charset=UTF-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'HACCP产品档案_' + (data.companyName || '未命名') + '_' + dateStr + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }'''

# Replace: old exportToWord function with new one
old_start = content.find('  function exportToWord() {')
old_end = content.find('\n  return { init };')
# Get the return line
return_line_start = content.rfind('\n  return { init };')

if old_start >= 0 and return_line_start > old_start:
    # Keep everything before exportToWord, replace the function, keep the return {init};
    before = content[:old_start]
    after = content[return_line_start:]
    content = before + new_func + '\n' + after
    print('Replaced exportToWord function')
else:
    print(f'ERROR: old_start={old_start}, return_line_start={return_line_start}')
    sys.exit(1)

# Also need to expose load15minData to the export function
# The exportToWord function is inside the Results IIFE, so it can access load15minData.
# But load15minData is a local function. We need to make it accessible.
# Actually, since exportToWord is INSIDE the same IIFE, it has access to load15minData via closure.
# But the code uses `Results_load15minData()` which doesn't exist.
# Let me fix: just use `load15minData()` directly since it's in the same closure.

content = content.replace('var q15Data = Results_load15minData() || {};', 'var q15Data = load15minData() || {};')

# Brace check
o = content.count('{')
c = content.count('}')
print(f'Braces: { {o} } = { {c} }, diff = {o - c}')

with open('js/results.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
