// 15分钟问卷 - 完整HACCP问卷填写模块
const Questionnaire15min = (() => {
  const STORAGE_KEY = 'haccp_15min_data';

  // 如果是通过 file:// 打开的，自动补全后端地址
  var API_HOST = '';
  if (window.location.protocol === 'file:') {
    API_HOST = 'http://localhost:8000';
  }
  const SECTION_COMPLETED_KEY = 'haccp_15min_completed';

  function genId() { return 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>');
  }
  function getContainer() { return document.getElementById('questionnaireContainer'); }

  // ===== 数据管理 =====
  function getDefaultData() {
    return {
      companyName: '',
      deptName: '',
      haccpTeam: [{ id: genId(), name: '', dept: '', position: '', role: '', remark: '' }],
      auditor: '',
      extraItems: [],
      productExtraItems: [],
      productName: '',
      rawMaterials: '',
      additives: '',
      productPH: '',
      waterActivity: '',
      intendedUse: '',
      storageCondition: '',
      packagingMethod: '',
      targetConsumer: '',
      shelfLife: '',
      formula: [{ id: genId(), material: '', dosage: '', func: '' }],
      processSteps: [{ id: genId(), stepName: '', operationMethod: '', parameters: '', controlPoint: '', equipmentName: '' }],
      flowConfirmed: false,
      flowchartXml: '',
      hazardBio: [],
      hazardChem: [],
      hazardPhys: [],
      hazardConfirmed: false,
      ccpSteps: [],       // 存储每个步骤的CCP判定结果: { stepName, completed, hazards: { bio: { q1, q2_control, q2_need, q3, q4, q5, isCCP, hazardDesc }, chem: {...}, phys: {...} } }
      ccpStepIndex: 0,    // 当前正在判定的步骤索引
      ccpHazardType: 'bio', // 当前判定的危害类型: 'bio'|'chem'|'phys'
      ccpCurrentQ: 1,     // 当前问题编号: 1|2|3|4|5
      ccpCompleted: false,// 是否已全部完成
      execStandard: '',
      criticalLimits: '',
      monitoring: [{ id: genId(), ccp: '', object: '', method: '', frequency: '', personnel: '', remark: '' }],
      correctiveActions: [{ id: genId(), ccp: '', cl: '', corrective: '', verification: '', record: '' }],
      recordPeriod: '',
      recordFormat: '',
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const def = getDefaultData();
        Object.keys(def).forEach(k => {
          if (data[k] === undefined) data[k] = def[k];
        });
        return data;
      }
    } catch (e) { /* ignore */ }
    return getDefaultData();
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function isCompleted() {
    return localStorage.getItem(SECTION_COMPLETED_KEY) === 'true';
  }

  let _uploadedText = '';
  let _uploadedFileName = '';
  let _uploadedFileSize = 0;

  async function init() {
    const container = getContainer();
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>
      <div class="q15-header">
        <h1>15分钟快速问卷</h1>
        <p class="q15-desc">请按照产品实际情况填写以下信息，系统将根据您的输入生成HACCP计划</p>
        <div class="q15-progress" id="q15Progress"></div>
      </div>
      <div id="q15Content"></div>
    `;
    renderSectionNav();
    renderActiveSection();
  }

  // ==================== 文件上传区域 ====================
  function renderUploadArea() {
    const el = document.getElementById('q15UploadArea');
    if (!el) return;
    const hasFile = !!_uploadedText;
    el.innerHTML = `
      <div class="q15-upload-zone ${hasFile ? 'has-file' : ''}" id="q15UploadZone">
        <div class="q15-upload-zone-icon">${hasFile ? '\u{1F4C4}' : '\u{1F4C1}'}</div>
        <div class="q15-upload-zone-title">${hasFile ? '文件已解析' : '文件导入（可选）'}</div>
        <div class="q15-upload-zone-hint">${hasFile ? _uploadedFileName : '拖拽文件到此处，或点击选择文件'}</div>
        ${!hasFile ? '<div class="q15-upload-zone-hint" style="margin-top:4px;">支持 Word (.docx) / PDF (.pdf)</div>' : ''}
        <input type="file" id="q15FileInput" accept=".docx,.pdf" ${hasFile ? 'disabled' : ''}>
        ${!hasFile ? '<button class="q15-upload-btn" id="q15SelectFileBtn">\u{1F4C2} 选择文件</button>' : ''}
      </div>
      ${_uploadedText ? `
        <div class="q15-upload-file-info">
          <span class="q15-file-icon">\u{1F4C4}</span>
          <span class="q15-file-name">${esc(_uploadedFileName)}</span>
          <span class="q15-file-size">${formatFileSize(_uploadedFileSize)}</span>
          <span class="q15-file-status ok">\u2713 解析成功</span>
          <button class="btn btn-xs btn-secondary" id="q15ClearFileBtn">清除</button>
        </div>
        <div class="q15-upload-preview">${esc(_uploadedText.slice(0, 300))}${_uploadedText.length > 300 ? '...' : ''}</div>
        <div class="q15-upload-actions">
          <button class="btn btn-primary" id="q15AiFillBtn">\u{1F916} AI识别并填写问卷</button>
          <button class="btn btn-secondary" id="q15ClearFileBtn2">重新选择</button>
        </div>
      ` : ''}
      <div class="q15-upload-error" id="q15UploadError"></div>
    `;
    bindUploadEvents();
  }

  function bindUploadEvents() {
    const zone = document.getElementById('q15UploadZone');
    const fileInput = document.getElementById('q15FileInput');
    const selectBtn = document.getElementById('q15SelectFileBtn');
    if (selectBtn && fileInput) { selectBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); }); }
    if (fileInput) { fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); }); }
    if (zone) {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => { zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]); });
    }
    const clearBtn = document.getElementById('q15ClearFileBtn');
    const clearBtn2 = document.getElementById('q15ClearFileBtn2');
    if (clearBtn) clearBtn.addEventListener('click', clearUploadedFile);
    if (clearBtn2) clearBtn2.addEventListener('click', clearUploadedFile);
    const aiBtn = document.getElementById('q15AiFillBtn');
    if (aiBtn) aiBtn.addEventListener('click', handleAiFill);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showUploadError(msg) {
    const err = document.getElementById('q15UploadError');
    if (err) { err.textContent = msg; err.style.display = 'block'; }
  }

  function hideUploadError() {
    const err = document.getElementById('q15UploadError');
    if (err) err.style.display = 'none';
  }

  function clearUploadedFile() {
    _uploadedText = ''; _uploadedFileName = ''; _uploadedFileSize = 0;
    if (currentStep === 0) renderActiveSection();
  }

  async function handleFile(file) {
    hideUploadError();
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'docx' && ext !== 'pdf') { showUploadError('只支持 Word (.docx) 和 PDF (.pdf) 文件'); return; }
    if (file.size > 20 * 1024 * 1024) { showUploadError('文件大小不能超过 20MB'); return; }
    if (ext === 'docx' && typeof mammoth === 'undefined') { showUploadError('Word 解析库未加载。请检查网络连接后刷新页面重试。'); return; }
    if (ext === 'pdf' && (typeof pdfjsLib === 'undefined' || typeof pdfjsLib.getDocument !== 'function')) { showUploadError('PDF 解析库未加载。请检查网络连接后刷新页面重试。'); return; }
    _uploadedFileName = file.name; _uploadedFileSize = file.size;
    try {
      let text = '';
      if (ext === 'docx') text = await parseDocx(file);
      else if (ext === 'pdf') text = await parsePdf(file);
      if (!text.trim()) { showUploadError('未能从文件中提取到有效文本，请检查文件内容'); return; }
      _uploadedText = text; renderUploadArea();
    } catch (err) {
      showUploadError('文件解析失败：' + (err.message || '未知错误') + '。请尝试重新选择文件。');
    }
  }

  // ==================== DOCX 解析（保留表格结构） ====================
  async function parseDocx(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          let htmlResult = null;
          try { htmlResult = await mammoth.convertToHtml({ arrayBuffer }); } catch (htmlErr) {}
          if (htmlResult && htmlResult.value) {
            resolve(extractStructuredFromHtml(htmlResult.value));
          } else {
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve(result.value || '');
          }
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  function extractStructuredFromHtml(html) {
    if (!html) return '';
    var lines = [];
    var parser = new DOMParser();
    var doc = parser.parseFromString('<div id="root">' + html + '</div>', 'text/html');
    var root = doc.getElementById('root');
    if (!root) return html.replace(/<[^>]+>/g, ' ');
    function processNode(node) {
      if (!node) return;
      if (node.nodeType === 3) { var text = node.textContent.trim(); if (text) lines.push(text); return; }
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'table') { lines.push('__TABLE_START__'); var trs = node.querySelectorAll('tr'); if (trs.length === 0) { for (var i = 0; i < node.children.length; i++) { if (node.children[i].tagName && node.children[i].tagName.toLowerCase() === 'tr') processTableRow(node.children[i], lines); } } else { for (var i = 0; i < trs.length; i++) processTableRow(trs[i], lines); } lines.push('__TABLE_END__'); return; }
      if (tag.match(/^h[1-6]$/)) { var text = node.textContent.trim(); if (text) { lines.push('【' + text + '】'); } return; }
      if (tag === 'p' || tag === 'li' || tag === 'div' || tag === 'pre' || tag === 'blockquote') { for (var i = 0; i < node.childNodes.length; i++) processNode(node.childNodes[i]); var lastLine = lines[lines.length - 1]; if (lastLine && lastLine !== '' && !lastLine.startsWith('__TABLE_') && !lastLine.startsWith('【')) lines.push(''); return; }
      if (tag === 'br') { lines.push(''); return; }
      for (var i = 0; i < node.childNodes.length; i++) processNode(node.childNodes[i]);
    }
    function processTableRow(tr, lines) { var cells = []; var tds = tr.querySelectorAll('td, th'); if (tds.length === 0) { for (var i = 0; i < tr.children.length; i++) { var child = tr.children[i]; if (child.tagName && (child.tagName.toLowerCase() === 'td' || child.tagName.toLowerCase() === 'th')) cells.push(child.textContent.trim()); } } else { for (var i = 0; i < tds.length; i++) cells.push(tds[i].textContent.trim()); } lines.push(cells.join(' ||| ')); }
    processNode(root);
    return lines.filter(function(l) { return l !== undefined && l !== null; }).map(function(l) { return l.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/&#[0-9]+;/g, function(m) { return String.fromCharCode(parseInt(m.slice(2, -1))); }).replace(/&nbsp;/g, ' '); }).join('\n').replace(/\n{3,}/g, '\n\n');
  }

  // ==================== PDF 解析（保留布局结构） ====================
  async function parsePdf(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          var allText = '';
          for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            var page = await pdf.getPage(pageNum);
            var content = await page.getTextContent();
            var lineGroups = {};
            for (var i = 0; i < content.items.length; i++) {
              var item = content.items[i];
              var yKey = Math.round(item.transform[5] / 5) * 5;
              if (!lineGroups[yKey]) lineGroups[yKey] = [];
              lineGroups[yKey].push({ text: item.str, x: item.transform[4] });
            }
            var yKeys = Object.keys(lineGroups).sort(function(a, b) { return parseInt(b) - parseInt(a); });
            for (var j = 0; j < yKeys.length; j++) {
              var group = lineGroups[yKeys[j]];
              group.sort(function(a, b) { return a.x - b.x; });
              var line = group.map(function(g) { return g.text; }).join(' ').trim();
              if (line) allText += line + '\n';
            }
          }
          resolve(allText.trim());
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ========================= 智能文档解析引擎（适配HACCP计划书格式）=========================
  function detectTableRows(text) {
    if (!text) return [];
    var lines = text.split('\n');
    var tables = [];
    var currentTable = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('__TABLE_START__') !== -1) { currentTable = { rows: [], startLine: i }; continue; }
      if (line.indexOf('__TABLE_END__') !== -1) { if (currentTable) { tables.push(currentTable); currentTable = null; } continue; }
      if (currentTable && line.indexOf('|||') !== -1) { var cells = line.split('|||').map(function(c) { return c.trim(); }); if (cells.length >= 2) currentTable.rows.push(cells); continue; }
      if (currentTable && line.length > 5) {
        if (line.match(/\s{3,}/) && line.split(/\s{3,}/).filter(Boolean).length >= 2) { currentTable.rows.push(line.split(/\s{3,}/).map(function(c) { return c.trim(); }).filter(Boolean)); continue; }
        if (currentTable.rows.length >= 2) tables.push(currentTable);
        currentTable = null;
      }
    }
    if (currentTable && currentTable.rows.length >= 2) tables.push(currentTable);
    return tables;
  }

  function smartParseDocument(text) {
    var result = { companyName: '', deptName: '', haccpTeam: [], auditor: '', extraItems: [], productName: '', rawMaterials: '', additives: '', productPH: '', waterActivity: '', intendedUse: '', storageCondition: '', packagingMethod: '', targetConsumer: '', shelfLife: '', formula: [], processSteps: [], hazardBio: [], hazardChem: [], hazardPhys: [], execStandard: '', criticalLimits: '', monitoring: [], correctiveActions: [], recordPeriod: '', recordFormat: '' };
    if (!text || !text.trim()) return result;
    function extractKV(pattern) { var m = text.match(pattern); return m ? m[1].trim() : ''; }
    var itemDescPairs = {};
    var tables = detectTableRows(text);
    for (var ti = 0; ti < tables.length; ti++) { var rows = tables[ti].rows; if (rows.length < 2) continue; var header = rows[0].join(' ').toLowerCase(); if ((header.indexOf('项目') !== -1 || header.indexOf('描述') !== -1) && rows[0].length <= 3) { for (var ri = 1; ri < rows.length; ri++) { var row = rows[ri]; if (row.length >= 2) { var key = row[0].replace(/[：:]\s*$/, '').trim(); var val = row.slice(1).join(' ').replace(/^[：:]\s*/, '').trim(); if (key && val) itemDescPairs[key] = val; } } } }
    var standardKeys = ['产品名称', '产品名', '主要原料', '原料', '辅料/辅剂', '辅料', '添加剂', '产品特性', '预期用途', '用途', '储存条件', '贮藏条件', '存储条件', '保存条件', '包装方式', '包装', '目标消费者', '消费群体', '适用人群', '保质期', '保存期', '项目', '描述'];
    for (var k in itemDescPairs) { var isStandard = false; for (var sk = 0; sk < standardKeys.length; sk++) { if (k.indexOf(standardKeys[sk]) !== -1) { isStandard = true; break; } } if (!isStandard && k && itemDescPairs[k]) result.extraItems.push({ key: k, value: itemDescPairs[k] }); }
    var lines = text.split('\n');
    var currentSection = '';
    var sectionContent = {};
    for (var li = 0; li < lines.length; li++) { var line = lines[li].trim(); if (!line) continue; var headingMatch = line.match(/^【(.+?)】/) || line.match(/^步骤\s*\d+[：:]\s*(.+)/) || line.match(/^第[一二三四五六七八九十\d]+[部部分章节][：:](.+)/); if (headingMatch) { currentSection = headingMatch[1].trim(); if (!sectionContent[currentSection]) sectionContent[currentSection] = ''; continue; } var titleMatch = line.match(/^[（(]?[一二三四五六七八九十\d]+[)）、]\s*(.+?)[：:。]?\s*$/); if (titleMatch && line.length < 30) { currentSection = titleMatch[1].trim(); if (!sectionContent[currentSection]) sectionContent[currentSection] = ''; continue; } if (currentSection) sectionContent[currentSection] = (sectionContent[currentSection] || '') + line + '\n'; }
    var titleLine = '';
    for (var li2 = 0; li2 < Math.min(lines.length, 10); li2++) { if (lines[li2].trim()) { titleLine = lines[li2].trim(); break; } }
    var companyMatch = titleLine.match(/([^（(]+?)HACCP计划书/);
    if (companyMatch) result.companyName = companyMatch[1].trim();
    result.deptName = '品控部';
    var auditorMatch = text.match(/(?:审核[员人]|批准[员人])[：:]\s*([^\n，。,。]{2,10})/);
    if (auditorMatch) result.auditor = auditorMatch[1].trim();
    var teamText = text.match(/(?:HACCP小组|组成)[^。]*?([^。]{50,500})/);
    if (teamText) { var teamDesc = teamText[1]; var memberRoles = [{ name: '企业负责人', dept: '管理层', position: '企业负责人', role: '组长', remark: '' }, { name: '品控负责人', dept: '品控部', position: '品控主管', role: '副组长', remark: '' }, { name: '生产负责人', dept: '生产部', position: '生产主任', role: '成员', remark: '' }, { name: '设备负责人', dept: '设备部', position: '设备主管', role: '成员', remark: '' }, { name: '仓储负责人', dept: '仓储部', position: '仓储主管', role: '成员', remark: '' }, { name: '采购负责人', dept: '采购部', position: '采购主管', role: '成员', remark: '' }]; var mentionedRoles = []; for (var mr = 0; mr < memberRoles.length; mr++) { var role = memberRoles[mr]; if (teamDesc.indexOf(role.dept.replace('部','')) !== -1 || teamDesc.indexOf(role.dept) !== -1 || teamDesc.indexOf(role.position.replace('主管','')) !== -1) mentionedRoles.push(role); } if (mentionedRoles.length >= 2) result.haccpTeam = mentionedRoles; }
    if (itemDescPairs['产品名称'] || itemDescPairs['产品名']) result.productName = itemDescPairs['产品名称'] || itemDescPairs['产品名'] || '';
    if (itemDescPairs['主要原料'] || itemDescPairs['原料']) result.rawMaterials = itemDescPairs['主要原料'] || itemDescPairs['原料'] || '';
    if (itemDescPairs['辅料/辅剂'] || itemDescPairs['辅料'] || itemDescPairs['添加剂']) result.additives = itemDescPairs['辅料/辅剂'] || itemDescPairs['辅料'] || itemDescPairs['添加剂'] || '';
    if (itemDescPairs['产品特性']) { var propText = itemDescPairs['产品特性']; var phMatch = propText.match(/PH[值]?[：:。\s]*([\d.]+)/i); if (phMatch) result.productPH = phMatch[1]; var awMatch = propText.match(/(?:水分活度|aw)[：:。\s]*([\d.]+)/i); if (awMatch) result.waterActivity = awMatch[1]; }
    if (itemDescPairs['预期用途'] || itemDescPairs['用途']) result.intendedUse = itemDescPairs['预期用途'] || itemDescPairs['用途'] || '';
    if (itemDescPairs['储存条件'] || itemDescPairs['贮藏条件'] || itemDescPairs['存储条件']) result.storageCondition = itemDescPairs['储存条件'] || itemDescPairs['贮藏条件'] || itemDescPairs['存储条件'] || '';
    if (itemDescPairs['包装方式'] || itemDescPairs['包装']) result.packagingMethod = itemDescPairs['包装方式'] || itemDescPairs['包装'] || '';
    if (itemDescPairs['目标消费者'] || itemDescPairs['消费群体'] || itemDescPairs['适用人群']) result.targetConsumer = itemDescPairs['目标消费者'] || itemDescPairs['消费群体'] || itemDescPairs['适用人群'] || '';
    if (itemDescPairs['保质期'] || itemDescPairs['保存期']) result.shelfLife = itemDescPairs['保质期'] || itemDescPairs['保存期'] || '';
    if (!result.productName) result.productName = extractKV(/(?:产品名称|产品名)[：:]\s*([^\n，。,。]{2,50})/);
    if (!result.rawMaterials) result.rawMaterials = extractKV(/(?:主要原料|原材料|原料)[：:]\s*([^\n。]{2,200})/);
    if (!result.additives) result.additives = extractKV(/(?:辅料|添加剂)[：:。]?\s*([^\n。]{2,200})/);
    if (!result.storageCondition) result.storageCondition = extractKV(/(?:储存条件|贮藏条件|存储条件|保存条件)[：:]\s*([^\n。]+)/);
    if (!result.packagingMethod) result.packagingMethod = extractKV(/(?:包装方式|包装方法)[：:]\s*([^\n。]+)/);
    if (!result.shelfLife) result.shelfLife = extractKV(/(?:保质期|保存期|货架期)[：:]\s*([^\n。]{2,20})/);
    if (!result.intendedUse) result.intendedUse = extractKV(/(?:预期用途|用途)[：:]\s*([^\n。]+)/);
    if (!result.targetConsumer) result.targetConsumer = extractKV(/(?:目标消费者|消费群体|适用人群)[：:]\s*([^\n。]+)/);
    if (!result.productPH) { var phMatch = text.match(/(?:PH|pH)[值]?[：:。\s]*([\d.]+)/i); if (phMatch) result.productPH = phMatch[1]; }
    if (!result.waterActivity) { var awMatch = text.match(/(?:水分活度|Aw|aw)[：:。\s]*([\d.]+)/i); if (awMatch) result.waterActivity = awMatch[1]; }
    var processText = '';
    var possibleKeys = ['生产流程', '绘制并确认工艺流程图', '步骤2', '操作方式和步骤'];
    for (var pk = 0; pk < possibleKeys.length; pk++) { for (var sk in sectionContent) { if (sk.indexOf(possibleKeys[pk]) !== -1) { processText = sectionContent[sk]; break; } } if (processText) break; }
    if (!processText) { var flowMatch = text.match(/(?:生产流程|工艺流程|加工流程)[：:。\s]*([\s\S]{500,4000})(?:\n\n|\n(?:步骤|产品|危害|关键|监控|记录|验证))/i); if (flowMatch) processText = flowMatch[1]; }
    if (processText) {
      var rawSteps = processText.split(/[；;]/).filter(Boolean);
      if (rawSteps.length < 2) rawSteps = processText.split(/[。]/).filter(function(s) { return s.trim().length > 10; });
      var stepKeywords = ['清洗', '粉碎', '捣碎', '搅拌', '匀浆', '提取', '浓缩', '膜滤', '过滤', '脱色', '离心', '离子交换', '干燥', '包装', '灌装', '沉淀', '杀菌', '灭菌', '冷却', '检验', '入库', '储存'];
      var processedSteps = [];
      for (var si = 0; si < rawSteps.length; si++) { var segment = rawSteps[si].trim(); if (!segment || segment.length < 8) continue; var stepName = '', params = '', equipment = ''; for (var skw = 0; skw < stepKeywords.length; skw++) { var kw = stepKeywords[skw]; if (segment.indexOf(kw) !== -1) { stepName = kw; break; } } if (!stepName) { if (segment.indexOf('将') !== -1) { var afterJiang = segment.indexOf('将') + 1; stepName = segment.slice(afterJiang, afterJiang + 12).replace(/[。，,].*$/, ''); } else { stepName = segment.slice(0, 12).replace(/[。，,].*$/, ''); } } var equipMatch = segment.match(/([\u4e00-\u9fa5]{2,8}(?:机|器|仪|设备|釜|槽|塔|罐|箱|炉))/); if (equipMatch) equipment = equipMatch[1]; var paramParts = []; var tempMatch = segment.match(/(\d+[~-]?\d*)\s*[℃°\u2103]/); if (tempMatch) paramParts.push('温度' + tempMatch[0]); var timeMatch = segment.match(/(\d+[~-]?\d*)\s*(?:分钟|小时|min|h|秒|s)/); if (timeMatch) paramParts.push('时间' + timeMatch[0]); var pressureMatch = segment.match(/(\d+[~-]?\d*)\s*(?:MPa|Pa|大气压|bar)/); if (pressureMatch) paramParts.push('压力' + pressureMatch[0]); var powerMatch = segment.match(/(\d+[~-]?\d*)\s*[Ww]/); if (powerMatch) paramParts.push('功率' + powerMatch[0] + 'W'); var freqMatch = segment.match(/(\d+[~-]?\d*)\s*k?Hz/); if (freqMatch) paramParts.push('频率' + freqMatch[0] + 'Hz'); var speedMatch = segment.match(/(\d+[~-]?\d*)\s*r\/(?:min|分钟)/); if (speedMatch) paramParts.push('转速' + speedMatch[0] + 'r/min'); if (paramParts.length > 0) params = paramParts.join('，'); var controlPoint = ''; if (segment.indexOf('CCP') !== -1 || segment.indexOf('关键控制') !== -1) { var ccpMatch = segment.match(/(CCP[-\s]*\d+)/i); if (ccpMatch) controlPoint = ccpMatch[1].toUpperCase(); else controlPoint = 'CCP'; } if (stepName) processedSteps.push({ stepName: stepName, operationMethod: segment.slice(0, 60).replace(/[。，,]+$/, '') + (segment.length > 60 ? '...' : ''), parameters: params, controlPoint: controlPoint, equipmentName: equipment }); }
      var seenSteps = {}; for (var psi = 0; psi < processedSteps.length; psi++) { var step = processedSteps[psi]; var key = step.stepName; if (!seenSteps[key] || (step.parameters && !seenSteps[key].parameters)) seenSteps[key] = step; } for (var key in seenSteps) result.processSteps.push(seenSteps[key]); if (result.processSteps.length > 15) result.processSteps = result.processSteps.slice(0, 15);
    }
    var inHazardSection = false, hazardSectionStart = -1;
    for (var li3 = 0; li3 < lines.length; li3++) { var line = lines[li3].trim(); if (line.indexOf('危害分析') !== -1 || line.indexOf('潜在危害') !== -1) { inHazardSection = true; hazardSectionStart = li3; } if (inHazardSection && (line.indexOf('CCP决策') !== -1 || line.indexOf('HACCP计划') !== -1 || (line.indexOf('监控') !== -1 && line.indexOf('CCP') !== -1))) break; }
    if (hazardSectionStart !== -1) {
      for (var ht = 0; ht < tables.length; ht++) { var rows = tables[ht].rows; if (rows.length < 2) continue; var headerStr = rows[0].join(' ').toLowerCase();
        if (headerStr.indexOf('加工步骤') !== -1 || headerStr.indexOf('潜在危害') !== -1 || headerStr.indexOf('是否显著') !== -1 || headerStr.indexOf('判断依据') !== -1) { for (var ri2 = 1; ri2 < rows.length; ri2++) { var row = rows[ri2]; if (row.length < 3) continue; var stepName = row[0], hazardDesc = row[1] || '', isSignificant = row[2] || ''; if (hazardDesc.indexOf('B:') !== -1 || hazardDesc.indexOf('C:') !== -1 || hazardDesc.indexOf('P:') !== -1) { var bioMatch = hazardDesc.match(/B:(.+?)(?=C:|P:|$)/), chemMatch = hazardDesc.match(/C:(.+?)(?=B:|P:|$)/), physMatch = hazardDesc.match(/P:(.+?)(?=B:|C:|$)/); if (bioMatch && isSignificant.indexOf('是') !== -1) result.hazardBio.push({ desc: stepName + '-' + bioMatch[1].trim(), severity: '中', likelihood: '中', control: '参见前提方案控制' }); if (chemMatch && isSignificant.indexOf('是') !== -1) result.hazardChem.push({ desc: stepName + '-' + chemMatch[1].trim(), severity: '中', likelihood: '中', control: '参见前提方案控制' }); if (physMatch && isSignificant.indexOf('是') !== -1) result.hazardPhys.push({ desc: stepName + '-' + physMatch[1].trim(), severity: '中', likelihood: '中', control: '参见前提方案控制' }); } } }
        if (headerStr.indexOf('q1') !== -1 || headerStr.indexOf('q2') !== -1 || headerStr.indexOf('ccp判断') !== -1) { for (var ri3 = 1; ri3 < rows.length; ri3++) { var row = rows[ri3]; if (row.length < 4) continue; var stepName = row[0], hazardText = row[1] || ''; var isCCP = false; for (var ci = 0; ci < row.length; ci++) { if (row[ci].indexOf('是') !== -1 && ci >= 2) isCCP = true; } var lastCol = row[row.length - 1]; if (lastCol === '是' || lastCol.indexOf('CCP') !== -1) isCCP = true; if (hazardText.indexOf('生物') !== -1 || hazardText.indexOf('病原') !== -1 || hazardText.indexOf('细菌') !== -1 || hazardText.indexOf('霉菌') !== -1 || hazardText.indexOf('微生物') !== -1) result.hazardBio.push({ desc: stepName + '-' + hazardText, severity: isCCP ? '高' : '中', likelihood: isCCP ? '高' : '中', control: isCCP ? '通过CCP控制' : '通过前提方案控制' }); else if (hazardText.indexOf('化学') !== -1 || hazardText.indexOf('农药') !== -1 || hazardText.indexOf('重金属') !== -1 || hazardText.indexOf('残留') !== -1) result.hazardChem.push({ desc: stepName + '-' + hazardText, severity: isCCP ? '高' : '中', likelihood: isCCP ? '高' : '中', control: isCCP ? '通过CCP控制' : '通过前提方案控制' }); else if (hazardText.indexOf('物理') !== -1 || hazardText.indexOf('金属') !== -1 || hazardText.indexOf('砂石') !== -1 || hazardText.indexOf('异物') !== -1) result.hazardPhys.push({ desc: stepName + '-' + hazardText, severity: isCCP ? '中' : '低', likelihood: isCCP ? '中' : '低', control: isCCP ? '通过CCP控制' : '通过前提方案控制' }); } }
      }
    }
    var stdMatch = text.match(/(?:依据|按照|根据|执行标准)[：:。]?\s*([A-Za-z]{1,5}\s*\d+[\d-]*)/);
    if (stdMatch) { var stdCode = stdMatch[1].toLowerCase(); if (stdCode.indexOf('gb') !== -1) result.execStandard = 'gb'; else if (stdCode.indexOf('iso') !== -1 || stdCode.indexOf('国际') !== -1) result.execStandard = 'international'; }
    if (!result.execStandard) { if (text.indexOf('GB 14881') !== -1 || text.indexOf('国标') !== -1 || text.indexOf('国家标准') !== -1) result.execStandard = 'gb'; else if (text.indexOf('行业标准') !== -1) result.execStandard = 'industry'; else if (text.indexOf('企业标准') !== -1) result.execStandard = 'enterprise'; }
    var planTables = []; for (var pt = 0; pt < tables.length; pt++) { var rows = tables[pt].rows; if (rows.length < 3) continue; var headerStr = rows[0].join(' ').toLowerCase(); if (headerStr.indexOf('关键控制点') !== -1 && (headerStr.indexOf('关键限值') !== -1 || headerStr.indexOf('cl') !== -1)) planTables.push(tables[pt]); }
    if (planTables.length > 0) { var clParts = []; for (var pti = 0; pti < planTables.length; pti++) { var table = planTables[pti]; for (var ri4 = 1; ri4 < table.rows.length; ri4++) { var row = table.rows[ri4]; if (row.length >= 2) { var ccpName = row[0], clVal = row[1]; if (ccpName && clVal) clParts.push(ccpName + '：' + clVal); } } } if (clParts.length > 0) result.criticalLimits = clParts.join('\n'); }
    if (planTables.length > 0) { for (var pti2 = 0; pti2 < planTables.length; pti2++) { var table = planTables[pti2], headerRow = table.rows[0]; var ccpIdx = -1, clIdx = -1, objIdx = -1, methodIdx = -1, freqIdx = -1, personIdx = -1, remarkIdx = -1, correctiveIdx = -1, verificationIdx = -1, recordIdx = -1; for (var ci2 = 0; ci2 < headerRow.length; ci2++) { var h = headerRow[ci2].toLowerCase(); if (h.indexOf('关键控制点') !== -1 || h === 'ccp') ccpIdx = ci2; if (h.indexOf('关键限值') !== -1 || h.indexOf('cl') !== -1) clIdx = ci2; if (h.indexOf('监控对象') !== -1 || h.indexOf('对象') !== -1) objIdx = ci2; if (h.indexOf('监控方法') !== -1 || h.indexOf('方法') !== -1) methodIdx = ci2; if (h.indexOf('监控频率') !== -1 || h.indexOf('频率') !== -1) freqIdx = ci2; if (h.indexOf('监控人员') !== -1 || h.indexOf('人员') !== -1) personIdx = ci2; if (h.indexOf('备注') !== -1) remarkIdx = ci2; if (h.indexOf('纠偏') !== -1) correctiveIdx = ci2; if (h.indexOf('验证') !== -1) verificationIdx = ci2; if (h.indexOf('记录') !== -1) recordIdx = ci2; } for (var ri5 = 1; ri5 < table.rows.length; ri5++) { var row = table.rows[ri5], ccpName = ccpIdx !== -1 ? (row[ccpIdx] || '') : ''; if (ccpName) { result.monitoring.push({ ccp: ccpName, object: objIdx !== -1 ? (row[objIdx] || '') : '', method: methodIdx !== -1 ? (row[methodIdx] || '') : '', frequency: freqIdx !== -1 ? (row[freqIdx] || '') : '', personnel: personIdx !== -1 ? (row[personIdx] || '') : '', remark: remarkIdx !== -1 ? (row[remarkIdx] || '') : '' }); if (correctiveIdx !== -1) result.correctiveActions.push({ ccp: ccpName, cl: clIdx !== -1 ? (row[clIdx] || '') : '', corrective: correctiveIdx !== -1 ? (row[correctiveIdx] || '') : '', verification: verificationIdx !== -1 ? (row[verificationIdx] || '') : '', record: recordIdx !== -1 ? (row[recordIdx] || '') : '' }); } } } }
    var recordMatch = text.match(/(?:记录保存|保存期限|记录期限)[：:。]?\s*(\d+\s*[年月])/);
    if (recordMatch) result.recordPeriod = recordMatch[1];
    if (text.indexOf('电子') !== -1 && text.indexOf('纸质') !== -1) result.recordFormat = '电子版+纸质版'; else if (text.indexOf('电子') !== -1) result.recordFormat = '电子版'; else if (text.indexOf('纸质') !== -1) result.recordFormat = '纸质版';
    return result;
  }

  async function handleAiFill() {
    const aiBtn = document.getElementById('q15AiFillBtn');
    if (!aiBtn) return;
    if (!_uploadedText) { showUploadError('请先上传并解析文件'); return; }
    const content = document.getElementById('q15Content');
    const data = loadData();
    if (content) collectSectionData(content, data);
    aiBtn.disabled = true; aiBtn.textContent = '\u23F3 AI分析中...';
    try {
      const res = await fetch('/api/ai/fill-from-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: _uploadedText }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'AI 分析失败');
      if (result.ok && result.data) applyAiFillResult(result.data, aiBtn);
      else throw new Error('返回数据格式异常');
    } catch (err) {
      console.warn('后端不可用，使用前端智能解析:', err.message);
      var smartResult = smartParseDocument(_uploadedText);
      var filledCount = 0; for (var key in smartResult) { if (Array.isArray(smartResult[key])) { if (smartResult[key].length > 0) filledCount++; } else if (smartResult[key]) filledCount++; }
      console.log('前端智能解析提取到 ' + filledCount + ' 个字段');
      applyAiFillResult(smartResult, aiBtn);
    }
  }

  function applyAiFillResult(aiData, aiBtn) {
    applyAiData(aiData);
    var filledFields = 0, totalFields = 0; for (var key in aiData) { totalFields++; if (Array.isArray(aiData[key])) { if (aiData[key].length > 0) filledFields++; } else if (aiData[key]) filledFields++; }
    aiBtn.textContent = '\u2713 填充完成（' + filledFields + '/' + totalFields + '个字段）';
    aiBtn.className = 'btn btn-primary';
    setTimeout(() => { aiBtn.disabled = false; aiBtn.textContent = '\u{1F916} AI重新填写问卷'; aiBtn.className = 'btn btn-primary'; }, 3000);
    renderSectionNav(); currentStep = 0; renderActiveSection(); renderSectionNav();
  }

  function applyAiData(aiData) {
    const data = loadData();
    if (aiData.companyName) data.companyName = aiData.companyName;
    if (aiData.deptName) data.deptName = aiData.deptName;
    if (aiData.auditor) data.auditor = aiData.auditor;
    if (aiData.extraItems && Array.isArray(aiData.extraItems) && aiData.extraItems.length > 0) data.extraItems = aiData.extraItems.map(function(e) { return { id: genId(), key: e.key || '', value: e.value || '' }; });
    if (aiData.productName) data.productName = aiData.productName;
    if (aiData.rawMaterials) data.rawMaterials = aiData.rawMaterials;
    if (aiData.additives) data.additives = aiData.additives;
    if (aiData.productPH) data.productPH = aiData.productPH;
    if (aiData.waterActivity) data.waterActivity = aiData.waterActivity;
    if (aiData.intendedUse) data.intendedUse = aiData.intendedUse;
    if (aiData.storageCondition) data.storageCondition = aiData.storageCondition;
    if (aiData.packagingMethod) data.packagingMethod = aiData.packagingMethod;
    if (aiData.targetConsumer) data.targetConsumer = aiData.targetConsumer;
    if (aiData.shelfLife) data.shelfLife = aiData.shelfLife;
    if (aiData.execStandard) data.execStandard = aiData.execStandard;
    if (aiData.criticalLimits) data.criticalLimits = aiData.criticalLimits;
    if (aiData.recordPeriod) data.recordPeriod = aiData.recordPeriod;
    if (aiData.recordFormat) data.recordFormat = aiData.recordFormat;
    if (aiData.haccpTeam && Array.isArray(aiData.haccpTeam) && aiData.haccpTeam.length > 0) data.haccpTeam = aiData.haccpTeam.map(function(m) { return { id: genId(), name: m.name || '', dept: m.dept || '', position: m.position || '', role: m.role || '', remark: m.remark || '' }; });
    if (aiData.formula && Array.isArray(aiData.formula) && aiData.formula.length > 0) data.formula = aiData.formula.map(function(f) { return { id: genId(), material: f.material || '', dosage: f.dosage || '', func: f.func || '' }; });
    if (aiData.processSteps && Array.isArray(aiData.processSteps) && aiData.processSteps.length > 0) data.processSteps = aiData.processSteps.map(function(s) { return { id: genId(), stepName: s.stepName || '', operationMethod: s.operationMethod || '', parameters: s.parameters || '', controlPoint: s.controlPoint || '', equipmentName: s.equipmentName || '' }; });
    if (aiData.hazardBio && Array.isArray(aiData.hazardBio)) data.hazardBio = aiData.hazardBio.map(function(h) { return { desc: h.desc || '', severity: h.severity || '中', likelihood: h.likelihood || '中', control: h.control || '' }; });
    if (aiData.hazardChem && Array.isArray(aiData.hazardChem)) data.hazardChem = aiData.hazardChem.map(function(h) { return { desc: h.desc || '', severity: h.severity || '中', likelihood: h.likelihood || '中', control: h.control || '' }; });
    if (aiData.hazardPhys && Array.isArray(aiData.hazardPhys)) data.hazardPhys = aiData.hazardPhys.map(function(h) { return { desc: h.desc || '', severity: h.severity || '中', likelihood: h.likelihood || '中', control: h.control || '' }; });
    if (aiData.monitoring && Array.isArray(aiData.monitoring) && aiData.monitoring.length > 0) data.monitoring = aiData.monitoring.map(function(m) { return { id: genId(), ccp: m.ccp || '', object: m.object || '', method: m.method || '', frequency: m.frequency || '', personnel: m.personnel || '', remark: m.remark || '' }; });
    if (aiData.correctiveActions && Array.isArray(aiData.correctiveActions) && aiData.correctiveActions.length > 0) data.correctiveActions = aiData.correctiveActions.map(function(c) { return { id: genId(), ccp: c.ccp || '', cl: c.cl || '', corrective: c.corrective || '', verification: c.verification || '', record: c.record || '' }; });
    saveData(data); renderActiveSection();
  }

  let currentStep = 0;
  const TOTAL_STEPS = 7;
  const SECTION_NAMES = ['进行危害分析', '确定关键控制点', '建立关键限值', '建立监控程序', '建立纠正措施', '建立验证程序', '建立记录保持程序'];

  function renderSectionNav() {
    const data = loadData();
    const nav = document.getElementById('q15Progress');
    if (!nav) return;
    nav.innerHTML = SECTION_NAMES.map((name, i) => { const isActive = i === currentStep; const isDone = isStepCompleted(data, i); return '<div class="q15-step ' + (isActive ? 'active' : '') + ' ' + (isDone ? 'done' : '') + '" data-step="' + i + '"><div class="q15-step-num">' + (isDone ? '\u2713' : i + 1) + '</div><span>' + name + '</span></div>'; }).join('');
    nav.querySelectorAll('.q15-step').forEach(el => { el.addEventListener('click', () => { currentStep = parseInt(el.dataset.step); renderActiveSection(); renderSectionNav(); }); });
  }

  function isStepCompleted(data, step) {
    switch (step) {
      case 0: return data.processSteps.some(s => s.stepName);
      case 1: return data.ccpCompleted;
      case 2: return !!data.execStandard;
      case 3: return data.monitoring.some(m => m.ccp);
      case 4: return data.correctiveActions.some(c => c.ccp);
      case 5: return true;
      case 6: return !!data.recordPeriod || !!data.recordFormat;
      default: return false;
    }
  }

  function renderActiveSection() {
    const content = document.getElementById('q15Content');
    if (!content) return;
    const data = loadData();
    const sections = [renderProcessFlow, renderHazardAnalysis, renderCriticalLimits, renderMonitoring, renderCorrective, renderVerification, renderRecordKeeping];
    const sectionHTML = sections[currentStep](data);
    content.innerHTML = '<div class="q15-section"><h2>' + SECTION_NAMES[currentStep] + '</h2>' + sectionHTML + '</div><div class="q15-nav-buttons"><button class="btn btn-secondary" id="q15PrevBtn"' + (currentStep === 0 ? ' disabled' : '') + '>\u2190 上一步</button><span class="q15-step-indicator">第 ' + (currentStep + 1) + ' / ' + TOTAL_STEPS + ' 步</span>' + (currentStep < TOTAL_STEPS - 1 ? '<button class="btn btn-primary" id="q15NextBtn">下一步 \u2192</button>' : '<button class="btn btn-primary btn-lg" id="q15SubmitBtn">\u2713 提交问卷</button>') + '</div>';
    bindSectionEvents(content, data);
    document.getElementById('q15PrevBtn')?.addEventListener('click', () => { collectSectionData(content, data); saveData(data); if (currentStep > 0) { currentStep--; renderActiveSection(); renderSectionNav(); } });
    document.getElementById('q15NextBtn')?.addEventListener('click', () => { collectSectionData(content, data); saveData(data); if (currentStep < TOTAL_STEPS - 1) { currentStep++; renderActiveSection(); renderSectionNav(); } });
    document.getElementById('q15SubmitBtn')?.addEventListener('click', () => { collectSectionData(content, data); saveData(data); submitQuestionnaire(data); });
  }

  function collectSectionData(content, data) {
    const inputs = content.querySelectorAll('[data-q15-field]');
    inputs.forEach(el => { const field = el.dataset.q15Field; if (el.type === 'checkbox') data[field] = el.checked; else data[field] = el.value; });
    const extraBody = content.querySelector('#extraItemsBody');
    if (extraBody) { data.extraItems = []; extraBody.querySelectorAll('tr').forEach(function(tr) { var inputs = tr.querySelectorAll('input'); if (inputs.length >= 2) { data.extraItems.push({ id: genId(), key: inputs[0].value, value: inputs[1].value }); } }); }
    const productExtraBody = content.querySelector('#productExtraItemsBody');
    if (productExtraBody) { data.productExtraItems = []; productExtraBody.querySelectorAll('tr').forEach(function(tr) { var inputs = tr.querySelectorAll('input'); if (inputs.length >= 2) { data.productExtraItems.push({ id: genId(), key: inputs[0].value, value: inputs[1].value }); } }); }
  }

  // ==================== 渲染各章节 ====================
  function renderCompanyInfo(data) {
    var extraHtml = '';
    if (data.extraItems && data.extraItems.length > 0) { extraHtml = data.extraItems.map(function(e, i) { return '<tr data-ex-idx="' + i + '"><td><input type="text" value="' + esc(e.key) + '" placeholder="项目名称" style="width:100%"></td><td><input type="text" value="' + esc(e.value) + '" placeholder="项目内容" style="width:100%"></td><td><button class="q15-del-row" data-ex-idx="' + i + '">&times;</button></td></tr>'; }).join(''); }
    return '<div class="q15-field-group"><label>企业名称 <span class="required">*</span></label><input type="text" data-q15-field="companyName" value="' + esc(data.companyName) + '" placeholder="请输入企业名称"></div><div class="q15-field-group"><label>制定部门 <span class="required">*</span></label><input type="text" data-q15-field="deptName" value="' + esc(data.deptName) + '" placeholder="请输入制定部门"></div><div class="q15-field-group"><label>审核人员</label><input type="text" data-q15-field="auditor" value="' + esc(data.auditor) + '" placeholder="请输入审核人员姓名"></div><div class="q15-table-section"><h3>HACCP小组成员 <span class="required">*</span></h3><p class="q15-table-hint">成员涵盖生产、品控、设备、仓储、采购等部门负责人，必要时需要外部专家参与</p><table class="q15-table" id="teamTable"><thead><tr><th>姓名</th><th>部门</th><th>职位</th><th>小组职责</th><th>备注</th><th style="width:50px">操作</th></tr></thead><tbody id="teamBody">' + data.haccpTeam.map(function(m, i) { return '<tr data-team-idx="' + i + '"><td><input type="text" value="' + esc(m.name) + '" placeholder="姓名"></td><td><input type="text" value="' + esc(m.dept) + '" placeholder="部门"></td><td><input type="text" value="' + esc(m.position) + '" placeholder="职位"></td><td><input type="text" value="' + esc(m.role) + '" placeholder="如：组长、副组长"></td><td><input type="text" value="' + esc(m.remark) + '" placeholder="备注信息"></td><td><button class="q15-del-row" data-team-idx="' + i + '">&times;</button></td></tr>'; }).join('') + '</tbody></table><button class="btn btn-sm btn-secondary" id="addTeamRow">+ 添加成员</button></div><div class="q15-table-section" style="margin-top:16px;"><h3>其他项目 <span style="font-weight:400;font-size:13px;color:var(--gray-400);">（手动添加未列出的补充信息）</span></h3><p class="q15-table-hint">添加额外信息项，例如：地址、联系人、电话、邮箱等</p><table class="q15-table" id="extraItemsTable"><thead><tr><th>项目名称</th><th>项目内容</th><th style="width:50px">操作</th></tr></thead><tbody id="extraItemsBody">' + extraHtml + '</tbody></table><button class="btn btn-sm btn-secondary" id="addExtraItemRow">+ 添加项目</button></div>';
  }

  function renderProductInfo(data) {
    var extraHtml = '';
    if (data.productExtraItems && data.productExtraItems.length > 0) { extraHtml = data.productExtraItems.map(function(e, i) { return '<tr data-p-ex-idx="' + i + '"><td><input type="text" value="' + esc(e.key) + '" placeholder="项目名称" style="width:100%"></td><td><input type="text" value="' + esc(e.value) + '" placeholder="项目内容" style="width:100%"></td><td><button class="q15-del-row" data-p-ex-idx="' + i + '">&times;</button></td></tr>'; }).join(''); }
    return '<div class="q15-field-group"><label>产品名称 <span class="required">*</span></label><input type="text" data-q15-field="productName" value="' + esc(data.productName) + '" placeholder="请输入产品名称"></div><div class="q15-field-group"><label>主要原料</label><textarea data-q15-field="rawMaterials" placeholder="列出主要原料，不同原料用逗号分隔">' + esc(data.rawMaterials) + '</textarea></div><div class="q15-field-group"><label>添加剂</label><textarea data-q15-field="additives" placeholder="列出使用的添加剂，不同添加剂用逗号分隔">' + esc(data.additives) + '</textarea></div><div class="q15-row"><div class="q15-field-group"><label>产品的特性PH</label><input type="number" step="0.01" data-q15-field="productPH" value="' + esc(data.productPH) + '" placeholder="如：6.5"></div><div class="q15-field-group"><label>水分活度</label><input type="number" step="0.01" data-q15-field="waterActivity" value="' + esc(data.waterActivity) + '" placeholder="如：0.85"></div></div><div class="q15-field-group"><label>预期用途</label><textarea data-q15-field="intendedUse" placeholder="描述产品的预期用途和消费群体如何使用该产品">' + esc(data.intendedUse) + '</textarea></div><div class="q15-row"><div class="q15-field-group"><label>储存条件</label><input type="text" data-q15-field="storageCondition" value="' + esc(data.storageCondition) + '" placeholder="如：阴凉干燥处"></div><div class="q15-field-group"><label>包装方式</label><input type="text" data-q15-field="packagingMethod" value="' + esc(data.packagingMethod) + '" placeholder="如：真空包装"></div></div><div class="q15-row"><div class="q15-field-group"><label>目标消费者</label><input type="text" data-q15-field="targetConsumer" value="' + esc(data.targetConsumer) + '" placeholder="如：一般人群"></div><div class="q15-field-group"><label>保质期</label><input type="text" data-q15-field="shelfLife" value="' + esc(data.shelfLife) + '" placeholder="如：12个月"></div></div><div class="q15-table-section" style="margin-top:16px;"><h3>其他项目 <span style="font-weight:400;font-size:13px;color:var(--gray-400);">（手动添加未列出的补充信息）</span></h3><p class="q15-table-hint">添加额外信息项，例如：产品型号、规格、批号等</p><table class="q15-table" id="productExtraItemsTable"><thead><tr><th>项目名称</th><th>项目内容</th><th style="width:50px">操作</th></tr></thead><tbody id="productExtraItemsBody">' + extraHtml + '</tbody></table><button class="btn btn-sm btn-secondary" id="addProductExtraItemRow">+ 添加项目</button></div>';
  }

  // ===== 精简版文件上传区域（仅用于"进行危害分析"步骤内部）=====
  function renderCompactUploadArea() {
    if (!_uploadedText && !_uploadedFileName) {
      return '<div style="margin-bottom:12px;padding:8px 12px;border:1px dashed #d0d5dd;border-radius:6px;background:#fafbfc;display:flex;align-items:center;gap:10px;font-size:13px;">' +
        '<span style="color:var(--gray-500);">文件导入（可选）</span>' +
        '<input type="file" id="q15CompactFileInput" accept=".docx,.pdf" style="font-size:12px;max-width:200px;">' +
        '<span style="font-size:11px;color:var(--gray-400);">支持 .docx / .pdf</span>' +
        '</div>';
    }
    return '<div style="margin-bottom:12px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;display:flex;align-items:center;gap:10px;font-size:13px;">' +
      '<span style="color:var(--gray-500);">已导入:</span> ' + esc(_uploadedFileName) +
      ' <span style="font-size:11px;color:var(--gray-400);">(' + formatFileSize(_uploadedFileSize) + ')</span>' +
      '<button class="btn btn-xs btn-secondary" id="q15CompactClearBtn" style="padding:1px 8px;font-size:11px;">清除</button>' +
      '</div>';
  }

  function bindCompactUploadEvents(content) {
    var fileInput = content.querySelector('#q15CompactFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
      });
    }
    var clearBtn = content.querySelector('#q15CompactClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        clearUploadedFile();
        renderActiveSection();
      });
    }
  }

  function renderProcessFlow(data) {
    var uploadHtml = renderCompactUploadArea();
    return '<h3>配方以及依据</h3><p class="q15-table-hint">根据投料顺序列出原料、辅料及添加剂的精确用量，并解释关键原料的作用</p><table class="q15-table" id="formulaTable"><thead><tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th><th style="width:50px">操作</th></tr></thead><tbody id="formulaBody">' + data.formula.map(function(f, i) { return '<tr data-fm-idx="' + i + '"><td><input type="text" value="' + esc(f.material) + '" placeholder="如：活性炭"></td><td><input type="text" value="' + esc(f.dosage) + '" placeholder="如：Xx g/kg原料"></td><td><input type="text" value="' + esc(f.func) + '" placeholder="如：除去色素"></td><td><button class="q15-del-row" data-fm-idx="' + i + '">&times;</button></td></tr>'; }).join('') + '</tbody></table><button class="btn btn-sm btn-secondary" id="addFormulaRow">+ 添加原料</button><hr class="q15-divider">' + uploadHtml + '<h3>基于产品类型，AI列出常见危害</h3><p class="q15-table-hint">基于产品类型，系统将自动识别该产品常见的生物/化学/物理危害</p><div class="q15-ai-btn-wrapper"><button class="btn btn-secondary btn-sm" id="aiHazardBtn">\u{1F916} AI识别危害</button><span id="aiHazardHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div><div id="aiHazardResult" style="margin-top:12px;"></div>';
  }

  // ===== CCP 导航面板（可点击跳转）=====
  function renderCcpNavPanel(data) {
    var steps = data.processSteps || [];
    var ccpSteps = data.ccpSteps || [];
    var hazardTypes = ['bio', 'chem', 'phys'];
    var hazardLabels = { bio: 'B', chem: 'C', phys: 'P' };
    var hazardFull = { bio: '生物危害', chem: '化学危害', phys: '物理危害' };
    var isEditMode = data.ccpViewMode === 'edit';
    
    var html = '<div class="ccp-nav-panel">';
    html += '<div class="ccp-nav-header" id="ccpNavToggle">';
    html += '<span>📋 CCP判定导航</span>';
    html += '<span class="ccp-nav-toggle" id="ccpNavArrow">▶</span>';
    html += '</div>';
    html += '<div class="ccp-nav-body" id="ccpNavBody">';
    
    steps.forEach(function(step, si) {
      var stepData = ccpSteps[si] || { stepName: step.stepName || '', hazards: {}, completed: false };
      var isStepActive = !isEditMode && si === data.ccpStepIndex;
      var isStepEditActive = isEditMode && data.ccpEditStepIdx === si;
      var stepClass = isStepActive || isStepEditActive ? 'active' : '';
      if (stepData.completed) stepClass = stepClass || 'done';
      
      html += '<div class="ccp-nav-step">';
      html += '<div class="ccp-nav-step-header ' + stepClass + '" data-nav-step="' + si + '">';
      html += '<span class="ccp-nav-step-num">' + (si + 1) + '</span>';
      html += '<span class="ccp-nav-step-name">' + esc(step.stepName || '步骤' + (si + 1)) + '</span>';
      html += '<span class="ccp-nav-toggle">▶</span>';
      html += '</div>';
      
      if (isStepActive || isStepEditActive) {
        html += '<div class="ccp-nav-hazards">';
        // 步骤编辑入口（在步骤列表的最后一项）
        html += '<div class="ccp-nav-hazard' + (isEditMode ? ' active' : '') + '" data-nav-edit="' + si + '">';
        html += '<span class="ccp-nav-hazard-badge">✎</span>';
        html += '<span class="ccp-nav-hazard-label">编辑步骤信息</span>';
        html += '</div>';
        
        hazardTypes.forEach(function(ht) {
          var hData = stepData.hazards[ht] || {};
          var isHazardActive = !isEditMode && ht === data.ccpHazardType;
          var hClass = isHazardActive ? 'active' : '';
          if (hData.isCCP !== undefined) hClass = hClass || 'done';
          var statusText = '';
          if (hData.isCCP === true) statusText = '<span class="ccp-nav-hazard-status ccp">CCP</span>';
          else if (hData.isCCP === false) statusText = '<span class="ccp-nav-hazard-status no-ccp">非CCP</span>';
          else if (hData.isCCP === 'modify') statusText = '<span class="ccp-nav-hazard-status" style="background:#fffbeb;color:#d97706;">需修改</span>';
          else statusText = '<span class="ccp-nav-hazard-status pending">待判定</span>';
          
          html += '<div class="ccp-nav-hazard ' + hClass + '" data-nav-hazard="' + si + '" data-nav-ht="' + ht + '">';
          html += '<span class="ccp-nav-hazard-badge">' + hazardLabels[ht] + '</span>';
          html += '<span class="ccp-nav-hazard-label">' + hazardFull[ht] + '</span>';
          html += statusText;
          // 问题点状进度
          var qDots = '';
          for (var qi = 1; qi <= 5; qi++) {
            var dotClass = 'ccp-nav-q-dot';
            if (hData['q' + qi] !== undefined) dotClass += ' answered';
            if (isHazardActive && !isEditMode) {
              var curQ = data.ccpCurrentQ;
              if (qi === curQ || (curQ === 'q2_need' && qi === 2)) dotClass += ' current';
            }
            qDots += '<span class="' + dotClass + '"></span>';
          }
          html += '<span class="ccp-nav-q-dots">' + qDots + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    
    html += '</div></div>';
    return html;
  }

  // ===== 步骤2: 确定关键控制点 - 全新实现 =====
  function renderHazardAnalysis(data) {
    // 初始化状态
    if (!data.ccpPageMode) {
      data.processSteps = [];
      data.ccpSteps = [];
      data.ccpCompleted = false;
      data.ccpPageMode = 'form';
      data.currentEditingStep = -1;
      data.ccpStepIndex = 0;
      data.ccpHazardType = 'bio';
      data.ccpCurrentQ = 1;
      saveData(data);
    }
    
    if (data.ccpPageMode === 'judging') {
      return renderCCPJudgingPage(data);
    } else if (data.ccpPageMode === 'summary') {
      var summaryHtml = renderCcpSummary(data);
      summaryHtml += '<div style="margin-top:16px;"><button class="btn btn-secondary btn-sm" id="summaryBackBtn">返回</button></div>';
      summaryHtml += renderCcpFooter(data);
      return summaryHtml;
    } else {
      return renderStepFormPage(data);
    }
  }
  
  // ===== 步骤填写表单页面 =====
  function renderStepFormPage(data) {
    var editIdx = data.currentEditingStep;
    var stepData = (editIdx >= 0 && editIdx < data.processSteps.length) ? data.processSteps[editIdx] : { stepName: '', equipmentName: '', operationMethod: '', parameters: '' };
    
    var html = '<div class="q15-step-form">';
    html += '<div class="q15-field-group"><label>步骤名称</label><input type="text" id="stepFormName" value="' + esc(stepData.stepName) + '" placeholder="如：清洗"></div>';
    html += '<div class="q15-field-group"><label>设备名称</label><input type="text" id="stepFormEquipment" value="' + esc(stepData.equipmentName) + '" placeholder="如：清洗机"></div>';
    html += '<div class="q15-field-group"><label>操作方法</label><textarea id="stepFormMethod" rows="2" placeholder="描述操作方法">' + esc(stepData.operationMethod) + '</textarea></div>';
    html += '<div class="q15-field-group"><label>工艺参数</label><input type="text" id="stepFormParams" value="' + esc(stepData.parameters) + '" placeholder="如：温度85\u2103，时间15分钟"></div>';
    html += '<button class="btn btn-primary btn-sm" id="stepFormSaveBtn">确认保存</button>';
    html += '</div>';
    
    var savedSteps = data.processSteps || [];
    if (savedSteps.length > 0) {
      html += '<div style="margin-top:20px;"><h3>已添加步骤</h3><ul style="list-style:none;padding:0;margin:8px 0;">';
      savedSteps.forEach(function(s, i) {
        html += '<li style="padding:6px 10px;margin:4px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;" data-step-edit="' + i + '">';
        html += '<span><strong>' + (i + 1) + '. ' + esc(s.stepName || '未命名') + '</strong>';
        if (s.equipmentName) html += ' | 设备: ' + esc(s.equipmentName);
        if (s.operationMethod) html += ' | 方法: ' + esc(s.operationMethod);
        if (s.parameters) html += ' | 参数: ' + esc(s.parameters);
        html += '</span>';
        html += '<button class="btn btn-xs btn-secondary" data-step-delete="' + i + '" style="color:#dc2626;border-color:#fecaca;padding:2px 8px;font-size:12px;flex-shrink:0;">删除</button>';
        html += '</li>';
      });
      html += '</ul></div>';
    } else {
      html += '<p style="color:var(--gray-400);font-size:13px;margin-top:16px;">暂无步骤数据，请填写上方表单并点击确认保存添加步骤。</p>';
    }
    
    html += '<div style="display:flex;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;">';
    html += '<button class="btn btn-primary btn-sm" id="ccpJudgeBtn">CCP判断</button>';
    html += '<button class="btn btn-secondary btn-sm" id="completeStepsBtn">完成</button>';
    html += '</div>';
    
    return html;
  }
  
  // ===== CCP判定流程页面（单个步骤的生物/化学/物理危害判定）=====
  function renderCCPJudgingPage(data) {
    var steps = data.processSteps || [];
    if (steps.length === 0) {
      data.ccpPageMode = 'form';
      saveData(data);
      return renderStepFormPage(data);
    }
    
    var idx = data.ccpStepIndex;
    if (idx >= steps.length) idx = 0;
    var step = steps[idx];
    
    if (!data.ccpSteps) data.ccpSteps = [];
    if (!data.ccpSteps[idx]) {
      data.ccpSteps[idx] = { stepName: step.stepName || '', hazards: {}, completed: false };
    }
    if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
    
    var hazardType = data.ccpHazardType || 'bio';
    var hazardTypes = ['bio', 'chem', 'phys'];
    var hazardFull = { bio: '生物危害', chem: '化学危害', phys: '物理危害' };
    var hazardTypeIdx = hazardTypes.indexOf(hazardType);
    var currentQ = data.ccpCurrentQ || 1;
    var currentHazard = data.ccpSteps[idx].hazards[hazardType] || {};
    
    // 如果当前危害已判定完成，自动跳到下一个
    if (currentHazard.isCCP !== undefined && currentHazard.isCCP !== null) {
      var nextHazardIdx = hazardTypeIdx + 1;
      if (nextHazardIdx < hazardTypes.length) {
        data.ccpHazardType = hazardTypes[nextHazardIdx];
        data.ccpCurrentQ = 1;
        saveData(data);
        return renderCCPJudgingPage(data);
      } else {
        var nextStep = idx + 1;
        if (nextStep < steps.length) {
          data.ccpStepIndex = nextStep;
          data.ccpHazardType = 'bio';
          data.ccpCurrentQ = 1;
          saveData(data);
          return renderCCPJudgingPage(data);
        } else {
          data.ccpCompleted = true;
          data.ccpPageMode = 'form';
          saveData(data);
          return renderStepFormPage(data);
        }
      }
    }
    
    var qTexts = {
      1: 'Q1：该加工步骤是否存在' + hazardFull[hazardType] + '？危害是什么？',
      2: 'Q2：是否存在针对已识别' + hazardFull[hazardType] + '的控制措施？',
      3: 'Q3：该步骤是否经过专门设计，可消除' + hazardFull[hazardType] + '或将其发生的可能性降低至可接受水平？',
      4: 'Q4：该步骤是否会发生' + hazardFull[hazardType] + '污染，或污染水平升高至不可接受的程度？',
      5: 'Q5：后续步骤或操作是否会消除该' + hazardFull[hazardType] + '，或将其降低至可接受水平？'
    };
    
    var html = '<div class="ccp-judging-flow">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
    html += '<span style="color:var(--gray-500);font-size:13px;">步骤' + (idx + 1) + ': ' + esc(step.stepName || '') + ' - ' + hazardFull[hazardType] + ' (' + (hazardTypeIdx + 1) + '/3) 问题' + currentQ + '/5</span>';
    html += '</div>';
    
    if (currentQ === 1) {
      html += '<div class="q15-field-group" style="margin-bottom:12px;">';
      html += '<label>' + qTexts[1] + '</label>';
      html += '<textarea id="ccpHazardDescInput" rows="2" placeholder="请描述该危害">' + esc(currentHazard.hazardDesc || '') + '</textarea>';
      html += '</div>';
      html += '<div style="margin-bottom:12px;">';
      html += '<label class="ccp-radio-inline" style="margin-right:16px;"><input type="radio" name="ccpQAnswer" value="是"' + (currentHazard.q1 === '是' ? ' checked' : '') + '> 存在危害</label>';
      html += '<label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="否"' + (currentHazard.q1 === '否' ? ' checked' : '') + '> 无危害</label>';
      html += '</div>';
    } else if (currentQ === 'q2_need') {
      html += '<div class="q15-field-group"><label>Q2（续）：是否有必要在此步骤进行安全控制？</label></div>';
      html += '<div style="margin-bottom:12px;">';
      html += '<label class="ccp-radio-inline" style="margin-right:16px;"><input type="radio" name="ccpQAnswer" value="是"> 是，需修改后重新评估</label>';
      html += '<label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="否"> 否，非关键控制点</label>';
      html += '</div>';
    } else {
      html += '<div class="q15-field-group" style="margin-bottom:12px;">';
      html += '<label>' + qTexts[currentQ] + '</label>';
      html += '</div>';
      html += '<div style="margin-bottom:12px;">';
      html += '<label class="ccp-radio-inline" style="margin-right:16px;"><input type="radio" name="ccpQAnswer" value="是"' + (currentHazard['q' + currentQ] === '是' ? ' checked' : '') + '> 是</label>';
      html += '<label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="否"' + (currentHazard['q' + currentQ] === '否' ? ' checked' : '') + '> 否</label>';
      html += '</div>';
    }
    
    // 判定路径摘要
    var pathHtml = buildCCPPathSummary(currentHazard);
    
    html += '<div style="display:flex;gap:10px;margin-top:8px;">';
    html += '<button class="btn btn-primary btn-sm" id="ccpAnswerBtn">确定</button>';
    html += '<button class="btn btn-secondary btn-sm" id="ccpJudgingBackBtn">返回</button>';
    html += '</div>';
    
    if (pathHtml) html += pathHtml;
    
    html += '</div>';
    return html;
  }
  
  // ===== CCP判定路径摘要 =====
  function buildCCPPathSummary(hazard) {
    if (!hazard || hazard.q1 === undefined) return '';
    var html = '<div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">';
    html += '<div style="font-weight:500;margin-bottom:6px;">判定路径</div>';
    var qVals = [1, 2, 3, 4, 5];
    var resultText = '';
    for (var qi = 0; qi < qVals.length; qi++) {
      var qn = qVals[qi];
      var qv = hazard['q' + qn];
      if (qv === undefined) break;
      html += '<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:#e2e8f0;border-radius:4px;">Q' + qn + ': ' + qv + '</span>';
      if (qn === 1 && qv === '否') {
        resultText = '非CCP（Q1=否，该危害不存在）';
        break;
      }
      if (qn === 2 && qv === '否') {
        if (hazard.q2_need === '否') resultText = '非CCP（Q2=否且无需控制）';
        else if (hazard.q2_need === '是') resultText = '需修改步骤重新评估';
        break;
      }
      if (qn === 3 && qv === '是') { resultText = 'CCP（Q3=是，步骤可消除危害）'; break; }
      if (qn === 4 && qv === '否') { resultText = '非CCP（Q4=否，无污染风险）'; break; }
      if (qn === 5) {
        resultText = qv === '是' ? '非CCP（Q5=是，后续可消除）' : 'CCP（Q5=否，后续无法消除）';
        break;
      }
    }
    if (resultText) {
      var isCCPResult = resultText.indexOf('CCP') !== -1 && resultText.indexOf('非') === -1 && resultText.indexOf('需修改') === -1;
      var isModify = resultText.indexOf('需修改') !== -1;
      var color = isCCPResult ? '#dc2626' : (isModify ? '#d97706' : '#16a34a');
      html += '<div style="margin-top:8px;padding:8px 12px;background:' + (isCCPResult ? '#fef2f2' : isModify ? '#fffbeb' : '#f0fdf4') + ';border:1px solid ' + color + ';border-radius:6px;color:' + color + ';font-weight:500;">';
      html += '判定结果：' + resultText;
      html += '</div>';
      
      var isLastHazard = data && data.ccpHazardType;
      var hazardTypes = ['bio', 'chem', 'phys'];
      var hazardTypeIdx = isLastHazard ? hazardTypes.indexOf(isLastHazard) : -1;
      var isLast = hazardTypeIdx >= hazardTypes.length - 1;
      var nextLabel = isLast ? '完成' : '下一步';
      
      html += '<button class="btn btn-primary btn-sm" id="ccpNextHazardBtn" style="margin-top:10px;">' + nextLabel + '</button>';
    }
    html += '</div>';
    return html;
  }
  
  // ===== 渲染完成判定后的视图 =====
  function renderJudgmentDoneView(data) {
    data.ccpPageMode = 'form';
    saveData(data);
    return renderStepFormPage(data);
  }
  
  function moveToNextJudgmentStep(data, idx, hazardType, hazardTypes) {
    var hazardTypeIdx = hazardTypes.indexOf(hazardType);
    var nextHazardIdx = hazardTypeIdx + 1;
    if (nextHazardIdx < hazardTypes.length) {
      data.ccpHazardType = hazardTypes[nextHazardIdx];
      data.ccpCurrentQ = 1;
      saveData(data);
      return true;
    }
    var nextStep = idx + 1;
    var steps = data.processSteps || [];
    if (nextStep < steps.length) {
      data.ccpStepIndex = nextStep;
      data.ccpHazardType = 'bio';
      data.ccpCurrentQ = 1;
      saveData(data);
      return true;
    }
    return false;
  }

  // ===== 统一CCP判定表格（所有步骤、所有危害、所有问题在同一界面）=====
  function renderUnifiedCcpTable(data, steps) {
    // 确保ccpSteps已初始化
    if (!data.ccpSteps) data.ccpSteps = [];
    var hazardTypes = ['bio', 'chem', 'phys'];
    var hazardLabels = { bio: 'B', chem: 'C', phys: 'P' };
    var hazardFull = { bio: '生物危害', chem: '化学危害', phys: '物理危害' };
    var qLabels = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4', 5: 'Q5' };
    
    // 初始化所有步骤的ccpStep数据
    steps.forEach(function(step, si) {
      if (!data.ccpSteps[si]) {
        data.ccpSteps[si] = { stepName: step.stepName || '', hazards: {}, completed: false };
      }
      if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
      hazardTypes.forEach(function(ht) {
        if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
      });
    });
    
    var html = '<div class="ccp-unified-info">';
    html += '💡 在下方表格中为每个步骤的每种危害进行CCP判定。点击「是/否」选择答案，系统自动计算判定结果。';
    html += '</div>';
    
    html += '<div class="ccp-unified-wrapper">';
    html += '<table class="ccp-unified-table">';
    html += '<thead><tr>';
    html += '<th style="min-width:100px;">加工步骤</th>';
    html += '<th style="min-width:70px;">危害</th>';
    html += '<th style="min-width:120px;">危害描述</th>';
    html += '<th style="width:70px;">Q1<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">是否存在危害</span></th>';
    html += '<th style="width:70px;">Q2<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">是否有控制措施</span></th>';
    html += '<th style="width:70px;">Q2.1<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">是否需要控制</span></th>';
    html += '<th style="width:70px;">Q3<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">可消除危害</span></th>';
    html += '<th style="width:70px;">Q4<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">污染升高</span></th>';
    html += '<th style="width:70px;">Q5<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">后续消除</span></th>';
    html += '<th style="min-width:80px;">判定结果</th>';
    html += '</tr></thead><tbody>';
    
    steps.forEach(function(step, si) {
      hazardTypes.forEach(function(ht, hi) {
        var hData = data.ccpSteps[si].hazards[ht] || {};
        var rowClass = (hi === 0) ? '' : '';
        if (hi === 0) {
          html += '<tr class="step-group-header"><td colspan="10">步骤 ' + (si + 1) + '：' + esc(step.stepName || '未命名') + '</td></tr>';
        }
        
        // 危害描述 
        var descVal = hData.hazardDesc || '';
        
        // 各问题的值
        var q1Val = hData.q1 || '';
        var q2Val = hData.q2 || '';
        var q2needVal = hData.q2_need || '';
        var q3Val = hData.q3 || '';
        var q4Val = hData.q4 || '';
        var q5Val = hData.q5 || '';
        
        // 判定结果
        var isCCP = hData.isCCP;
        var resultClass = 'pending';
        var resultText = '待判定';
        if (isCCP === true) { resultClass = 'is-ccp'; resultText = '是 (CCP)'; }
        else if (isCCP === false) { resultClass = 'no-ccp'; resultText = '否'; }
        else if (isCCP === 'modify') { resultClass = 'modify'; resultText = '需修改'; }
        
        html += '<tr data-ut-row="' + si + '-' + ht + '">';
        // 步骤名称
        html += '<td class="ccp-ut-step">' + (hi === 1 ? '' : esc(step.stepName || '')) + '</td>';
        // 危害类型
        html += '<td><span class="ccp-ut-hazard-badge ' + ht + '">' + hazardLabels[ht] + '</span><span class="ccp-ut-hazard-label">' + hazardFull[ht] + '</span></td>';
        // 危害描述 (Q1文本域)
        html += '<td><textarea class="ccp-ut-desc-input" data-ut-field="hazardDesc" data-ut-si="' + si + '" data-ut-ht="' + ht + '" rows="2" placeholder="描述危害...">' + esc(descVal) + '</textarea></td>';
        
        // Q1: 是否存在危害
        html += '<td>' + renderYesNoBtns(si, ht, 'q1', q1Val) + '</td>';
        // Q2: 是否有控制措施
        html += '<td>' + renderYesNoBtns(si, ht, 'q2', q2Val) + '</td>';
        // Q2_need: 是否需要控制(Q2=否时显示)
        html += '<td>' + (q2Val === '否' ? renderYesNoBtns(si, ht, 'q2_need', q2needVal) : '<span style="color:var(--gray-300);font-size:11px;">—</span>') + '</td>';
        // Q3: 可消除危害
        html += '<td>' + (q1Val === '是' && q2Val === '是' ? renderYesNoBtns(si, ht, 'q3', q3Val) : '<span style="color:var(--gray-300);font-size:11px;">—</span>') + '</td>';
        // Q4: 污染升高
        html += '<td>' + (q1Val === '是' && q2Val === '是' && q3Val === '否' ? renderYesNoBtns(si, ht, 'q4', q4Val) : '<span style="color:var(--gray-300);font-size:11px;">—</span>') + '</td>';
        // Q5: 后续消除
        html += '<td>' + (q1Val === '是' && q2Val === '是' && q3Val === '否' && q4Val === '是' ? renderYesNoBtns(si, ht, 'q5', q5Val) : '<span style="color:var(--gray-300);font-size:11px;">—</span>') + '</td>';
        // 判定结果
        html += '<td><span class="ccp-ut-result ' + resultClass + '">' + resultText + '</span></td>';
        html += '</tr>';
      });
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    // 操作按钮
    html += '<div class="ccp-unified-actions">';
    html += '<button class="btn btn-primary btn-sm" id="ccpUnifiedSaveBtn">💾 保存判定结果</button>';
    html += '<button class="btn btn-secondary btn-sm" id="ccpUnifiedFinishBtn">✅ 完成所有判定</button>';
    html += '</div>';
    
    return html;
  }
  
  // 渲染是/否单选按钮
  function renderYesNoBtns(si, ht, field, value) {
    var name = 'ut_' + si + '_' + ht + '_' + field;
    var yesClass = value === '是' ? 'selected-yes' : '';
    var noClass = value === '否' ? 'selected-no' : '';
    return '<div class="ccp-ut-yn">' +
      '<label class="' + yesClass + '"><input type="radio" name="' + name + '" value="是" data-ut-si="' + si + '" data-ut-ht="' + ht + '" data-ut-field="' + field + '"' + (value === '是' ? ' checked' : '') + '> 是</label>' +
      '<label class="' + noClass + '"><input type="radio" name="' + name + '" value="否" data-ut-si="' + si + '" data-ut-ht="' + ht + '" data-ut-field="' + field + '"' + (value === '否' ? ' checked' : '') + '> 否</label>' +
      '</div>';
  }

  function renderSingleCcpStep(data, steps) {
    var idx = data.ccpStepIndex;
    if (idx >= steps.length) { data.ccpCompleted = true; saveData(data); return renderCcpSummary(data) + renderCcpFooter(data); }
    var step = steps[idx];
    // 初始化ccpSteps
    if (!data.ccpSteps) data.ccpSteps = [];
    if (!data.ccpSteps[idx]) {
      data.ccpSteps[idx] = { stepName: step.stepName || '', hazards: {}, completed: false };
    }
    if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
    // 当前危害类型
    var hazardType = data.ccpHazardType || 'bio';
    var hazardTypes = ['bio', 'chem', 'phys'];
    var hazardLabels = { bio: '生物危害(B)', chem: '化学危害(C)', phys: '物理危害(P)' };
    var hazardTypeIdx = hazardTypes.indexOf(hazardType);
    // 获取当前危害数据
    var currentHazard = data.ccpSteps[idx].hazards[hazardType] || {};
    // 问题文本 (5问题版本)
    var qTexts = {
      1: 'Q1：该加工步骤是否存在危害？危害是什么？',
      2: 'Q2：是否存在针对已识别危害的控制措施？',
      3: 'Q3：该步骤是否经过专门设计，可消除危害或将其发生的可能性降低至可接受水平？',
      4: 'Q4：该步骤是否会发生污染，或污染水平升高至不可接受的程度？',
      5: 'Q5：后续步骤或操作是否会消除该危害，或将其降低至可接受水平？'
    };
    var qHelps = {
      1: '请列出该加工步骤可能存在的生物/化学/物理危害',
      2: '（例如：是否有SOP、工艺参数控制、设备防护等措施）',
      3: '（例如：金属检测器专门设计用于去除金属异物）',
      4: '（例如：清洗不彻底可能导致微生物交叉污染）',
      5: '（例如：后道杀菌工序可消除微生物危害）'
    };
    var currentQ = data.ccpCurrentQ || 1;
    // 如果当前危害已完成判定(isCCP!==null)，跳到下一个
    if (currentHazard.isCCP !== undefined && currentHazard.isCCP !== null) {
      var nextHazardIdx = hazardTypeIdx + 1;
      if (nextHazardIdx < hazardTypes.length) {
        data.ccpHazardType = hazardTypes[nextHazardIdx];
        data.ccpCurrentQ = 1;
        saveData(data);
        return renderSingleCcpStep(data, steps);
      } else {
        data.ccpSteps[idx].completed = true;
        var nextStep = idx + 1;
        if (nextStep < steps.length) {
          data.ccpStepIndex = nextStep;
          data.ccpHazardType = 'bio';
          data.ccpCurrentQ = 1;
          saveData(data);
          return renderSingleCcpStep(data, steps);
        } else {
          data.ccpCompleted = true;
          saveData(data);
          return renderCcpSummary(data) + renderCcpFooter(data);
        }
      }
    }
    // 构建危害提示
    var stepHazardDesc = '';
    if (hazardType === 'bio') {
      stepHazardDesc = '该步骤可能存在的生物危害：微生物污染、细菌滋生、霉菌毒素等';
    } else if (hazardType === 'chem') {
      stepHazardDesc = '该步骤可能存在的化学危害：农药残留、重金属、添加剂违规使用等';
    } else if (hazardType === 'phys') {
      stepHazardDesc = '该步骤可能存在的物理危害：金属碎片、玻璃渣、石子、塑料片等';
    }

    // 判断当前问题是否已回答
    var answered = false;
    var selectedVal = '';
    if (currentQ === 1) {
      if (currentHazard.q1 !== undefined) { answered = true; selectedVal = currentHazard.q1; }
    } else if (currentQ === 2) {
      if (currentHazard.q2 !== undefined) { answered = true; selectedVal = currentHazard.q2; }
    } else if (currentQ === 3) {
      if (currentHazard.q3 !== undefined) { answered = true; selectedVal = currentHazard.q3; }
    } else if (currentQ === 4) {
      if (currentHazard.q4 !== undefined) { answered = true; selectedVal = currentHazard.q4; }
    } else if (currentQ === 5) {
      if (currentHazard.q5 !== undefined) { answered = true; selectedVal = currentHazard.q5; }
    }

    var qHtml = '<div class="ccp-decision-tree">';
    qHtml += '<div class="ccp-dt-header">';
    qHtml += '<span class="ccp-dt-step">步骤 ' + (idx + 1) + '：' + esc(step.stepName || '未命名') + '</span>';
    qHtml += '<span class="ccp-dt-hazard-type">' + hazardLabels[hazardType] + '判定 (' + (hazardTypeIdx + 1) + '/3)</span>';
    qHtml += '</div>';
    qHtml += '<div class="ccp-dt-hazard-desc">潜在危害提示：' + stepHazardDesc + '</div>';

    // Q1特殊：显示危害描述输入框
    if (currentQ === 1) {
      var hazardDescVal = currentHazard.hazardDesc || '';
      qHtml += '<div class="ccp-dt-question">';
      qHtml += '<div class="ccp-dt-q-text">' + qTexts[1] + '</div>';
      qHtml += '<div class="ccp-dt-q-help">' + qHelps[1] + '</div>';
      qHtml += '<textarea class="ccp-dt-textarea" id="ccpHazardDescInput" placeholder="请描述该步骤存在的具体危害..." rows="3">' + esc(hazardDescVal) + '</textarea>';
      qHtml += '<div class="ccp-dt-options">';
      qHtml += '<label class="ccp-dt-option' + (selectedVal === '是' ? ' selected' : '') + '"><input type="radio" name="ccpQAnswer" value="是"' + (selectedVal === '是' ? ' checked' : '') + '> <span>有危害</span></label>';
      qHtml += '<label class="ccp-dt-option' + (selectedVal === '否' ? ' selected' : '') + '"><input type="radio" name="ccpQAnswer" value="否"' + (selectedVal === '否' ? ' checked' : '') + '> <span>无危害</span></label>';
      qHtml += '</div>';
      qHtml += '<div class="ccp-dt-actions">';
      qHtml += '<button class="btn btn-primary btn-sm" id="ccpAnswerBtn">确认回答</button>';
      qHtml += '</div></div>';
    } else if (currentQ === 'q2_need') {
      // Q2子判断：是否有必要在此步骤进行安全控制
      qHtml += '<div class="ccp-dt-question">';
      qHtml += '<div class="ccp-dt-q-text">Q2（续）：是否有必要在此步骤进行安全控制？</div>';
      qHtml += '<div class="ccp-dt-q-help">（若选"是"，需修改步骤、工艺或产品后重新评估；选"否"则判定为非CCP）</div>';
      qHtml += '<div class="ccp-dt-options">';
      qHtml += '<label class="ccp-dt-option"><input type="radio" name="ccpQAnswer" value="是"> <span>是，需修改后重新评估</span></label>';
      qHtml += '<label class="ccp-dt-option"><input type="radio" name="ccpQAnswer" value="否"> <span>否，非关键控制点</span></label>';
      qHtml += '</div>';
      qHtml += '<div class="ccp-dt-actions">';
      qHtml += '<button class="btn btn-primary btn-sm" id="ccpQ2NeedBtn">确认</button>';
      qHtml += '</div></div>';
    } else {
      // 普通问题 Q2-Q5
      qHtml += '<div class="ccp-dt-question">';
      qHtml += '<div class="ccp-dt-q-text">' + qTexts[currentQ] + '</div>';
      qHtml += '<div class="ccp-dt-q-help">' + (qHelps[currentQ] || '') + '</div>';
      qHtml += '<div class="ccp-dt-options">';
      qHtml += '<label class="ccp-dt-option' + (selectedVal === '是' ? ' selected' : '') + '"><input type="radio" name="ccpQAnswer" value="是"' + (selectedVal === '是' ? ' checked' : '') + '> <span>是</span></label>';
      qHtml += '<label class="ccp-dt-option' + (selectedVal === '否' ? ' selected' : '') + '"><input type="radio" name="ccpQAnswer" value="否"' + (selectedVal === '否' ? ' checked' : '') + '> <span>否</span></label>';
      qHtml += '</div>';
      qHtml += '<div class="ccp-dt-actions">';
      if (!answered) {
        qHtml += '<button class="btn btn-primary btn-sm" id="ccpAnswerBtn">确认回答</button>';
      } else {
        qHtml += '<button class="btn btn-primary btn-sm" id="ccpNextQBtn">下一步</button>';
      }
      qHtml += '</div></div>';
    }

    // 判定路径摘要
    if (currentHazard.q1 !== undefined) {
      qHtml += '<div class="ccp-dt-summary">';
      qHtml += '<h4>判定路径</h4>';
      var pathItems = [];
      var qVals = [1,2,3,4,5];
      for (var qi = 0; qi < qVals.length; qi++) {
        var qn = qVals[qi];
        var qv = currentHazard['q' + qn];
        if (qv !== undefined) {
          pathItems.push('<span class="ccp-dt-path-step">Q' + qn + '：' + qv + '</span>');
          // 根据决策树显示分支结果
          if (qn === 1 && qv === '否') {
            pathItems.push('<span class="ccp-dt-path-result no-ccp">→ 非CCP（Q1=否，该危害不存在）</span>');
            break;
          }
          if (qn === 2 && qv === '否') {
            if (currentHazard.q2_need === '否') {
              pathItems.push('<span class="ccp-dt-path-result no-ccp">→ 非CCP（Q2=否且无需控制）</span>');
            } else if (currentHazard.q2_need === '是') {
              pathItems.push('<span class="ccp-dt-path-result is-ccp">→ 需修改步骤/工艺/产品，返回Q2重新评估</span>');
            }
            break;
          }
          if (qn === 3 && qv === '是') {
            pathItems.push('<span class="ccp-dt-path-result is-ccp">→ CCP（Q3=是，步骤可消除危害）</span>');
            break;
          }
          if (qn === 4 && qv === '否') {
            pathItems.push('<span class="ccp-dt-path-result no-ccp">→ 非CCP（Q4=否，无污染风险）</span>');
            break;
          }
          if (qn === 5) {
            if (qv === '是') pathItems.push('<span class="ccp-dt-path-result no-ccp">→ 非CCP（Q5=是，后续可消除危害）</span>');
            else pathItems.push('<span class="ccp-dt-path-result is-ccp">→ CCP（Q5=否，后续无法消除危害）</span>');
          }
        } else {
          break;
        }
      }
      qHtml += pathItems.join('<br>');
      qHtml += '</div>';
    }

    // 判定结果
    if (currentHazard.isCCP !== undefined && currentHazard.isCCP !== null) {
      var isCCPVal = currentHazard.isCCP;
      var ccpLabel = isCCPVal === true ? '是 - 关键控制点(CCP)' : (isCCPVal === 'modify' ? '需修改后重新评估' : '否 - 非关键控制点');
      var ccpColor = isCCPVal === true ? '#dc2626' : (isCCPVal === 'modify' ? '#d97706' : '#16a34a');
      var ccpBg = isCCPVal === true ? '#fef2f2' : (isCCPVal === 'modify' ? '#fffbeb' : '#f0fdf4');
      qHtml += '<div class="ccp-dt-final" style="background:' + ccpBg + ';border:1px solid ' + ccpColor + ';color:' + ccpColor + ';">';
      qHtml += '✅ ' + hazardLabels[hazardType] + '判定结果：<strong>' + ccpLabel + '</strong>';
      qHtml += '</div>';
      // 如果需修改，显示修改后重新评估按钮
      if (isCCPVal === 'modify') {
        qHtml += '<div class="ccp-dt-actions" style="margin-top:12px;"><button class="btn btn-primary btn-sm" id="ccpResetQ2Btn">修改完成，重新评估Q2</button></div>';
      }
    }

    qHtml += '</div>'; // .ccp-decision-tree close

    var isFirstPosition = (idx === 0 && hazardType === 'bio' && currentQ === 1);
    var prevBtn = !isFirstPosition ? '<button class="btn btn-sm btn-secondary" id="ccpPrevStepBtn" style="margin-right:auto;">← 上一步</button>' : '';
    var maxQ = 5;
    var qnumStr = currentQ === 'q2_need' ? 'Q2子判断' : '问题 ' + currentQ + '/' + maxQ + '（' + hazardLabels[hazardType] + ' ' + (hazardTypeIdx + 1) + '/3）';

    return '<div id="ccpStepContainer">' +
      '<div style="display:flex;align-items:center;margin-bottom:12px;">' + prevBtn +
      '<span class="q15-step-indicator" style="margin:0 auto;">步骤 ' + (idx + 1) + ' / ' + steps.length + ' — ' + qnumStr + '</span></div>' +
      qHtml + '</div>';
  }

  // ===== CCP 步骤编辑视图（在CCP流程中编辑步骤信息）=====
  function renderCcpStepEditor(data, steps, editIdx) {
    if (editIdx < 0 || editIdx >= steps.length) editIdx = steps.length - 1;
    var step = steps[editIdx];
    if (!step) return '<p>步骤数据不存在</p>';
    
    var html = '<div class="ccp-step-editor">';
    html += '<h3>✏️ 编辑步骤 ' + (editIdx + 1) + '：' + esc(step.stepName || '未命名') + '</h3>';
    html += '<p class="q15-table-hint">在此处修改本步骤的基本信息，修改完成后返回CCP判定</p>';
    
    // 步骤卡片编辑器
    html += '<div class="q15-process-card" data-ps-idx="' + editIdx + '" id="ccpEditStepCard">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    html += '<div class="q15-field-group"><label>步骤名称</label><input type="text" class="ccp-edit-input" data-ps-field="stepName" value="' + esc(step.stepName || '') + '"></div>';
    html += '<div class="q15-field-group"><label>设备名称</label><input type="text" class="ccp-edit-input" data-ps-field="equipmentName" value="' + esc(step.equipmentName || '') + '"></div>';
    html += '</div>';
    html += '<div class="q15-field-group"><label>操作方法</label><textarea class="ccp-edit-input" data-ps-field="operationMethod" rows="2">' + esc(step.operationMethod || '') + '</textarea></div>';
    html += '<div class="q15-field-group"><label>工艺参数</label><input type="text" class="ccp-edit-input" data-ps-field="parameters" value="' + esc(step.parameters || '') + '"></div>';
    html += '<div class="q15-field-group"><label>控制点标识</label><input type="text" class="ccp-edit-input" data-ps-field="controlPoint" value="' + esc(step.controlPoint || '') + '" placeholder="如：CCP-1"></div>';
    html += '</div>';
    
    // 操作按钮
    html += '<div class="ccp-step-editor-actions">';
    html += '<button class="btn btn-primary btn-sm" id="ccpEditSaveBtn">💾 保存修改</button>';
    html += '<button class="btn btn-secondary btn-sm" id="ccpEditDeleteBtn" style="color:#dc2626;border-color:#fecaca;">🗑️ 删除此步骤</button>';
    html += '<button class="btn btn-secondary btn-sm" id="ccpEditBackToJudgeBtn">← 返回CCP判定</button>';
    html += '</div>';
    
    html += '</div>';
    return html;
  }

  function getStepHazards(data, stepName) {
    var results = [];
    if (!stepName) return results;
    ['hazardBio', 'hazardChem', 'hazardPhys'].forEach(function(key) {
      var arr = data[key] || [];
      arr.forEach(function(h) {
        if (h.desc && h.desc.indexOf(stepName) !== -1) results.push(h);
        else if (h.material && stepName.indexOf(h.material) !== -1) results.push(h);
      });
    });
    return results;
  }

  function renderCcpSummary(data) {
    var steps = data.ccpSteps || [];
    if (steps.length === 0) return '<p style="color:var(--gray-400);text-align:center;padding:20px;">暂无CCP判定数据</p>';
    var hazardLabels = { bio: 'B', chem: 'C', phys: 'P' };
    var hazardFull = { bio: '生物危害', chem: '化学危害', phys: '物理危害' };
    var hazardTypes = ['bio', 'chem', 'phys'];
    var rows = [];
    steps.forEach(function(s, si) {
      if (!s.hazards) {
        rows.push('<tr><td style="text-align:center;vertical-align:middle;">' + esc(s.stepName || '步骤' + (si+1)) + '</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>');
        return;
      }
      var stepName = esc(s.stepName || '步骤' + (si+1));
      hazardTypes.forEach(function(ht, hi) {
        var h = s.hazards[ht] || {};
        var hazardDesc = hazardLabels[ht] + ':' + hazardFull[ht];
        var hd = h.hazardDesc || '';
        var q1 = h.q1 || '-';
        var q2 = h.q2 || '-';
        var q3 = h.q3 || '-';
        var q4 = h.q4 || '-';
        var q5 = h.q5 || '-';
        var isCCP = '';
        if (h.isCCP === true) isCCP = '是(CCP)';
        else if (h.isCCP === false) isCCP = '否';
        else if (h.isCCP === 'modify') isCCP = '需修改';
        else isCCP = '未判定';
        if (hi === 0) {
          rows.push('<tr><td rowspan="3" style="text-align:center;vertical-align:middle;">' + stepName + '</td><td>' + hazardDesc + (hd ? '<br><span style="font-size:11px;color:#666;">' + esc(hd) + '</span>' : '') + '</td><td>' + q1 + '</td><td>' + q2 + '</td><td>' + q3 + '</td><td>' + q4 + '</td><td>' + q5 + '</td><td>' + isCCP + '</td></tr>');
        } else {
          rows.push('<tr><td>' + hazardDesc + (hd ? '<br><span style="font-size:11px;color:#666;">' + esc(hd) + '</span>' : '') + '</td><td>' + q1 + '</td><td>' + q2 + '</td><td>' + q3 + '</td><td>' + q4 + '</td><td>' + q5 + '</td><td>' + isCCP + '</td></tr>');
        }
      });
    });
    return '<h3 style="margin-bottom:12px;">CCP判定汇总表</h3>' +
      '<table class="q15-table"><thead><tr><th>加工步骤</th><th>潜在危害</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q5</th><th>是否为CCP</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  }

  function renderCcpFooter(data) {
    return '<hr class="q15-divider"><h3>流程图编辑 <span style="font-size:13px;font-weight:400;color:var(--gray-400);">使用 draw.io 绘制生产流程图</span></h3><p class="q15-table-hint">通过 draw.io 在线编辑器绘制专业的生产工艺流程图，直观展示各生产步骤的顺序关系</p><div class="q15-flowchart-area" id="flowchartArea">' + renderFlowchartPreview(data) + '</div><hr class="q15-divider"><h3>流程图现场确认</h3><div class="q15-confirm-box"><label class="q15-checkbox-label"><input type="checkbox" data-q15-field="flowConfirmed"' + (data.flowConfirmed ? ' checked' : '') + '> HACCP小组已到生产现场，对以上流程图的每一步进行核对确认，确保与实际操作完全一致</label><p style="font-size:12px;color:var(--gray-400);margin-top:6px;">（确认内容包括：是否有额外的原料添加、步骤合并等）</p></div>';
  }

  function renderCriticalLimits(data) {
    return '<p class="q15-table-hint">得到关键控制点CCP以后，根据用户选择的执行标准，系统将提出相应的关键限制的设立。需要有科学依据（如法规标准、文献数据、实验验证结果）</p><div class="q15-field-group"><label>选择执行标准 <span class="required">*</span></label><select data-q15-field="execStandard"><option value="">请选择</option><option value="gb"' + (data.execStandard === 'gb' ? ' selected' : '') + '>国标（GB）</option><option value="industry"' + (data.execStandard === 'industry' ? ' selected' : '') + '>行业标准</option><option value="enterprise"' + (data.execStandard === 'enterprise' ? ' selected' : '') + '>企业标准</option><option value="international"' + (data.execStandard === 'international' ? ' selected' : '') + '>国际标准</option></select></div><div class="q15-ai-btn-wrapper"><button class="btn btn-secondary btn-sm" id="aiCriticalBtn">\u{1F916} AI建议关键限制</button><span id="aiCriticalHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div><div id="aiCriticalResult" style="margin-top:12px;"></div><div class="q15-field-group"><label>关键限制说明</label><textarea data-q15-field="criticalLimits" rows="5" placeholder="描述关键限制的科学依据和具体数值">' + esc(data.criticalLimits) + '</textarea></div>';
  }

  function renderMonitoring(data) {
    return '<h3>监控程序设置</h3><p class="q15-table-hint">AI根据危害的严重性、发生概率、法规要求、企业历史数据给出建议</p><div class="q15-ai-btn-wrapper" style="margin-bottom:12px;"><button class="btn btn-secondary btn-sm" id="aiMonitorBtn">\u{1F916} AI规划监控方案</button><span id="aiMonitorHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div><table class="q15-table"><thead><tr><th>关键控制点(CCP)</th><th>监控对象</th><th>监控方法</th><th>监控频率</th><th>监控人员</th><th>备注</th><th style="width:50px">操作</th></tr></thead><tbody id="monitorBody">' + data.monitoring.map(function(m, i) { return '<tr data-mn-idx="' + i + '"><td><input type="text" value="' + esc(m.ccp) + '" placeholder="如：CCP-3杀菌工序"></td><td><input type="text" value="' + esc(m.object) + '" placeholder="杀菌的温度、时间"></td><td><input type="text" value="' + esc(m.method) + '" placeholder="推荐：在线温度传感器连续监控"></td><td><input type="text" value="' + esc(m.frequency) + '" placeholder="如：每批次实时记录"></td><td><input type="text" value="' + esc(m.personnel) + '" placeholder="经过HACCP培训的品控专员"></td><td><input type="text" value="' + esc(m.remark) + '" placeholder="依据 GB 14881-2013"></td><td><button class="q15-del-row" data-mn-idx="' + i + '">&times;</button></td></tr>'; }).join('') + '</tbody></table><button class="btn btn-sm btn-secondary" id="addMonitorRow">+ 添加监控项</button>';
  }

  function renderCorrective(data) {
    return '<h3>纠偏措施</h3><p class="q15-table-hint">根据偏差的实际情况，系统给出相应的验证措施建议。数据不满足关键限制的设定，即刻采取纠偏计划</p><table class="q15-table"><thead><tr><th>关键控制点(CCP)</th><th>关键限值(CL)</th><th>纠偏措施</th><th>验证</th><th>记录</th><th style="width:50px">操作</th></tr></thead><tbody id="correctiveBody">' + data.correctiveActions.map(function(c, i) { return '<tr data-ca-idx="' + i + '"><td><input type="text" value="' + esc(c.ccp) + '" placeholder="如：杀菌工序"></td><td><input type="text" value="' + esc(c.cl) + '" placeholder="如：90\u2103"></td><td><input type="text" value="' + esc(c.corrective) + '" placeholder="纠偏措施"></td><td><input type="text" value="' + esc(c.verification) + '" placeholder="验证方法"></td><td><input type="text" value="' + esc(c.record) + '" placeholder="记录表格"></td><td><button class="q15-del-row" data-ca-idx="' + i + '">&times;</button></td></tr>'; }).join('') + '</tbody></table><button class="btn btn-sm btn-secondary" id="addCorrectiveRow">+ 添加纠偏项</button>';
  }

  function renderVerification(data) {
    return '<div class="q15-field-group"><label>验证方法</label><textarea data-q15-field="verificationMethod" rows="4" placeholder="描述验证程序的方法，如：\n1. 每批次对CCP监控记录进行审核\n2. 每周对纠偏记录进行回顾\n3. 每月进行成品抽样检测\n4. 每季度进行环境微生物监测">' + (data.verificationMethod || '') + '</textarea></div><div class="q15-field-group"><label>验证频率</label><input type="text" data-q15-field="verificationFrequency" value="' + (data.verificationFrequency || '') + '" placeholder="如：每日、每周、每批次"></div><div class="q15-field-group"><label>验证人员</label><input type="text" data-q15-field="verificationPersonnel" value="' + (data.verificationPersonnel || '') + '" placeholder="如：HACCP小组组长、品控主管"></div><div class="q15-confirm-box" style="margin-top:16px;"><label class="q15-checkbox-label"><input type="checkbox" data-q15-field="verificationConfirmed"' + (data.verificationConfirmed ? ' checked' : '') + '> 验证程序已完成确认</label></div>';
  }

  function renderRecordKeeping(data) {
    return '<div class="q15-field-group"><label>记录保存期限</label><input type="text" data-q15-field="recordPeriod" value="' + esc(data.recordPeriod) + '" placeholder="如：2年"></div><div class="q15-field-group"><label>记录格式要求</label><textarea data-q15-field="recordFormat" rows="3" placeholder="描述记录格式要求，如：电子版、纸质版">' + esc(data.recordFormat) + '</textarea></div><div class="q15-records-summary"><h3>配套监控记录表格</h3><p class="q15-table-hint">AI自动汇总监控数据，纠偏记录，生成标准化的报表，减轻人工记录的负担</p><div class="q15-record-cards"><div class="q15-record-card"><div class="q15-record-icon">\u{1F4CB}</div><h4>监控记录表</h4><p>记录各项关键控制点的监控数据</p></div><div class="q15-record-card"><div class="q15-record-icon">\u{1F4CA}</div><h4>纠偏记录表</h4><p>记录偏差情况及采取的纠偏措施</p></div><div class="q15-record-card"><div class="q15-record-icon">\u{1F4C4}</div><h4>验证记录表</h4><p>记录验证活动的执行情况</p></div><div class="q15-record-card"><div class="q15-record-icon">\u{1F4D1}</div><h4>综合报表</h4><p>AI生成标准化HACCP综合报表</p></div></div><div class="q15-export-actions"><button class="btn btn-secondary btn-sm" id="exportTableBtn" style="margin-top:10px;">\u{1F4E5} 导出空白记录表格</button></div></div>';
  }

  // ==================== 事件绑定 ====================
  function bindSectionEvents(content, data) {
    const addTeamBtn = content.querySelector('#addTeamRow');
    if (addTeamBtn) { addTeamBtn.addEventListener('click', function() { data.haccpTeam.push({ id: genId(), name: '', dept: '', position: '', role: '', remark: '' }); saveData(data); renderActiveSection(); renderSectionNav(); }); }
    content.querySelectorAll('#teamBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.teamIdx); if (data.haccpTeam.length > 1) { data.haccpTeam.splice(idx, 1); saveData(data); renderActiveSection(); renderSectionNav(); } }); });
    content.querySelectorAll('#teamBody input').forEach(function(el) { el.addEventListener('input', function() { var row = this.closest('tr'), idx = parseInt(row.dataset.teamIdx), inputs = row.querySelectorAll('input'); if (data.haccpTeam[idx]) { data.haccpTeam[idx].name = inputs[0].value; data.haccpTeam[idx].dept = inputs[1].value; data.haccpTeam[idx].position = inputs[2].value; data.haccpTeam[idx].role = inputs[3].value; data.haccpTeam[idx].remark = inputs[4].value; saveData(data); } }); });

    const addExtraBtn = content.querySelector('#addExtraItemRow');
    if (addExtraBtn) { addExtraBtn.addEventListener('click', function() { data.extraItems.push({ id: genId(), key: '', value: '' }); saveData(data); renderActiveSection(); renderSectionNav(); }); }
    content.querySelectorAll('#extraItemsBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.exIdx); if (data.extraItems.length > 0) { data.extraItems.splice(idx, 1); saveData(data); renderActiveSection(); renderSectionNav(); } }); });
    content.querySelectorAll('#extraItemsBody input').forEach(function(el) { el.addEventListener('input', function() { collectSectionData(content, data); saveData(data); }); });

    const addProductExtraBtn = content.querySelector('#addProductExtraItemRow');
    if (addProductExtraBtn) { addProductExtraBtn.addEventListener('click', function() { data.productExtraItems.push({ id: genId(), key: '', value: '' }); saveData(data); renderActiveSection(); renderSectionNav(); }); }
    content.querySelectorAll('#productExtraItemsBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.pExIdx); if (data.productExtraItems.length > 0) { data.productExtraItems.splice(idx, 1); saveData(data); renderActiveSection(); renderSectionNav(); } }); });
    content.querySelectorAll('#productExtraItemsBody input').forEach(function(el) { el.addEventListener('input', function() { collectSectionData(content, data); saveData(data); }); });

    const addFormulaBtn = content.querySelector('#addFormulaRow');
    if (addFormulaBtn) { addFormulaBtn.addEventListener('click', function() { data.formula.push({ id: genId(), material: '', dosage: '', func: '' }); saveData(data); renderActiveSection(); }); }
    content.querySelectorAll('#formulaBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.fmIdx); if (data.formula.length > 1) { data.formula.splice(idx, 1); saveData(data); renderActiveSection(); } }); });
    content.querySelectorAll('#formulaBody input').forEach(function(el) { el.addEventListener('input', function() { var row = this.closest('tr'), idx = parseInt(row.dataset.fmIdx), inputs = row.querySelectorAll('input'); if (data.formula[idx]) { data.formula[idx].material = inputs[0].value; data.formula[idx].dosage = inputs[1].value; data.formula[idx].func = inputs[2].value; saveData(data); } }); });

    const addStepBtn = content.querySelector('#addProcessStep');
    if (addStepBtn) { addStepBtn.addEventListener('click', function() { data.processSteps.push({ id: genId(), stepName: '', operationMethod: '', parameters: '', controlPoint: '', equipmentName: '' }); saveData(data); renderActiveSection(); }); }
    content.querySelectorAll('.q15-del-process').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.psIdx); if (data.processSteps.length > 1) { data.processSteps.splice(idx, 1); saveData(data); renderActiveSection(); } }); });
    content.querySelectorAll('.q15-process-card input').forEach(function(el) { el.addEventListener('input', function() { var card = this.closest('.q15-process-card'), idx = parseInt(card.dataset.psIdx), inputs = card.querySelectorAll('input'); if (data.processSteps[idx]) { data.processSteps[idx].stepName = inputs[0].value; data.processSteps[idx].operationMethod = inputs[1].value; data.processSteps[idx].parameters = inputs[2].value; data.processSteps[idx].controlPoint = inputs[3].value; data.processSteps[idx].equipmentName = inputs[4].value; saveData(data); } }); });

    const aiBtn = content.querySelector('#aiHazardBtn');
    if (aiBtn) {
      aiBtn.addEventListener('click', async function() {
        aiBtn.disabled = true;
        var hint = content.querySelector('#aiHazardHint');
        if (hint) hint.textContent = 'AI分析中...';
        // 收集产品信息
        collectSectionData(content, data);
        saveData(data);
        // 收集原料列表（从配方表和原料字段）
        var materials = [];
        if (data.formula && data.formula.length > 0) {
          data.formula.forEach(function(f) { if (f.material && f.material.trim()) materials.push(f.material.trim()); });
        }
        if (data.rawMaterials) {
          var rawParts = data.rawMaterials.split(/[,，、\s]+/).filter(Boolean);
          rawParts.forEach(function(p) { if (materials.indexOf(p) === -1) materials.push(p); });
        }
        if (data.additives) {
          var addParts = data.additives.split(/[,，、\s]+/).filter(Boolean);
          addParts.forEach(function(p) { if (materials.indexOf(p) === -1) materials.push(p); });
        }
        // 如果没有原料数据，直接提示
        if (materials.length === 0) {
          if (hint) hint.textContent = '请先在第2步填写原料或在配方表中添加原料';
          var emptyEl = document.getElementById('aiHazardResult');
          if (emptyEl) emptyEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);">请先在配方表或原料字段中填写原料名称，然后点击此按钮查询危害数据</div>';
          aiBtn.disabled = false;
          return;
        }
        // 调用后端原料危害数据库API
        try {
          var hazardBio = [], hazardChem = [], hazardPhys = [], matchedMaterials = [];
          const resp = await fetch(API_HOST + '/api/ai/raw-material-hazards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materials: materials })
          });
          if (!resp.ok) {
            throw new Error('API响应异常: ' + resp.status);
          }
          const result = await resp.json();
          if (result.ok && result.data && result.data.matched) {
            matchedMaterials = result.data.matched;
            result.data.matched.forEach(function(entry) {
              var m = entry.material;
              var h = entry.hazards;
              if (h.bio && h.bio.risk) {
                hazardBio.push({
                  material: m,
                  hazardType: '生物危害',
                  desc: h.bio.risk,
                  q1: h.bio.q1 || '',
                  q2: h.bio.q2 || '',
                  q3: h.bio.q3 || '',
                  isCCP: h.bio.isCCP,
                  ccpResult: h.bio.isCCP ? '是' : '否',
                  severity: h.bio.isCCP ? '高' : '中',
                  likelihood: '中',
                  control: h.bio.control || '',
                  detail: h.bio.detail || ''
                });
              }
              if (h.chem && h.chem.risk) {
                hazardChem.push({
                  material: m,
                  hazardType: '化学危害',
                  desc: h.chem.risk,
                  q1: h.chem.q1 || '',
                  q2: h.chem.q2 || '',
                  q3: h.chem.q3 || '',
                  isCCP: h.chem.isCCP,
                  ccpResult: h.chem.isCCP ? '是' : '否',
                  severity: h.chem.isCCP ? '高' : '中',
                  likelihood: '中',
                  control: h.chem.control || '',
                  detail: h.chem.detail || ''
                });
              }
              if (h.phys && h.phys.risk) {
                hazardPhys.push({
                  material: m,
                  hazardType: '物理危害',
                  desc: h.phys.risk,
                  q1: h.phys.q1 || '',
                  q2: h.phys.q2 || '',
                  q3: h.phys.q3 || '',
                  isCCP: h.phys.isCCP,
                  ccpResult: h.phys.isCCP ? '是' : '否',
                  severity: '中',
                  likelihood: '中',
                  control: h.phys.control || '',
                  detail: h.phys.detail || ''
                });
              }
            });
          }
          // 判断匹配结果
          if (hazardBio.length > 0 || hazardChem.length > 0 || hazardPhys.length > 0) {
            data.hazardBio = hazardBio;
            data.hazardChem = hazardChem;
            data.hazardPhys = hazardPhys;
            saveData(data);
            if (hint) hint.textContent = '\u2713 原料危害分析完成，已匹配 ' + matchedMaterials.length + ' 种原料';
            renderAiHazardResult(hazardBio, hazardChem, hazardPhys, matchedMaterials);
          } else {
            // 没有匹配到任何原料：显示未匹配信息，不填充数据
            var unmatchedList = materials.join('、');
            data.hazardBio = [];
            data.hazardChem = [];
            data.hazardPhys = [];
            saveData(data);
            if (hint) hint.textContent = '\u2716 未匹配到危害数据';
            var resultEl = document.getElementById('aiHazardResult');
            if (resultEl) resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);">未在数据库中找到以下原料的危害数据：<strong>' + unmatchedList + '</strong><br><span style="font-size:12px;">如需添加请联系管理员更新原料危害数据库</span></div>';
          }
        } catch (err) {
          console.warn('原料危害数据库查询失败:', err.message);
          data.hazardBio = [];
          data.hazardChem = [];
          data.hazardPhys = [];
          saveData(data);
          if (hint) hint.textContent = '\u2716 后端接口不可用';
          var resultEl = document.getElementById('aiHazardResult');
          if (resultEl) resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:#dc2626;">后端接口不可用，无法查询原料危害数据。请确认后端已启动（运行 python -m uvicorn backend.main:app）</div>';
        }
        aiBtn.disabled = false;
      });
    }
    ['Bio', 'Chem', 'Phys'].forEach(function(type) { var body = content.querySelector('#hazard' + type + 'Body'); if (body) { body.querySelectorAll('input, select').forEach(function(el) { el.addEventListener('change', function() { collectHazardTableData(content, data); saveData(data); }); el.addEventListener('input', function() { collectHazardTableData(content, data); saveData(data); }); }); } });

    const aiCriticalBtn = content.querySelector('#aiCriticalBtn');
    if (aiCriticalBtn) { aiCriticalBtn.addEventListener('click', function() { aiCriticalBtn.disabled = true; var hint = content.querySelector('#aiCriticalHint'); if (hint) hint.textContent = 'AI分析中...'; var result = content.querySelector('#aiCriticalResult'); setTimeout(function() { var standard = data.execStandard || '国标'; var demoResult = '根据' + (standard === 'gb' ? 'GB 14881-2013 食品安全国家标准 食品生产通用卫生规范' : standard) + '，建议关键限制如下：\n\n1. 杀菌工序 CCP-3：\n   - 中心温度：\u226585\u2103\n   - 保持时间：\u226515秒\n   - 依据：GB 14881-2013 第5.2.1条\n\n2. 金属检测 CCP-4：\n   - Fe：\u22641.5mm\n   - SUS：\u22642.0mm\n   - 依据：GB/T 25346-2010\n\n3. 原料验收 CCP-1：\n   - 农药残留：符合GB 2763-2021\n   - 重金属：符合GB 2762-2022'; if (result) result.innerHTML = '<div class="q15-ai-result">' + demoResult.replace(/\n/g, '<br>') + '</div>'; if (hint) hint.textContent = '\u2713 AI建议已生成'; aiCriticalBtn.disabled = false; }, 800); }); }

    const addMonitorBtn = content.querySelector('#addMonitorRow');
    if (addMonitorBtn) { addMonitorBtn.addEventListener('click', function() { data.monitoring.push({ id: genId(), ccp: '', object: '', method: '', frequency: '', personnel: '', remark: '' }); saveData(data); renderActiveSection(); }); }
    content.querySelectorAll('#monitorBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.mnIdx); if (data.monitoring.length > 1) { data.monitoring.splice(idx, 1); saveData(data); renderActiveSection(); } }); });
    content.querySelectorAll('#monitorBody input').forEach(function(el) { el.addEventListener('input', function() { var row = this.closest('tr'), idx = parseInt(row.dataset.mnIdx), inputs = row.querySelectorAll('input'); if (data.monitoring[idx]) { data.monitoring[idx].ccp = inputs[0].value; data.monitoring[idx].object = inputs[1].value; data.monitoring[idx].method = inputs[2].value; data.monitoring[idx].frequency = inputs[3].value; data.monitoring[idx].personnel = inputs[4].value; data.monitoring[idx].remark = inputs[5].value; saveData(data); } }); });

    const addCorrectiveBtn = content.querySelector('#addCorrectiveRow');
    if (addCorrectiveBtn) { addCorrectiveBtn.addEventListener('click', function() { data.correctiveActions.push({ id: genId(), ccp: '', cl: '', corrective: '', verification: '', record: '' }); saveData(data); renderActiveSection(); }); }
    content.querySelectorAll('#correctiveBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.caIdx); if (data.correctiveActions.length > 1) { data.correctiveActions.splice(idx, 1); saveData(data); renderActiveSection(); } }); });
    content.querySelectorAll('#correctiveBody input').forEach(function(el) { el.addEventListener('input', function() { var row = this.closest('tr'), idx = parseInt(row.dataset.caIdx), inputs = row.querySelectorAll('input'); if (data.correctiveActions[idx]) { data.correctiveActions[idx].ccp = inputs[0].value; data.correctiveActions[idx].cl = inputs[1].value; data.correctiveActions[idx].corrective = inputs[2].value; data.correctiveActions[idx].verification = inputs[3].value; data.correctiveActions[idx].record = inputs[4].value; saveData(data); } }); });

    const aiMonitorBtn = content.querySelector('#aiMonitorBtn');
    if (aiMonitorBtn) { aiMonitorBtn.addEventListener('click', function() { aiMonitorBtn.disabled = true; var hint = content.querySelector('#aiMonitorHint'); if (hint) hint.textContent = 'AI分析中...'; setTimeout(function() { data.monitoring = [{ id: genId(), ccp: 'CCP-3 杀菌工序', object: '杀菌温度、时间', method: '在线温度传感器连续监控', frequency: '每批次实时记录', personnel: '经HACCP培训的品控专员', remark: '依据GB 14881-2013，温度偏差需\u2264\u00B11\u2103' }, { id: genId(), ccp: 'CCP-4 金属检测', object: '金属异物', method: '在线金属检测仪自动检测', frequency: '连续监控', personnel: '设备维护人员+品控专员', remark: '依据GB/T 25346-2010' }, { id: genId(), ccp: 'CCP-1 原料验收', object: '农药残留、重金属', method: '供应商检测报告+抽检验证', frequency: '每批次审核', personnel: '经培训的采购专员', remark: '依据GB 2763-2021、GB 2762-2022' }]; saveData(data); if (hint) hint.textContent = '\u2713 AI规划完成'; aiMonitorBtn.disabled = false; renderActiveSection(); }, 1000); }); }

    // 绑定精简版上传区域事件
    bindCompactUploadEvents(content);

    // CCP页面按钮事件绑定（新 + 旧兼容）
    // 只有在使用旧的CCP视图时才绑定旧按钮，避免冲突
    if (data.ccpPageMode !== 'judging' && data.ccpPageMode !== 'form' && data.ccpPageMode !== 'summary') {
      bindCcpStepButtons(content, data);
    }
    bindNewCcpButtons(content, data);

    bindFlowchartButtons(data);
    const exportBtn = content.querySelector('#exportTableBtn');
    if (exportBtn) { exportBtn.addEventListener('click', function() { alert('导出功能：将生成空白记录表格供打印使用（此功能为占位，后续可实现为PDF/Excel导出）'); }); }
  }

  // ===== CCP决策树辅助函数 (5问题版本) =====
  // 决策树逻辑：
  // Q1: 该加工步骤是否存在危害？ 
  //   → 否: 非CCP
  //   → 是: → Q2
  // Q2: 是否存在针对已识别危害的控制措施？
  //   → 是: → Q3
  //   → 否: q2_need(是否有必要在此步骤进行安全控制？)
  //         → 是: 标记"需修改步骤/工艺/产品" → 重置Q2重新评估
  //         → 否: 非CCP
  // Q3: 该步骤是否经过专门设计，可消除危害或将其降低至可接受水平？
  //   → 是: CCP
  //   → 否: → Q4
  // Q4: 该步骤是否会发生污染，或污染水平升高至不可接受的程度？
  //   → 否: 非CCP
  //   → 是: → Q5
  // Q5: 后续步骤或操作是否会消除该危害，或将其降低至可接受水平？
  //   → 是: 非CCP
  //   → 否: CCP
  function evaluateCCPFromQA(hazard) {
    if (!hazard) return null;
    // Q1=否 → 非CCP
    if (hazard.q1 === '否') return false;
    if (hazard.q1 !== '是') return null;
    // Q2: 存在控制措施？
    if (hazard.q2 === undefined) return null;
    if (hazard.q2 === '否') {
      // 检查子判断：是否有必要在此步骤进行安全控制？
      if (hazard.q2_need === undefined) return null; // 需要先回答子问题
      if (hazard.q2_need === '是') return 'modify'; // 需要修改，返回特殊状态
      if (hazard.q2_need === '否') return false; // 非CCP
    }
    // Q2=是，进入Q3
    if (hazard.q3 === undefined) return null;
    if (hazard.q3 === '是') return true; // CCP
    // Q3=否，进入Q4
    if (hazard.q4 === undefined) return null;
    if (hazard.q4 === '否') return false; // 非CCP
    // Q4=是，进入Q5
    if (hazard.q5 === undefined) return null;
    if (hazard.q5 === '是') return false; // 非CCP
    if (hazard.q5 === '否') return true; // CCP
    return null;
  }

  function getNextCCPQuestion(hazard) {
    if (!hazard || hazard.q1 === undefined) return 1;
    if (hazard.q1 === '否') return -1;
    if (hazard.q2 === undefined) return 2;
    if (hazard.q2 === '否') {
      // Q2=否，需要先回答 q2_need 子问题
      if (hazard.q2_need === undefined) return 'q2_need';
      if (hazard.q2_need === '是') return 'q2_reset'; // 需要修改后重新评估Q2
      if (hazard.q2_need === '否') return -1;
    }
    if (hazard.q3 === undefined) return 3;
    if (hazard.q3 === '是') return -1;
    if (hazard.q4 === undefined) return 4;
    if (hazard.q4 === '否') return -1;
    if (hazard.q5 === undefined) return 5;
    return -1;
  }

  // ===== 新CCP页面按钮事件绑定 =====
  function bindNewCcpButtons(content, data) {
    // 步骤表单 - 确认保存
    var saveBtn = content.querySelector('#stepFormSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var name = content.querySelector('#stepFormName')?.value.trim();
        var equipment = content.querySelector('#stepFormEquipment')?.value.trim();
        var method = content.querySelector('#stepFormMethod')?.value.trim();
        var params = content.querySelector('#stepFormParams')?.value.trim();
        if (!name) { alert('请输入步骤名称'); return; }
        
        var editIdx = data.currentEditingStep;
        if (editIdx >= 0 && editIdx < data.processSteps.length) {
          // 编辑已有步骤
          data.processSteps[editIdx].stepName = name;
          data.processSteps[editIdx].equipmentName = equipment;
          data.processSteps[editIdx].operationMethod = method;
          data.processSteps[editIdx].parameters = params;
        } else {
          // 新增步骤
          data.processSteps.push({
            id: genId(),
            stepName: name,
            equipmentName: equipment,
            operationMethod: method,
            parameters: params,
            controlPoint: ''
          });
        }
        // 重置当前编辑索引
        data.currentEditingStep = -1;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // 步骤列表 - 点击编辑
    content.querySelectorAll('[data-step-edit]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        // 如果点击的是删除按钮，不触发编辑
        if (e.target.dataset.stepDelete !== undefined) return;
        var idx = parseInt(this.dataset.stepEdit);
        if (!isNaN(idx) && idx >= 0 && idx < data.processSteps.length) {
          data.currentEditingStep = idx;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        }
      });
    });
    
    // 步骤列表 - 删除按钮
    content.querySelectorAll('[data-step-delete]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.stepDelete);
        if (isNaN(idx) || idx < 0 || idx >= data.processSteps.length) return;
        if (data.processSteps.length <= 1) { alert('至少保留一个步骤'); return; }
        if (!confirm('确定要删除步骤 "' + esc(data.processSteps[idx].stepName || '步骤' + (idx + 1)) + '" 吗？')) return;
        data.processSteps.splice(idx, 1);
        if (data.ccpSteps && data.ccpSteps.length > idx) data.ccpSteps.splice(idx, 1);
        // 调整编辑索引和CCP步骤索引
        if (data.currentEditingStep >= data.processSteps.length) data.currentEditingStep = -1;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });

    // CCP判断按钮
    var judgeBtn = content.querySelector('#ccpJudgeBtn');
    if (judgeBtn) {
      judgeBtn.addEventListener('click', function() {
        var steps = data.processSteps || [];
        if (steps.length === 0) { alert('请先添加至少一个步骤'); return; }
        data.ccpPageMode = 'judging';
        data.ccpStepIndex = 0;
        data.ccpHazardType = 'bio';
        data.ccpCurrentQ = 1;
        // 确保有ccpSteps数据
        if (!data.ccpSteps) data.ccpSteps = [];
        steps.forEach(function(step, si) {
          if (!data.ccpSteps[si]) {
            data.ccpSteps[si] = { stepName: step.stepName || '', hazards: {}, completed: false };
          }
          ['bio', 'chem', 'phys'].forEach(function(ht) {
            if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
            if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
          });
        });
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // 新增步骤按钮
    var addStepBtn = content.querySelector('#addNewStepBtn');
    if (addStepBtn) {
      addStepBtn.addEventListener('click', function() {
        // 设置当前编辑索引为新增模式（-1）
        data.currentEditingStep = -1;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // 完成按钮
    var completeBtn = content.querySelector('#completeStepsBtn');
    if (completeBtn) {
      completeBtn.addEventListener('click', function() {
        var steps = data.processSteps || [];
        if (steps.length === 0) { alert('请先添加至少一个步骤'); return; }
        // 如果有步骤但没有进行完全部CCP判定，允许查看汇总表
        data.ccpPageMode = 'summary';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // CCP判定 - 确定按钮
    var answerBtn = content.querySelector('#ccpAnswerBtn');
    if (answerBtn) {
      answerBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        var currentQ = data.ccpCurrentQ || 1;
        
        // 如果是Q1，先保存危害描述
        if (currentQ === 1) {
          var descInput = content.querySelector('#ccpHazardDescInput');
          if (descInput && descInput.value.trim()) {
            if (!data.ccpSteps) data.ccpSteps = [];
            if (!data.ccpSteps[idx]) data.ccpSteps[idx] = { stepName: data.processSteps[idx]?.stepName || '', hazards: {}, completed: false };
            if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
            if (!data.ccpSteps[idx].hazards[hazardType]) data.ccpSteps[idx].hazards[hazardType] = {};
            data.ccpSteps[idx].hazards[hazardType].hazardDesc = descInput.value.trim();
          }
        }
        
        var selected = content.querySelector('input[name="ccpQAnswer"]:checked');
        if (!selected) { alert('请选择一个选项'); return; }
        var answer = selected.value;
        
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[idx]) data.ccpSteps[idx] = { stepName: data.processSteps[idx]?.stepName || '', hazards: {}, completed: false };
        if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
        if (!data.ccpSteps[idx].hazards[hazardType]) data.ccpSteps[idx].hazards[hazardType] = {};
        
        if (currentQ === 'q2_need') {
          data.ccpSteps[idx].hazards[hazardType].q2_need = answer;
        } else {
          data.ccpSteps[idx].hazards[hazardType]['q' + currentQ] = answer;
        }
        
        var hazard = data.ccpSteps[idx].hazards[hazardType];
        var isCCP = evaluateCCPFromQA(hazard);
        
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
          // 自动前进到下一步
          var hazardTypes = ['bio', 'chem', 'phys'];
          var hazardTypeIdx = hazardTypes.indexOf(hazardType);
          if (isCCP === true || isCCP === false) {
            var nextHazardIdx = hazardTypeIdx + 1;
            if (nextHazardIdx < hazardTypes.length) {
              data.ccpHazardType = hazardTypes[nextHazardIdx];
              data.ccpCurrentQ = 1;
            } else {
              // 当前步骤的所有危害已判定完成
              data.ccpSteps[idx].completed = true;
              var nextStep = idx + 1;
              if (nextStep < data.processSteps.length) {
                data.ccpStepIndex = nextStep;
                data.ccpHazardType = 'bio';
                data.ccpCurrentQ = 1;
              } else {
                // 所有步骤所有危害判定完成
                data.ccpCompleted = true;
                data.ccpPageMode = 'form';
                saveData(data);
                renderActiveSection();
                renderSectionNav();
                return;
              }
            }
          } else if (isCCP === 'modify') {
            data.ccpCurrentQ = 2;
          }
        } else {
          var nextQ = getNextCCPQuestion(hazard);
          if (nextQ === 'q2_reset') {
            hazard.isCCP = 'modify';
            data.ccpCurrentQ = 2;
          } else if (nextQ > 0) {
            data.ccpCurrentQ = nextQ;
          } else if (nextQ === 'q2_need') {
            data.ccpCurrentQ = 'q2_need';
          }
        }
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // CCP判定 - 返回按钮
    var backBtn = content.querySelector('#ccpJudgingBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        data.ccpPageMode = 'form';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // CCP判定结果 - 下一步/完成按钮
    var nextHazardBtn = content.querySelector('#ccpNextHazardBtn');
    if (nextHazardBtn) {
      nextHazardBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        var hazardTypes = ['bio', 'chem', 'phys'];
        var hazardTypeIdx = hazardTypes.indexOf(hazardType);
        
        var nextHazardIdx = hazardTypeIdx + 1;
        if (nextHazardIdx < hazardTypes.length) {
          data.ccpHazardType = hazardTypes[nextHazardIdx];
          data.ccpCurrentQ = 1;
        } else {
          var nextStep = idx + 1;
          if (nextStep < data.processSteps.length) {
            data.ccpStepIndex = nextStep;
            data.ccpHazardType = 'bio';
            data.ccpCurrentQ = 1;
          } else {
            data.ccpCompleted = true;
            data.ccpPageMode = 'form';
            saveData(data);
            renderActiveSection();
            renderSectionNav();
            return;
          }
        }
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // 汇总表 - 返回按钮
    var summaryBackBtn = content.querySelector('#summaryBackBtn');
    if (summaryBackBtn) {
      summaryBackBtn.addEventListener('click', function() {
        data.ccpPageMode = 'form';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }
  }

  function bindCcpStepButtons(content, data) {
    function saveHazardDescIfNeeded(idx, hazardType) {
      var hazardDescInput = content.querySelector('#ccpHazardDescInput');
      if (hazardDescInput) {
        var desc = hazardDescInput.value.trim();
        if (desc) {
          if (!data.ccpSteps) data.ccpSteps = [];
          if (!data.ccpSteps[idx]) data.ccpSteps[idx] = { stepName: '', hazards: {}, completed: false };
          if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
          if (!data.ccpSteps[idx].hazards[hazardType]) data.ccpSteps[idx].hazards[hazardType] = {};
          data.ccpSteps[idx].hazards[hazardType].hazardDesc = desc;
        }
      }
    }

    // 确认回答按钮
    var answerBtn = content.querySelector('#ccpAnswerBtn');
    if (answerBtn) {
      answerBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        var currentQ = data.ccpCurrentQ || 1;
        var selected = content.querySelector('input[name="ccpQAnswer"]:checked');
        if (!selected) { alert('请选择"有危害/无危害"或"是/否"'); return; }
        var answer = selected.value;
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[idx]) {
          data.ccpSteps[idx] = { stepName: data.processSteps[idx]?.stepName || '', hazards: {}, completed: false };
        }
        if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
        if (!data.ccpSteps[idx].hazards[hazardType]) data.ccpSteps[idx].hazards[hazardType] = {};
        
        if (currentQ === 1) saveHazardDescIfNeeded(idx, hazardType);
        
        data.ccpSteps[idx].hazards[hazardType]['q' + currentQ] = answer;
        
        var hazard = data.ccpSteps[idx].hazards[hazardType];
        var isCCP = evaluateCCPFromQA(hazard);
        
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
          data.ccpCurrentQ = 1;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        } else {
          var nextQ = getNextCCPQuestion(hazard);
          if (nextQ === 'q2_reset') {
            hazard.isCCP = 'modify';
            data.ccpCurrentQ = 2;
            saveData(data);
            renderActiveSection();
            renderSectionNav();
          } else if (nextQ > 0) {
            data.ccpCurrentQ = nextQ;
          } else if (nextQ === 'q2_need') {
            data.ccpCurrentQ = 'q2_need';
          }
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        }
      });
    }

    // Q2子判断：确认按钮
    var q2NeedBtn = content.querySelector('#ccpQ2NeedBtn');
    if (q2NeedBtn) {
      q2NeedBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        var selected = content.querySelector('input[name="ccpQAnswer"]:checked');
        if (!selected) { alert('请选择"是"或"否"'); return; }
        var answer = selected.value;
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[idx]) {
          data.ccpSteps[idx] = { stepName: '', hazards: {}, completed: false };
        }
        if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
        if (!data.ccpSteps[idx].hazards[hazardType]) data.ccpSteps[idx].hazards[hazardType] = {};
        
        data.ccpSteps[idx].hazards[hazardType].q2_need = answer;
        
        var hazard = data.ccpSteps[idx].hazards[hazardType];
        var isCCP = evaluateCCPFromQA(hazard);
        
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
          data.ccpCurrentQ = 1;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        } else {
          var nextQ = getNextCCPQuestion(hazard);
          if (nextQ === 'q2_reset') {
            hazard.isCCP = 'modify';
            data.ccpCurrentQ = 2;
            saveData(data);
            renderActiveSection();
            renderSectionNav();
          } else if (nextQ > 0) {
            data.ccpCurrentQ = nextQ;
            saveData(data);
            renderActiveSection();
            renderSectionNav();
          }
        }
      });
    }

    // 修改完成，重新评估Q2按钮
    var resetQ2Btn = content.querySelector('#ccpResetQ2Btn');
    if (resetQ2Btn) {
      resetQ2Btn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        if (data.ccpSteps && data.ccpSteps[idx] && data.ccpSteps[idx].hazards && data.ccpSteps[idx].hazards[hazardType]) {
          var h = data.ccpSteps[idx].hazards[hazardType];
          h.q2 = undefined;
          h.q2_need = undefined;
          h.isCCP = undefined;
          h.q3 = undefined;
          h.q4 = undefined;
          h.q5 = undefined;
        }
        data.ccpCurrentQ = 2;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // 下一步按钮
    var nextQBtn = content.querySelector('#ccpNextQBtn');
    if (nextQBtn) {
      nextQBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[idx]) data.ccpSteps[idx] = { stepName: '', hazards: {}, completed: false };
        if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
        var hazard = data.ccpSteps[idx].hazards[hazardType] || {};
        var isCCP = evaluateCCPFromQA(hazard);
        
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
          data.ccpCurrentQ = 1;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        } else {
          var nextQ = getNextCCPQuestion(hazard);
          if (nextQ === 'q2_reset') {
            hazard.isCCP = 'modify';
            data.ccpCurrentQ = 2;
            saveData(data);
            renderActiveSection();
            renderSectionNav();
          } else if (nextQ > 0) {
            data.ccpCurrentQ = nextQ;
          } else if (nextQ === 'q2_need') {
            data.ccpCurrentQ = 'q2_need';
          }
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        }
      });
    }

    // ===== 导航面板事件 =====
    var navToggle = content.querySelector('#ccpNavToggle');
    if (navToggle) {
      navToggle.addEventListener('click', function() {
        var body = content.querySelector('#ccpNavBody');
        var arrow = content.querySelector('#ccpNavArrow');
        if (body) {
          if (body.style.display === 'none') {
            body.style.display = 'block';
            if (arrow) arrow.classList.add('expanded');
          } else {
            body.style.display = 'none';
            if (arrow) arrow.classList.remove('expanded');
          }
        }
      });
    }

    content.querySelectorAll('[data-nav-step]').forEach(function(el) {
      el.addEventListener('click', function() {
        var si = parseInt(this.dataset.navStep);
        if (isNaN(si)) return;
        data.ccpStepIndex = si;
        data.ccpHazardType = 'bio';
        data.ccpCurrentQ = 1;
        data.ccpViewMode = 'judge';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });

    content.querySelectorAll('[data-nav-edit]').forEach(function(el) {
      el.addEventListener('click', function() {
        var si = parseInt(this.dataset.navEdit);
        if (isNaN(si)) return;
        data.ccpViewMode = 'edit';
        data.ccpEditStepIdx = si;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });

    content.querySelectorAll('[data-nav-hazard]').forEach(function(el) {
      el.addEventListener('click', function() {
        var si = parseInt(this.dataset.navHazard);
        var ht = this.dataset.navHt;
        if (isNaN(si) || !ht) return;
        data.ccpStepIndex = si;
        data.ccpHazardType = ht;
        data.ccpCurrentQ = 1;
        data.ccpViewMode = 'judge';
        var hData = null;
        if (data.ccpSteps && data.ccpSteps[si] && data.ccpSteps[si].hazards && data.ccpSteps[si].hazards[ht]) {
          hData = data.ccpSteps[si].hazards[ht];
        }
        if (hData && hData.isCCP !== undefined) delete hData.isCCP;
        var nextQ = 1;
        if (hData) {
          for (var qi = 1; qi <= 5; qi++) {
            if (hData['q' + qi] !== undefined) nextQ = qi + 1;
          }
        }
        if (nextQ > 5) nextQ = 5;
        data.ccpCurrentQ = nextQ === 'q2_need' ? 'q2_need' : nextQ;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });

    // ===== 步骤编辑器事件 =====
    var editSaveBtn = content.querySelector('#ccpEditSaveBtn');
    if (editSaveBtn) {
      editSaveBtn.addEventListener('click', function() {
        var editIdx = data.ccpEditStepIdx;
        if (editIdx < 0 || editIdx >= data.processSteps.length) return;
        var inputs = content.querySelectorAll('#ccpEditStepCard .ccp-edit-input');
        inputs.forEach(function(el) {
          var field = el.dataset.psField;
          if (field) data.processSteps[editIdx][field] = el.value;
        });
        if (data.ccpSteps && data.ccpSteps[editIdx]) {
          data.ccpSteps[editIdx].stepName = data.processSteps[editIdx].stepName || '';
        }
        saveData(data);
        var hint = content.querySelector('.q15-table-hint');
        if (hint) {
          hint.textContent = '✅ 已保存步骤信息';
          setTimeout(function() { if (hint) hint.textContent = '在此处修改本步骤的基本信息，修改完成后返回CCP判定'; }, 2000);
        }
      });
    }

    var editDeleteBtn = content.querySelector('#ccpEditDeleteBtn');
    if (editDeleteBtn) {
      editDeleteBtn.addEventListener('click', function() {
        var editIdx = data.ccpEditStepIdx;
        if (editIdx < 0 || editIdx >= data.processSteps.length) return;
        if (data.processSteps.length <= 1) { alert('至少保留一个步骤'); return; }
        if (!confirm('确定要删除步骤 "' + esc(data.processSteps[editIdx].stepName || '步骤' + (editIdx + 1)) + '" 吗？')) return;
        data.processSteps.splice(editIdx, 1);
        if (data.ccpSteps && data.ccpSteps.length > editIdx) data.ccpSteps.splice(editIdx, 1);
        if (editIdx >= data.processSteps.length) editIdx = data.processSteps.length - 1;
        data.ccpViewMode = 'judge';
        data.ccpEditStepIdx = undefined;
        if (data.ccpStepIndex >= data.processSteps.length) data.ccpStepIndex = Math.max(0, data.processSteps.length - 1);
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    var editBackBtn = content.querySelector('#ccpEditBackToJudgeBtn');
    if (editBackBtn) {
      editBackBtn.addEventListener('click', function() {
        data.ccpViewMode = 'judge';
        data.ccpEditStepIdx = undefined;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // ===== 改进的"上一步"按钮 =====
    var prevStepBtn = content.querySelector('#ccpPrevStepBtn');
    if (prevStepBtn) {
      prevStepBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        var currentQ = data.ccpCurrentQ || 1;
        var hazardTypes = ['bio', 'chem', 'phys'];
        var hazardTypeIdx = hazardTypes.indexOf(hazardType);
        
        if (currentQ === 'q2_need') {
          data.ccpCurrentQ = 2;
        } else if (currentQ > 1) {
          data.ccpCurrentQ = currentQ - 1;
        } else if (hazardTypeIdx > 0) {
          var prevHazardType = hazardTypes[hazardTypeIdx - 1];
          data.ccpHazardType = prevHazardType;
          data.ccpCurrentQ = 5;
          if (data.ccpSteps && data.ccpSteps[idx] && data.ccpSteps[idx].hazards && data.ccpSteps[idx].hazards[prevHazardType]) {
            data.ccpSteps[idx].hazards[prevHazardType].isCCP = undefined;
          }
        } else if (idx > 0) {
          data.ccpViewMode = 'edit';
          data.ccpEditStepIdx = idx;
          data.ccpStepIndex = idx;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
          return;
        }
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // ===== 改进的"返回编辑"按钮 =====
    var backBtn = content.querySelector('#ccpBackToEditBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        var steps = data.processSteps || [];
        var lastStepIdx = 0;
        var lastHazardType = 'bio';
        var lastQ = 1;
        
        if (data.ccpSteps && data.ccpSteps.length > 0) {
          for (var si = data.ccpSteps.length - 1; si >= 0; si--) {
            var s = data.ccpSteps[si];
            if (s && s.hazards) {
              var hts = ['phys', 'chem', 'bio'];
              for (var hi = 0; hi < hts.length; hi++) {
                var ht = hts[hi];
                var h = s.hazards[ht];
                if (h) {
                  for (var qi = 5; qi >= 1; qi--) {
                    if (h['q' + qi] !== undefined) {
                      lastStepIdx = si;
                      lastHazardType = ht;
                      lastQ = qi;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
        
        data.ccpCompleted = false;
        data.hazardConfirmed = false;
        data.ccpStepIndex = lastStepIdx;
        data.ccpHazardType = lastHazardType;
        data.ccpCurrentQ = lastQ;
        data.ccpViewMode = 'judge';
        if (data.ccpSteps && data.ccpSteps[lastStepIdx] && data.ccpSteps[lastStepIdx].hazards && data.ccpSteps[lastStepIdx].hazards[lastHazardType]) {
          data.ccpSteps[lastStepIdx].hazards[lastHazardType].isCCP = undefined;
        }
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // ===== 统一CCP判定表格事件绑定 =====
    content.querySelectorAll('.ccp-ut-desc-input').forEach(function(el) {
      el.addEventListener('input', function() {
        var si = parseInt(this.dataset.utSi);
        var ht = this.dataset.utHt;
        if (isNaN(si) || !ht) return;
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: '', hazards: {}, completed: false };
        if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
        if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
        data.ccpSteps[si].hazards[ht].hazardDesc = this.value;
        saveData(data);
      });
    });
    
    content.querySelectorAll('.ccp-unified-table input[type="radio"]').forEach(function(el) {
      el.addEventListener('change', function() {
        var si = parseInt(this.dataset.utSi);
        var ht = this.dataset.utHt;
        var field = this.dataset.utField;
        var value = this.value;
        if (isNaN(si) || !ht || !field) return;
        
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: data.processSteps[si]?.stepName || '', hazards: {}, completed: false };
        if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
        if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
        data.ccpSteps[si].hazards[ht][field] = value;
        
        var hazard = data.ccpSteps[si].hazards[ht];
        var isCCP = evaluateCCPFromQA(hazard);
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
        } else {
          hazard.isCCP = undefined;
        }
        
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });
    
    var saveBtn = content.querySelector('#ccpUnifiedSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        saveData(data);
        renderSectionNav();
      });
    }
    
    var finishBtn = content.querySelector('#ccpUnifiedFinishBtn');
    if (finishBtn) {
      finishBtn.addEventListener('click', function() {
        var allDone = true;
        var pendingCount = 0;
        data.processSteps.forEach(function(step, si) {
          ['bio', 'chem', 'phys'].forEach(function(ht) {
            if (data.ccpSteps && data.ccpSteps[si] && data.ccpSteps[si].hazards && data.ccpSteps[si].hazards[ht]) {
              var h = data.ccpSteps[si].hazards[ht];
              if (h.isCCP === undefined || h.isCCP === null) {
                allDone = false;
                pendingCount++;
              }
            } else {
              allDone = false;
              pendingCount++;
            }
          });
        });
        
        if (!allDone) {
          if (!confirm('还有 ' + pendingCount + ' 项危害未完成判定，确定要完成吗？未判定的将默认视为非CCP。')) return;
          data.processSteps.forEach(function(step, si) {
            ['bio', 'chem', 'phys'].forEach(function(ht) {
              if (data.ccpSteps && data.ccpSteps[si] && data.ccpSteps[si].hazards && data.ccpSteps[si].hazards[ht]) {
                var h = data.ccpSteps[si].hazards[ht];
                if (h.isCCP === undefined || h.isCCP === null) {
                  h.isCCP = false;
                }
              } else {
                if (!data.ccpSteps) data.ccpSteps = [];
                if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: step.stepName || '', hazards: {}, completed: false };
                if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
                if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
                data.ccpSteps[si].hazards[ht].isCCP = false;
              }
            });
          });
        }
        
        data.ccpCompleted = true;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }
  }

  function collectHazardTableData(content, data) {
    [{ bodyId: 'hazardBioBody', key: 'hazardBio' }, { bodyId: 'hazardChemBody', key: 'hazardChem' }, { bodyId: 'hazardPhysBody', key: 'hazardPhys' }].forEach(function(_a) { var body = content.querySelector('#' + _a.bodyId); if (!body) return; var rows = body.querySelectorAll('tr:not(.q15-empty-row)'); data[_a.key] = []; rows.forEach(function(row) { var inputs = row.querySelectorAll('input'), selects = row.querySelectorAll('select'); if (inputs.length > 0) data[_a.key].push({ desc: inputs[0]?.value || '', severity: selects[0]?.value || '中', likelihood: selects[1]?.value || '中', control: inputs[1]?.value || '' }); }); }); 
  }

  // ==================== 渲染AI危害结果到按钮下方 ====================
  function renderAiHazardResult(bio, chem, phys, matchedMaterials) {
    var resultEl = document.getElementById('aiHazardResult');
    if (!resultEl) return;
    
    // 合并所有危害数据到一个统一表格
    var allHazards = [];
    bio.forEach(function(h) { allHazards.push(h); });
    chem.forEach(function(h) { allHazards.push(h); });
    phys.forEach(function(h) { allHazards.push(h); });
    
    var html = '';
    if (matchedMaterials && matchedMaterials.length > 0) {
      html += '<div class="q15-ai-summary" style="margin-bottom:12px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#166534;">';
      html += '匹配到 ' + matchedMaterials.length + ' 种原料的危害数据：';
      html += matchedMaterials.map(function(e) { return '<strong>' + e.material + '</strong>'; }).join('、');
      html += '</div>';
    }
    if (allHazards.length > 0) {
      html += '<div class="q15-hazard-preview" style="overflow-x:auto;"><table class="q15-table" style="min-width:900px;"><thead><tr><th style="min-width:70px;">原材料</th><th style="min-width:70px;">风险</th><th style="width:50px;">Q1</th><th style="width:50px;">Q2</th><th style="width:50px;">Q3</th><th style="width:70px;">CCP判断</th><th style="min-width:300px;">风险说明</th></tr></thead><tbody>';
      allHazards.forEach(function(h) {
        var riskColor = h.hazardType === '生物危害' ? '#dc2626' : (h.hazardType === '化学危害' ? '#d97706' : '#6b7280');
        html += '<tr><td><strong>' + esc(h.material || '') + '</strong></td><td style="color:' + riskColor + ';font-weight:500;">' + esc(h.hazardType || '') + '</td><td>' + esc(h.q1 || '') + '</td><td>' + esc(h.q2 || '') + '</td><td>' + esc(h.q3 || '') + '</td><td>' + esc(h.ccpResult || '') + '</td><td style="font-size:13px;line-height:1.5;">' + esc(h.detail || h.desc || '') + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div style="margin-top:10px;font-size:12px;color:var(--gray-400);text-align:right;">已同步到第4步「危害分析」表中</div>';
    } else {
      html = '<div class="q15-ai-result-empty" style="padding:20px;text-align:center;color:var(--gray-400);">未匹配到危害数据</div>';
    }
    resultEl.innerHTML = html;
  }

  // ==================== 可视化流程图 ====================
  function renderVisualFlowchart(steps) {
    if (!steps || steps.length === 0 || !steps.some(function(s) { return s.stepName && s.stepName.trim(); })) return '<p style="color:var(--gray-400);font-style:italic;text-align:center;padding:20px;">暂无步骤数据</p>';
    var validSteps = steps.filter(function(s) { return s.stepName && s.stepName.trim(); });
    var html = '<div class="q15-visual-flowchart"><div class="q15-vf-node start-end"><div class="q15-vf-node-shape start">开始</div><div class="q15-vf-arrow-down"></div></div>';
    validSteps.forEach(function(step, i) { var isCCP = step.controlPoint && step.controlPoint.toLowerCase().indexOf('ccp') !== -1; var ccpLabel = isCCP ? '<span class="q15-vf-ccp-badge">' + esc(step.controlPoint) + '</span>' : ''; html += '<div class="q15-vf-node"><div class="q15-vf-node-shape ' + (isCCP ? 'ccp' : 'step') + '"><span class="q15-vf-step-num">' + (i + 1) + '</span><div class="q15-vf-step-content"><strong>' + esc(step.stepName) + '</strong>' + (step.operationMethod ? '<p class="q15-vf-detail">方法：' + esc(step.operationMethod) + '</p>' : '') + (step.parameters ? '<p class="q15-vf-detail">参数：' + esc(step.parameters) + '</p>' : '') + (step.equipmentName ? '<p class="q15-vf-detail">设备：' + esc(step.equipmentName) + '</p>' : '') + '</div>' + ccpLabel + '</div>' + (i < validSteps.length - 1 ? '<div class="q15-vf-arrow-down"></div>' : '') + '</div>'; });
    html += '<div class="q15-vf-node start-end"><div class="q15-vf-arrow-down"></div><div class="q15-vf-node-shape end">结束</div></div></div>';
    return html;
  }

  function renderFlowchartPreview(data) {
    var hasSteps = data.processSteps && data.processSteps.some(function(s) { return s.stepName && s.stepName.trim(); });
    if (data.flowchartXml) return '<div class="q15-flowchart-preview"><div class="q15-flowchart-info"><span class="q15-flowchart-icon">\u{1F4CA}</span><span>流程图已创建</span><span class="q15-flowchart-size">' + (data.flowchartXml.length / 1024).toFixed(1) + ' KB</span></div><div class="q15-flowchart-actions"><button class="btn btn-primary btn-sm" id="editDrawioBtn">\u270F\uFE0F draw.io编辑</button><button class="btn-flowchart" id="q15InulinBtn" style="font-size:13px;padding:6px 18px"><span class="fc-nav-icon">\u{1F4CA}</span> 菊粉工艺流程图</button><button class="btn btn-secondary btn-sm" id="clearFlowchartBtn">\u{1F5D1}\uFE0F 清除</button></div></div>';
    if (hasSteps) return '<div class="q15-vf-wrapper"><div class="q15-vf-actions"><button class="btn-flowchart" id="q15InulinBtn" style="font-size:13px;padding:6px 18px"><span class="fc-nav-icon">\u{1F4CA}</span> 菊粉工艺流程图</button><button class="btn btn-secondary btn-sm" id="openDrawioBtn">\u{1F4DD} draw.io高级编辑</button><a class="btn btn-secondary btn-sm" href="flowchart-preview.html" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">\u{1F4CA} 流程图模板预览</a></div><div id="q15VfContainer">' + renderVisualFlowchart(data.processSteps) + '</div></div>';
    return '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">\u{1F4CA}</div><p>请先在上方填写操作步骤，AI将自动生成生产流程图</p><p style="font-size:12px;color:var(--gray-400);margin-top:8px;">支持在线编辑和导出</p></div>';
  }

  function bindFlowchartButtons(data) {
    const drawioBtn = document.getElementById('openDrawioBtn');
    if (drawioBtn) drawioBtn.addEventListener('click', () => { openDrawioEditor(data); });
    const editDrawioBtn = document.getElementById('editDrawioBtn');
    if (editDrawioBtn) editDrawioBtn.addEventListener('click', () => { openDrawioEditor(data); });
    var inulinBtn = document.getElementById('q15InulinBtn');
    if (inulinBtn) {
      inulinBtn.addEventListener('click', function() {
        if (typeof mermaid === 'undefined') { alert('Mermaid 渲染库未加载'); return; }
        var modal = document.createElement('div'); modal.className = 'q15-drawio-modal-overlay'; modal.style.zIndex = '1000';
        modal.innerHTML = '<div class="q15-drawio-modal" style="height:90vh;width:92vw"><div class="q15-drawio-toolbar"><span class="q15-drawio-title">菊粉完整生产工艺流程图 — 编辑</span><div class="q15-drawio-toolbar-actions"><span id="inulinStatus" style="font-size:12px;color:var(--gray-400)"></span><button class="q15-drawio-close" id="inulinModalClose">&times;</button></div></div><div style="flex:1;padding:16px;overflow:auto" id="inulinModalBody"></div></div>';
        document.body.appendChild(modal);
        var body = document.getElementById('inulinModalBody');
        var src = (window.INULIN_FLOWCHART && window.INULIN_FLOWCHART.mermaid) ? window.INULIN_FLOWCHART.mermaid : 'graph TD\n  L1["流程图数据未定义"]';
        try { localStorage.setItem('haccp_flowchart_mermaid', src); } catch(e) {}
        var editMode = false;
        function renderInulinBody() { body.innerHTML = ''; var tb = document.createElement('div'); tb.className = 'fc-toolbar'; tb.innerHTML = '<button class="btn btn-sm btn-secondary" id="inulinToggleEdit">' + (editMode ? '📖 预览流程图' : '✏️ 编辑流程图') + '</button><span class="fc-toolbar-info" id="inulinInfo">' + (editMode ? '修改节点表格后点击"应用修改"保存' : '点击编辑按钮编辑节点名称和箭头标签') + '</span>'; body.appendChild(tb); if (editMode) renderInulinEditor(body); else renderInulinChart(body); document.getElementById('inulinToggleEdit')?.addEventListener('click', function() { if (editMode) { var ta = document.getElementById('fcFullSourceEditor'); if (ta) { try { localStorage.setItem('haccp_flowchart_mermaid', ta.value); } catch(e) {} } } editMode = !editMode; renderInulinBody(); }); }
        function renderInulinChart(container) { var currentSrc = ''; try { currentSrc = localStorage.getItem('haccp_flowchart_mermaid') || src; } catch(e) { currentSrc = src; } var chartDiv = document.createElement('div'); chartDiv.className = 'mermaid'; chartDiv.textContent = currentSrc; container.appendChild(chartDiv); var legend = document.createElement('div'); legend.className = 'fc-legend'; legend.innerHTML = '<div class="fc-legend-title">图 例</div><div class="fc-legend-items"><div class="fc-legend-item"><span class="fc-legend-dot ccp"></span>CCP - 关键控制点</div><div class="fc-legend-item"><span class="fc-legend-dot oprp"></span>OPRP - 操作性前提方案</div><div class="fc-legend-item"><span class="fc-legend-dot cqp"></span>CQP - 关键质量点</div><div class="fc-legend-item"><span class="fc-legend-dot io"></span>输入/输出/副产物</div></div>'; container.appendChild(legend); mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { useMaxWidth: true, htmlLabels: true } }); setTimeout(function() { mermaid.run({ nodes: [chartDiv] }).catch(function(err) { chartDiv.innerHTML = '<p style="color:red">渲染失败: ' + (err.message || err) + '</p>'; }); }, 100); }
        function renderInulinEditor(container) { var currentSrc = ''; try { currentSrc = localStorage.getItem('haccp_flowchart_mermaid') || src; } catch(e) { currentSrc = src; } var parsed = parseInulinNodes(currentSrc); var help = document.createElement('div'); help.className = 'fc-editor-help'; help.innerHTML = '修改节点名称和箭头标签后点击「应用修改」保存，然后点击「预览流程图」查看效果。'; container.appendChild(help); var table = document.createElement('table'); table.className = 'fc-node-table'; table.innerHTML = '<thead><tr><th>ID</th><th>节点文字</th><th>类型</th><th style="width:40px"></th></tr></thead><tbody id="inulinNodeBody"></tbody></table>'; container.appendChild(table); var tbody = document.getElementById('inulinNodeBody'); for (var i = 0; i < parsed.nodes.length; i++) { var n = parsed.nodes[i]; var tr = document.createElement('tr'); tr.dataset.nodeid = n.id; tr.innerHTML = '<td><code>' + n.id + '</code></td><td><input class="fc-node-input" data-nodeid="' + n.id + '" value="' + n.label.replace(/"/g,'"') + '" /></td><td><span class="fc-node-badge ' + n.type + '">' + n.type.toUpperCase() + '</span></td><td><button class="fc-btn-del inulin-del-node" data-nodeid="' + n.id + '">✕</button></td>'; tbody.appendChild(tr); } var addBtn = document.createElement('button'); addBtn.className = 'btn btn-sm btn-secondary'; addBtn.style.margin = '8px 0'; addBtn.textContent = '+ 添加节点行'; addBtn.addEventListener('click', function() { var tb = document.getElementById('inulinNodeBody'); var newId = 'N' + Date.now(); var tr = document.createElement('tr'); tr.dataset.nodeid = newId; tr.innerHTML = '<td><code>' + newId + '</code></td><td><input class="fc-node-input" data-nodeid="' + newId + '" value="新步骤' + (tb.children.length + 1) + '" /></td><td><select class="fc-input-type"><option value="step">STEP</option><option value="ccp">CCP</option><option value="oprp">OPRP</option><option value="cqp">CQP</option><option value="io">IO</option></select></td><td><button class="fc-btn-del inulin-del-node" data-nodeid="' + newId + '">✕</button></td>'; tr.querySelector('.inulin-del-node').addEventListener('click', function() { tr.remove(); }); tb.appendChild(tr); }); container.appendChild(addBtn); container.querySelectorAll('.inulin-del-node').forEach(function(btn) { btn.addEventListener('click', function() { var row = this.closest('tr'); if (row) row.remove(); }); }); if (parsed.edges.length > 0) { var eHelp = document.createElement('div'); eHelp.className = 'fc-editor-help'; eHelp.style.marginTop = '16px'; eHelp.textContent = '箭头标签：'; container.appendChild(eHelp); var eTable = document.createElement('table'); eTable.className = 'fc-node-table'; eTable.innerHTML = '<thead><tr><th>连接</th><th>线上文字</th><th style="width:40px"></th></tr></thead><tbody id="inulinEdgeBody"></tbody></table>'; container.appendChild(eTable); var etbody = document.getElementById('inulinEdgeBody'); for (var i = 0; i < parsed.edges.length; i++) { var e = parsed.edges[i]; if (!e.label) continue; var tr = document.createElement('tr'); tr.innerHTML = '<td><code>' + e.from + ' → ' + e.to + '</code></td><td><input class="fc-edge-label" data-edge="' + e.from + '|' + e.to + '" value="' + (e.label || '') + '" style="width:100%" /></td><td><button class="fc-btn-del inulin-del-edge">✕</button></td>'; tr.querySelector('.inulin-del-edge').addEventListener('click', function() { this.closest('tr').remove(); }); etbody.appendChild(tr); } var addEdgeBtn = document.createElement('button'); addEdgeBtn.className = 'btn btn-sm btn-secondary'; addEdgeBtn.style.margin = '8px 0'; addEdgeBtn.textContent = '+ 添加箭头标签'; addEdgeBtn.addEventListener('click', function() { var tb = document.getElementById('inulinEdgeBody'); var newId1 = 'N' + Date.now(); var newId2 = 'N' + (Date.now() + 1); var tr = document.createElement('tr'); tr.innerHTML = '<td><input class="fc-edge-input" value="' + newId1 + '-->' + newId2 + '" style="width:120px;font-size:12px" /></td><td><input class="fc-edge-label" value="" style="width:100%" /></td><td><button class="fc-btn-del inulin-del-edge">✕</button></td>'; tr.querySelector('.inulin-del-edge').addEventListener('click', function() { tr.remove(); }); tb.appendChild(tr); }); container.appendChild(addEdgeBtn); } var actions = document.createElement('div'); actions.className = 'fc-editor-actions'; actions.style.marginTop = '12px'; actions.innerHTML = '<button class="btn btn-primary btn-sm" id="inulinApply">✅ 应用修改</button><button class="btn btn-secondary btn-sm" id="inulinReset">↩️ 恢复默认</button><span class="fc-editor-status" id="inulinEditStatus"></span>'; container.appendChild(actions); document.getElementById('inulinApply').addEventListener('click', function() { var ns = currentSrc; var changes = 0; container.querySelectorAll('.fc-node-input').forEach(function(inp) { var nid = inp.dataset.nodeid; var nl = inp.value.trim(); if (!nid || !nl) return; var lens = ns.split('\n'); for (var j = 0; j < lens.length; j++) { var l = lens[j].trim(); var m = l.match(new RegExp('^' + nid + '\\["(.+?)"\\]')); if (m) { var ol = m[1]; if (ol !== nl) { ns = ns.split(nid + '["' + ol + '"]').join(nid + '["' + nl + '"]'); changes++; } break; } } }); container.querySelectorAll('.fc-edge-label').forEach(function(inp) { var edge = inp.dataset.edge; var nl = inp.value.trim(); if (!edge) return; var parts = edge.split('|'); if (parts.length !== 2) return; var from = parts[0], to = parts[1]; var lens = ns.split('\n'); for (var j = 0; j < lens.length; j++) { var l = lens[j].trim(); var m = l.match(new RegExp('^' + from + '\\s*[-=.]+>\\|(.+?)\\|\\s*' + to + '$')); if (m) { var ol = m[1]; if (nl === '') { ns = ns.split(l).join(from + ' --> ' + to); } else if (ol !== nl) { ns = ns.split('|' + ol + '|').join('|' + nl + '|'); } changes++; break; } } }); if (changes > 0) { try { localStorage.setItem('haccp_flowchart_mermaid', ns); } catch(e) {} document.getElementById('inulinEditStatus').textContent = '✅ 已应用 ' + changes + ' 处修改'; currentSrc = ns; } else { document.getElementById('inulinEditStatus').textContent = 'ℹ️ 未检测到修改'; } }); document.getElementById('inulinReset').addEventListener('click', function() { if (window.INULIN_FLOWCHART && window.INULIN_FLOWCHART.mermaid) { try { localStorage.setItem('haccp_flowchart_mermaid', window.INULIN_FLOWCHART.mermaid); } catch(e) {} document.getElementById('inulinEditStatus').textContent = '✅ 已恢复默认'; renderInulinBody(); } }); }
        function parseInulinNodes(src) { var nodes = [], edges = [], lens = src.split('\n'), nodeRegex = /^(\w+)\["(.+?)"\]/, edgeRegex = /^(\w+)\s*[-=.]+>\s*(?:\|(.+?)\|)?\s*(\w+)/; for (var i = 0; i < lens.length; i++) { var l = lens[i].trim(); if (!l || l.startsWith('%%') || l.startsWith('graph') || l.startsWith('classDef')) continue; var m = l.match(nodeRegex); if (m) { var id = m[1], label = m[2]; if (id === 'loop_text' || id === 'L6_text' || id === 'L7_text' || id === 'R2_text' || id === 'R3_text') continue; var type = 'step'; if (l.indexOf(':::ccp') > -1) type = 'ccp'; else if (l.indexOf(':::oprp') > -1) type = 'oprp'; else if (l.indexOf(':::cqp') > -1) type = 'cqp'; else if (l.indexOf(':::io') > -1) type = 'io'; nodes.push({ id: id, label: label, type: type }); continue; } var e = l.match(edgeRegex); if (e) edges.push({ from: e[1], to: e[3], label: e[2] || '' }); } return { nodes: nodes, edges: edges }; }
        renderInulinBody(); document.getElementById('inulinModalClose').onclick = function() { modal.remove(); }; modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
      });
    }
    const clearBtn = document.getElementById('clearFlowchartBtn');
    if (clearBtn) { clearBtn.addEventListener('click', () => { data.flowchartXml = ''; saveData(data); const area = document.getElementById('flowchartArea'); if (area) { area.innerHTML = renderFlowchartPreview(data); bindFlowchartButtons(data); } }); }
  }

  const DRAWIO_BASE = 'https://embed.diagrams.net/';
  function xesc(s) { if (!s) return ''; return String(s).replace(/[&]/g, '&').replace(/[<]/g, '<').replace(/[>]/g, '>').replace(/["]/g, '"'); }

  // 根据操作步骤生成 draw.io XML
  function generateDrawioXml(steps) {
    var validSteps = (steps || []).filter(function(s) { return s.stepName && s.stepName.trim(); });
    var cells = [];
    var NODE_W = 160, NODE_H = 60, ARROW_H = 40;
    var cx = 300; // 中心x

    // 起始节点
    var startY = 40;
    cells.push('<mxCell id="0" /><mxCell id="1" parent="0" />');
    cells.push('<mxCell id="start" value="开始" style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=14;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="' + (cx - 50) + '" y="' + startY + '" width="100" height="50" as="geometry" /></mxCell>');

    var prevId = 'start';
    var curY = startY + 50 + ARROW_H;

    for (var i = 0; i < validSteps.length; i++) {
      var step = validSteps[i];
      var nodeId = 'step_' + i;
      var isCCP = step.controlPoint && step.controlPoint.toLowerCase().indexOf('ccp') !== -1;
      var fillColor = isCCP ? '#f8cecc' : '#dae8fc';
      var strokeColor = isCCP ? '#b85450' : '#6c8ebf';
      var labelLines = [xesc(step.stepName)];
      if (step.parameters) labelLines.push('<font style="font-size:10px;color:#555;">' + xesc(step.parameters) + '</font>');
      if (isCCP && step.controlPoint) labelLines.push('<b style="color:#b85450;">' + xesc(step.controlPoint) + '</b>');
      var label = '<html>' + labelLines.join('<br>') + '</html>';

      cells.push('<mxCell id="' + nodeId + '" value="' + label + '" style="rounded=1;whiteSpace=wrap;html=1;fillColor=' + fillColor + ';strokeColor=' + strokeColor + ';fontSize=12;" vertex="1" parent="1"><mxGeometry x="' + (cx - NODE_W / 2) + '" y="' + curY + '" width="' + NODE_W + '" height="' + NODE_H + '" as="geometry" /></mxCell>');

      // 箭头
      var arrowId = 'arrow_' + i;
      cells.push('<mxCell id="' + arrowId + '" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="' + prevId + '" target="' + nodeId + '" parent="1"><mxGeometry relative="1" as="geometry" /></mxCell>');

      prevId = nodeId;
      curY += NODE_H + ARROW_H;
    }

    // 结束节点
    cells.push('<mxCell id="end" value="结束" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=14;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="' + (cx - 50) + '" y="' + curY + '" width="100" height="50" as="geometry" /></mxCell>');
    cells.push('<mxCell id="arrow_end" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="' + prevId + '" target="end" parent="1"><mxGeometry relative="1" as="geometry" /></mxCell>');

    var totalH = curY + 50 + 40;
    return '<?xml version="1.0" encoding="UTF-8"?><mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0"><root>' + cells.join('') + '</root></mxGraphModel>';
  }

  // 打开 draw.io 嵌入式编辑器
  function openDrawioEditor(data) {
    // 准备初始 XML
    var initXml = data.flowchartXml || '';
    if (!initXml) {
      var validSteps = (data.processSteps || []).filter(function(s) { return s.stepName && s.stepName.trim(); });
      initXml = generateDrawioXml(validSteps);
    }

    // 创建遮罩
    var overlay = document.createElement('div');
    overlay.className = 'q15-drawio-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = [
      '<div style="background:#fff;border-radius:10px;width:95vw;height:94vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);">',
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#1e293b;color:#fff;border-radius:10px 10px 0 0;">',
          '<span style="font-size:15px;font-weight:600;">✏️ Draw.io 流程图编辑器</span>',
          '<div style="display:flex;align-items:center;gap:10px;">',
            '<span id="drawioStatus" style="font-size:12px;color:#94a3b8;"></span>',
            '<button id="drawioSaveBtn" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:13px;">💾 保存</button>',
            '<button id="drawioCloseBtn" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;">✕ 关闭</button>',
          '</div>',
        '</div>',
        '<div style="flex:1;position:relative;background:#f1f5f9;">',
          '<div id="drawioLoadingMask" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f1f5f9;z-index:5;font-size:14px;color:#64748b;">',
            '<div style="text-align:center;"><div class="fc-spinner" style="width:36px;height:36px;border-width:4px;margin:0 auto 12px;"></div><p>正在加载 Draw.io 编辑器...</p><p style="font-size:12px;margin-top:4px;">如长时间未响应，请检查网络连接</p></div>',
          '</div>',
          '<iframe id="drawioFrame" src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&stealth=1&lang=zh" style="width:100%;height:100%;border:none;display:block;" allowfullscreen></iframe>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    var frame = document.getElementById('drawioFrame');
    var statusEl = document.getElementById('drawioStatus');
    var loadingMask = document.getElementById('drawioLoadingMask');
    var iframeReady = false;
    var pendingXml = initXml;
    var currentXml = initXml;

    function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

    // 与 draw.io iframe 的 postMessage 通信
    function sendToFrame(msg) {
      try { frame.contentWindow.postMessage(JSON.stringify(msg), '*'); } catch(e) {}
    }

    function handleMessage(evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch(e) { return; }
      if (!msg || !msg.event) return;

      if (msg.event === 'init') {
        // draw.io 已就绪，发送加载指令
        if (loadingMask) loadingMask.style.display = 'none';
        iframeReady = true;
        sendToFrame({ action: 'load', autosave: 1, xml: pendingXml || '' });
        setStatus('编辑中（修改后点击保存）');
      } else if (msg.event === 'autosave') {
        currentXml = msg.xml || currentXml;
        setStatus('自动保存中...');
        setTimeout(function() { setStatus('编辑中'); }, 1500);
      } else if (msg.event === 'save') {
        currentXml = msg.xml || currentXml;
        doSave();
      } else if (msg.event === 'export') {
        currentXml = msg.xml || currentXml;
        doSave();
      } else if (msg.event === 'close') {
        closeEditor();
      }
    }

    function doSave() {
      data.flowchartXml = currentXml;
      saveData(data);
      setStatus('✅ 已保存');
      // 刷新预览区域
      var area = document.getElementById('flowchartArea');
      if (area) {
        area.innerHTML = renderFlowchartPreview(data);
        bindFlowchartButtons(data);
      }
    }

    function closeEditor() {
      window.removeEventListener('message', handleMessage);
      overlay.remove();
    }

    window.addEventListener('message', handleMessage);

    document.getElementById('drawioSaveBtn').onclick = function() {
      // 请求 draw.io 导出当前 XML
      sendToFrame({ action: 'export', format: 'xml' });
    };
    document.getElementById('drawioCloseBtn').onclick = closeEditor;
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeEditor(); });

    // 超时提示
    setTimeout(function() {
      if (!iframeReady && loadingMask && loadingMask.style.display !== 'none') {
        loadingMask.innerHTML = '<div style="text-align:center;color:#dc2626;"><p style="font-size:16px;margin-bottom:8px;">⚠️ 加载超时</p><p style="font-size:13px;">无法连接到 Draw.io 服务器<br>请检查网络连接或稍后重试</p></div>';
      }
    }, 15000);
  }

  // ==================== 提交问卷 ====================
  function submitQuestionnaire(data) {
    const finalData = loadData();
    localStorage.setItem('haccp_15min_submitted', JSON.stringify(finalData));
    localStorage.setItem('haccp_submitted', 'true');
    localStorage.setItem(SECTION_COMPLETED_KEY, 'true');
    alert('问卷提交成功！\n\n您的HACCP问卷信息已保存，可前往「查看结果」页面查看。');
    App.navigateTo('results');
  }

  return { init: init, loadData: loadData, reset: function() { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SECTION_COMPLETED_KEY); currentStep = 0; } };
})();