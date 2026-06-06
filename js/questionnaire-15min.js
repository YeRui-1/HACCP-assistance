// 15分钟问卷 - 完整HACCP问卷填写模块
const Questionnaire15min = (() => {
  const STORAGE_KEY = 'haccp_15min_data';
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
      <div id="q15UploadArea"></div>
      <div id="q15Content"></div>
    `;
    renderUploadArea();
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
    _uploadedText = ''; _uploadedFileName = ''; _uploadedFileSize = 0; renderUploadArea();
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
  const SECTION_NAMES = ['企业信息', '产品信息', '生产流程', '危害分析', '关键限制', '验证程序', '记录与报表'];

  function renderSectionNav() {
    const data = loadData();
    const nav = document.getElementById('q15Progress');
    if (!nav) return;
    nav.innerHTML = SECTION_NAMES.map((name, i) => { const isActive = i === currentStep; const isDone = isStepCompleted(data, i); return '<div class="q15-step ' + (isActive ? 'active' : '') + ' ' + (isDone ? 'done' : '') + '" data-step="' + i + '"><div class="q15-step-num">' + (isDone ? '\u2713' : i + 1) + '</div><span>' + name + '</span></div>'; }).join('');
    nav.querySelectorAll('.q15-step').forEach(el => { el.addEventListener('click', () => { currentStep = parseInt(el.dataset.step); renderActiveSection(); renderSectionNav(); }); });
  }

  function isStepCompleted(data, step) {
    switch (step) { case 0: return !!data.companyName; case 1: return !!data.productName; case 2: return data.processSteps.some(s => s.stepName); case 3: return data.hazardConfirmed; case 4: return !!data.execStandard; case 5: return data.monitoring.some(m => m.ccp); case 6: return !!data.recordPeriod || !!data.recordFormat; default: return false; }
  }

  function renderActiveSection() {
    const content = document.getElementById('q15Content');
    if (!content) return;
    const data = loadData();
    const sections = [renderCompanyInfo, renderProductInfo, renderProcessFlow, renderHazardAnalysis, renderCriticalLimits, renderVerification, renderRecords];
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

  function renderProcessFlow(data) {
    return '<h3>配方以及依据</h3><p class="q15-table-hint">根据投料顺序列出原料、辅料及添加剂的精确用量，并解释关键原料的作用</p><table class="q15-table" id="formulaTable"><thead><tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th><th style="width:50px">操作</th></tr></thead><tbody id="formulaBody">' + data.formula.map(function(f, i) { return '<tr data-fm-idx="' + i + '"><td><input type="text" value="' + esc(f.material) + '" placeholder="如：活性炭"></td><td><input type="text" value="' + esc(f.dosage) + '" placeholder="如：Xx g/kg原料"></td><td><input type="text" value="' + esc(f.func) + '" placeholder="如：除去色素"></td><td><button class="q15-del-row" data-fm-idx="' + i + '">&times;</button></td></tr>'; }).join('') + '</tbody></table><button class="btn btn-sm btn-secondary" id="addFormulaRow">+ 添加原料</button><hr class="q15-divider"><h3>基于产品类型，AI列出常见危害</h3><p class="q15-table-hint">基于产品类型，系统将自动识别该产品常见的生物/化学/物理危害</p><div class="q15-ai-btn-wrapper"><button class="btn btn-secondary btn-sm" id="aiHazardBtn">\u{1F916} AI识别危害</button><span id="aiHazardHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div><div id="aiHazardResult" style="margin-top:12px;"></div><hr class="q15-divider"><h3>操作方式和步骤 <span class="required">*</span></h3><p class="q15-table-hint">详细描述每一步的具体操作方法、设备参数（温度、时间、转速等）</p><div id="processStepsList">' + data.processSteps.map(function(s, i) { return '<div class="q15-process-card" data-ps-idx="' + i + '"><div class="q15-process-header"><span class="q15-step-badge">步骤 ' + (i + 1) + '</span><button class="q15-del-process" data-ps-idx="' + i + '">&times;</button></div><div class="q15-process-grid"><div class="q15-field-group"><label>操作名称</label><input type="text" value="' + esc(s.stepName) + '" placeholder="如：原料清洗"></div><div class="q15-field-group"><label>操作方法</label><input type="text" value="' + esc(s.operationMethod) + '" placeholder="具体操作方法"></div><div class="q15-field-group"><label>工艺参数</label><input type="text" value="' + esc(s.parameters) + '" placeholder="如：温度：80\u2103，时间：30min"></div><div class="q15-field-group"><label>控制点</label><input type="text" value="' + esc(s.controlPoint) + '" placeholder="关键控制要求"></div><div class="q15-field-group"><label>设备名称</label><input type="text" value="' + esc(s.equipmentName) + '" placeholder="设备名称及型号"></div></div></div>'; }).join('') + '</div><button class="btn btn-sm btn-secondary" id="addProcessStep">+ 添加步骤</button><hr class="q15-divider"><h3>流程图编辑 <span style="font-size:13px;font-weight:400;color:var(--gray-400);">使用 draw.io 绘制生产流程图</span></h3><p class="q15-table-hint">通过 draw.io 在线编辑器绘制专业的生产工艺流程图，直观展示各生产步骤的顺序关系</p><div class="q15-flowchart-area" id="flowchartArea">' + renderFlowchartPreview(data) + '</div><hr class="q15-divider"><h3>流程图现场确认</h3><div class="q15-confirm-box"><label class="q15-checkbox-label"><input type="checkbox" data-q15-field="flowConfirmed"' + (data.flowConfirmed ? ' checked' : '') + '> HACCP小组已到生产现场，对以上流程图的每一步进行核对确认，确保与实际操作完全一致</label><p style="font-size:12px;color:var(--gray-400);margin-top:6px;">（确认内容包括：是否有额外的原料添加、步骤合并等）</p></div>';
  }

  function renderHazardAnalysis(data) {
    var bio = Array.isArray(data.hazardBio) ? data.hazardBio : [], chem = Array.isArray(data.hazardChem) ? data.hazardChem : [], phys = Array.isArray(data.hazardPhys) ? data.hazardPhys : [];
    return '<p class="q15-table-hint">根据CCP判断树结合危害的严重性、发生可能性、控制措施的有效性进行多维度判断，且需要团队的集体确认</p><h3>生物危害</h3><table class="q15-table"><thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead><tbody id="hazardBioBody">' + (bio.length > 0 ? bio.map(function(h, i) { return '<tr data-hb-idx="' + i + '"><td><input type="text" value="' + esc(h.desc || '') + '" placeholder="如：沙门氏菌"></td><td><select><option value="高"' + (h.severity === '高' ? ' selected' : '') + '>高</option><option value="中"' + (h.severity === '中' ? ' selected' : '') + '>中</option><option value="低"' + (h.severity === '低' ? ' selected' : '') + '>低</option></select></td><td><select><option value="高"' + (h.likelihood === '高' ? ' selected' : '') + '>高</option><option value="中"' + (h.likelihood === '中' ? ' selected' : '') + '>中</option><option value="低"' + (h.likelihood === '低' ? ' selected' : '') + '>低</option></select></td><td><input type="text" value="' + esc(h.control || '') + '" placeholder="控制措施"></td></tr>'; }).join('') : '<tr class="q15-empty-row"><td colspan="4" style="text-align:center;color:var(--gray-400);padding:20px;">点击上方AI识别后自动填充</td></tr>') + '</tbody></table><h3>化学危害</h3><table class="q15-table"><thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead><tbody id="hazardChemBody">' + (chem.length > 0 ? chem.map(function(h, i) { return '<tr data-hc-idx="' + i + '"><td><input type="text" value="' + esc(h.desc || '') + '" placeholder="如：农药残留"></td><td><select><option value="高"' + (h.severity === '高' ? ' selected' : '') + '>高</option><option value="中"' + (h.severity === '中' ? ' selected' : '') + '>中</option><option value="低"' + (h.severity === '低' ? ' selected' : '') + '>低</option></select></td><td><select><option value="高"' + (h.likelihood === '高' ? ' selected' : '') + '>高</option><option value="中"' + (h.likelihood === '中' ? ' selected' : '') + '>中</option><option value="低"' + (h.likelihood === '低' ? ' selected' : '') + '>低</option></select></td><td><input type="text" value="' + esc(h.control || '') + '" placeholder="控制措施"></td></tr>'; }).join('') : '<tr class="q15-empty-row"><td colspan="4" style="text-align:center;color:var(--gray-400);padding:20px;">点击上方AI识别后自动填充</td></tr>') + '</tbody></table><h3>物理危害</h3><table class="q15-table"><thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead><tbody id="hazardPhysBody">' + (phys.length > 0 ? phys.map(function(h, i) { return '<tr data-hp-idx="' + i + '"><td><input type="text" value="' + esc(h.desc || '') + '" placeholder="如：金属异物"></td><td><select><option value="高"' + (h.severity === '高' ? ' selected' : '') + '>高</option><option value="中"' + (h.severity === '中' ? ' selected' : '') + '>中</option><option value="低"' + (h.severity === '低' ? ' selected' : '') + '>低</option></select></td><td><select><option value="高"' + (h.likelihood === '高' ? ' selected' : '') + '>高</option><option value="中"' + (h.likelihood === '中' ? ' selected' : '') + '>中</option><option value="低"' + (h.likelihood === '低' ? ' selected' : '') + '>低</option></select></td><td><input type="text" value="' + esc(h.control || '') + '" placeholder="控制措施"></td></tr>'; }).join('') : '<tr class="q15-empty-row"><td colspan="4" style="text-align:center;color:var(--gray-400);padding:20px;">点击上方AI识别后自动填充</td></tr>') + '</tbody></table><div class="q15-confirm-box" style="margin-top:20px;"><label class="q15-checkbox-label"><input type="checkbox" data-q15-field="hazardConfirmed"' + (data.hazardConfirmed ? ' checked' : '') + '> 团队已对以上危害分析进行集体确认，无问题</label><p style="font-size:12px;color:var(--gray-400);margin-top:6px;">如有问题，可返回上一步重新编辑</p></div>';
  }

  function renderCriticalLimits(data) {
    return '<p class="q15-table-hint">得到关键控制点CCP以后，根据用户选择的执行标准，系统将提出相应的关键限制的设立。需要有科学依据（如法规标准、文献数据、实验验证结果）</p><div class="q15-field-group"><label>选择执行标准 <span class="required">*</span></label><select data-q15-field="execStandard"><option value="">请选择</option><option value="gb"' + (data.execStandard === 'gb' ? ' selected' : '') + '>国标（GB）</option><option value="industry"' + (data.execStandard === 'industry' ? ' selected' : '') + '>行业标准</option><option value="enterprise"' + (data.execStandard === 'enterprise' ? ' selected' : '') + '>企业标准</option><option value="international"' + (data.execStandard === 'international' ? ' selected' : '') + '>国际标准</option></select></div><div class="q15-ai-btn-wrapper"><button class="btn btn-secondary btn-sm" id="aiCriticalBtn">\u{1F916} AI建议关键限制</button><span id="aiCriticalHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div><div id="aiCriticalResult" style="margin-top:12px;"></div><div class="q15-field-group"><label>关键限制说明</label><textarea data-q15-field="criticalLimits" rows="5" placeholder="描述关键限制的科学依据和具体数值">' + esc(data.criticalLimits) + '</textarea></div>';
  }

  function renderVerification(data) {
    return '<h3>监控程序设置</h3><p class="q15-table-hint">AI根据危害的严重性、发生概率、法规要求、企业历史数据给出建议</p><div class="q15-ai-btn-wrapper" style="margin-bottom:12px;"><button class="btn btn-secondary btn-sm" id="aiMonitorBtn">\u{1F916} AI规划监控方案</button><span id="aiMonitorHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div><table class="q15-table"><thead><tr><th>关键控制点(CCP)</th><th>监控对象</th><th>监控方法</th><th>监控频率</th><th>监控人员</th><th>备注</th><th style="width:50px">操作</th></tr></thead><tbody id="monitorBody">' + data.monitoring.map(function(m, i) { return '<tr data-mn-idx="' + i + '"><td><input type="text" value="' + esc(m.ccp) + '" placeholder="如：CCP-3杀菌工序"></td><td><input type="text" value="' + esc(m.object) + '" placeholder="杀菌的温度、时间"></td><td><input type="text" value="' + esc(m.method) + '" placeholder="推荐：在线温度传感器连续监控"></td><td><input type="text" value="' + esc(m.frequency) + '" placeholder="如：每批次实时记录"></td><td><input type="text" value="' + esc(m.personnel) + '" placeholder="经过HACCP培训的品控专员"></td><td><input type="text" value="' + esc(m.remark) + '" placeholder="依据 GB 14881-2013"></td><td><button class="q15-del-row" data-mn-idx="' + i + '">&times;</button></td></tr>'; }).join('') + '</tbody></table><button class="btn btn-sm btn-secondary" id="addMonitorRow">+ 添加监控项</button><hr class="q15-divider"><h3>纠偏措施</h3><p class="q15-table-hint">根据偏差的实际情况，系统给出相应的验证措施建议。数据不满足关键限制的设定，即刻采取纠偏计划</p><table class="q15-table"><thead><tr><th>关键控制点(CCP)</th><th>关键限值(CL)</th><th>纠偏措施</th><th>验证</th><th>记录</th><th style="width:50px">操作</th></tr></thead><tbody id="correctiveBody">' + data.correctiveActions.map(function(c, i) { return '<tr data-ca-idx="' + i + '"><td><input type="text" value="' + esc(c.ccp) + '" placeholder="如：杀菌工序"></td><td><input type="text" value="' + esc(c.cl) + '" placeholder="如：90\u2103"></td><td><input type="text" value="' + esc(c.corrective) + '" placeholder="纠偏措施"></td><td><input type="text" value="' + esc(c.verification) + '" placeholder="验证方法"></td><td><input type="text" value="' + esc(c.record) + '" placeholder="记录表格"></td><td><button class="q15-del-row" data-ca-idx="' + i + '">&times;</button></td></tr>'; }).join('') + '</tbody></table><button class="btn btn-sm btn-secondary" id="addCorrectiveRow">+ 添加纠偏项</button>';
  }

  function renderRecords(data) {
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
    if (aiBtn) { aiBtn.addEventListener('click', function() { aiBtn.disabled = true; var hint = content.querySelector('#aiHazardHint'); if (hint) hint.textContent = 'AI分析中...'; setTimeout(function() { data.hazardBio = [{ desc: '沙门氏菌', severity: '高', likelihood: '中', control: '充分加热处理' }, { desc: '大肠杆菌', severity: '高', likelihood: '中', control: '严格卫生控制' }, { desc: '金黄色葡萄球菌', severity: '中', likelihood: '低', control: '温度控制' }]; data.hazardChem = [{ desc: '农药残留', severity: '高', likelihood: '低', control: '原料验收检测' }, { desc: '重金属污染', severity: '高', likelihood: '低', control: '供应商审核' }]; data.hazardPhys = [{ desc: '金属异物', severity: '中', likelihood: '中', control: '金属检测器' }, { desc: '玻璃碎片', severity: '高', likelihood: '低', control: '玻璃管理制度' }]; saveData(data); if (hint) hint.textContent = '\u2713 AI识别完成，请确认以下危害分析内容'; aiBtn.disabled = false; renderActiveSection(); }, 1000); }); }
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

    bindFlowchartButtons(data);
    const exportBtn = content.querySelector('#exportTableBtn');
    if (exportBtn) { exportBtn.addEventListener('click', function() { alert('导出功能：将生成空白记录表格供打印使用（此功能为占位，后续可实现为PDF/Excel导出）'); }); }
  }

  function collectHazardTableData(content, data) {
    [{ bodyId: 'hazardBioBody', key: 'hazardBio' }, { bodyId: 'hazardChemBody', key: 'hazardChem' }, { bodyId: 'hazardPhysBody', key: 'hazardPhys' }].forEach(function(_a) { var body = content.querySelector('#' + _a.bodyId); if (!body) return; var rows = body.querySelectorAll('tr:not(.q15-empty-row)'); data[_a.key] = []; rows.forEach(function(row) { var inputs = row.querySelectorAll('input'), selects = row.querySelectorAll('select'); if (inputs.length > 0) data[_a.key].push({ desc: inputs[0]?.value || '', severity: selects[0]?.value || '中', likelihood: selects[1]?.value || '中', control: inputs[1]?.value || '' }); }); });
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
    if (hasSteps) return '<div class="q15-vf-wrapper"><div class="q15-vf-actions"><button class="btn btn-primary" id="aiGenerateFlowchartBtn">\u{1F916} AI 生成流程图</button><button class="btn btn-primary" id="templateFlowchartBtn" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);">\u{1F4D0} 模板格式生成</button><button class="btn-flowchart" id="q15InulinBtn" style="font-size:13px;padding:6px 18px"><span class="fc-nav-icon">\u{1F4CA}</span> 菊粉工艺流程图</button><button class="btn btn-secondary btn-sm" id="openDrawioBtn">\u{1F4DD} draw.io高级编辑</button></div><div id="q15VfContainer">' + renderVisualFlowchart(data.processSteps) + '</div></div>';
    return '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">\u{1F4CA}</div><p>请先在上方填写操作步骤，AI将自动生成生产流程图</p><p style="font-size:12px;color:var(--gray-400);margin-top:8px;">支持在线编辑和导出</p></div>';
  }

  function bindFlowchartButtons(data) {
    const aiBtn = document.getElementById('aiGenerateFlowchartBtn');
    if (aiBtn) { aiBtn.addEventListener('click', async () => { const content = document.getElementById('q15Content'); if (content) collectSectionData(content, data); const productName = data.productName || ''; const processDesc = (data.processSteps || []).map(s => s.stepName).filter(Boolean).join(' → ') || ''; if (!productName && !processDesc) { alert('请至少填写产品名称或操作步骤'); return; } aiBtn.disabled = true; aiBtn.innerHTML = '\u23F3 AI生成中...'; try { const resp = await fetch('/api/ai/generate-flowchart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_name: productName, process_description: processDesc }) }); const result = await resp.json(); if (!resp.ok) throw new Error(result.detail || '生成失败'); if (result.ok && result.data && result.data.steps) { const newSteps = result.data.steps.map(s => ({ id: genId(), stepName: s.stepName || '', operationMethod: s.operationMethod || '', parameters: s.parameters || '', controlPoint: s.controlPoint || '', equipmentName: s.equipmentName || '' })); if (newSteps.length > 0) { data.processSteps = newSteps; saveData(data); const vfContainer = document.getElementById('q15VfContainer'); if (vfContainer) vfContainer.innerHTML = renderVisualFlowchart(data.processSteps); } aiBtn.innerHTML = '\u2713 已生成'; setTimeout(() => { aiBtn.innerHTML = '\u{1F916} AI 重新生成'; aiBtn.disabled = false; }, 3000); } } catch (err) { console.error(err); aiBtn.innerHTML = '\u274C 生成失败'; setTimeout(() => { aiBtn.innerHTML = '\u{1F916} AI 重新生成'; aiBtn.disabled = false; }, 2000); } }); }
    const templateBtn = document.getElementById('templateFlowchartBtn');
    if (templateBtn) { templateBtn.addEventListener('click', () => { const content = document.getElementById('q15Content'); if (content) collectSectionData(content, data); saveData(data); const validSteps = data.processSteps.filter(s => s.stepName && s.stepName.trim()); if (validSteps.length === 0) { alert('请先填写至少一个操作步骤'); return; } openDrawioEditor(data); }); }
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
  function generateDrawioXml(steps) { return null; }
  function openDrawioEditor(data) { alert('draw.io 编辑器将在完整版中启用'); }

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