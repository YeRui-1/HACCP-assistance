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
      // 一、企业信息
      companyName: '',
      deptName: '',
      haccpTeam: [{ id: genId(), name: '', dept: '', position: '', role: '' }],
      auditor: '',
      // 二、产品信息
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
      // 三、生产流程
      formula: [{ id: genId(), material: '', dosage: '', func: '' }],
      processSteps: [{ id: genId(), stepName: '', operationMethod: '', parameters: '', controlPoint: '', equipmentName: '' }],
      flowConfirmed: false,
      // 四、危害分析
      hazardBio: [],
      hazardChem: [],
      hazardPhys: [],
      hazardConfirmed: false,
      // 五、关键限制
      execStandard: '',
      criticalLimits: '',
      // 六、验证程序
      monitoring: [{ id: genId(), ccp: '', object: '', method: '', frequency: '', personnel: '', remark: '' }],
      correctiveActions: [{ id: genId(), ccp: '', cl: '', corrective: '', verification: '', record: '' }],
      // 七、记录
      recordPeriod: '',
      recordFormat: '',
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        // 合并默认值
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

  // ===== 入口 =====
  // ===== 文件上传状态 =====
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
        <div class="q15-upload-zone-icon">${hasFile ? '📄' : '📁'}</div>
        <div class="q15-upload-zone-title">${hasFile ? '文件已解析' : '文件导入（可选）'}</div>
        <div class="q15-upload-zone-hint">${hasFile ? _uploadedFileName : '拖拽文件到此处，或点击选择文件'}</div>
        ${!hasFile ? '<div class="q15-upload-zone-hint" style="margin-top:4px;">支持 Word (.docx) / PDF (.pdf)</div>' : ''}
        <input type="file" id="q15FileInput" accept=".docx,.pdf" ${hasFile ? 'disabled' : ''}>
        ${!hasFile ? '<button class="q15-upload-btn" id="q15SelectFileBtn">📂 选择文件</button>' : ''}
      </div>
      ${_uploadedText ? `
        <div class="q15-upload-file-info">
          <span class="q15-file-icon">📄</span>
          <span class="q15-file-name">${esc(_uploadedFileName)}</span>
          <span class="q15-file-size">${formatFileSize(_uploadedFileSize)}</span>
          <span class="q15-file-status ok">✓ 解析成功</span>
          <button class="btn btn-xs btn-secondary" id="q15ClearFileBtn">清除</button>
        </div>
        <div class="q15-upload-preview">${esc(_uploadedText.slice(0, 300))}${_uploadedText.length > 300 ? '...' : ''}</div>
        <div class="q15-upload-actions">
          <button class="btn btn-primary" id="q15AiFillBtn">🤖 AI识别并填写问卷</button>
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

    // 点击选择文件
    const selectBtn = document.getElementById('q15SelectFileBtn');
    if (selectBtn && fileInput) {
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    // 文件选择变化
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleFile(e.target.files[0]);
        }
      });
    }

    // 拖拽事件
    if (zone) {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          handleFile(e.dataTransfer.files[0]);
        }
      });
    }

    // 清除文件
    const clearBtn = document.getElementById('q15ClearFileBtn');
    const clearBtn2 = document.getElementById('q15ClearFileBtn2');
    if (clearBtn) clearBtn.addEventListener('click', clearUploadedFile);
    if (clearBtn2) clearBtn2.addEventListener('click', clearUploadedFile);

    // AI 填充按钮
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
    if (err) {
      err.textContent = msg;
      err.style.display = 'block';
    }
  }

  function hideUploadError() {
    const err = document.getElementById('q15UploadError');
    if (err) err.style.display = 'none';
  }

  function clearUploadedFile() {
    _uploadedText = '';
    _uploadedFileName = '';
    _uploadedFileSize = 0;
    renderUploadArea();
  }

  async function handleFile(file) {
    hideUploadError();
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext !== 'docx' && ext !== 'pdf') {
      showUploadError('只支持 Word (.docx) 和 PDF (.pdf) 文件');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showUploadError('文件大小不能超过 20MB');
      return;
    }

    // 检查 CDN 库是否加载成功
    if (ext === 'docx' && typeof mammoth === 'undefined') {
      showUploadError('Word 解析库未加载。请检查网络连接后刷新页面重试。');
      return;
    }
    if (ext === 'pdf' && (typeof pdfjsLib === 'undefined' || typeof pdfjsLib.getDocument !== 'function')) {
      showUploadError('PDF 解析库未加载。请检查网络连接后刷新页面重试。');
      return;
    }

    _uploadedFileName = file.name;
    _uploadedFileSize = file.size;

    try {
      let text = '';
      if (ext === 'docx') {
        text = await parseDocx(file);
      } else if (ext === 'pdf') {
        text = await parsePdf(file);
      }

      if (!text.trim()) {
        showUploadError('未能从文件中提取到有效文本，请检查文件内容');
        return;
      }

      _uploadedText = text;
      renderUploadArea();
    } catch (err) {
      showUploadError('文件解析失败：' + (err.message || '未知错误') + '。请尝试重新选择文件。');
    }
  }

  async function parseDocx(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value || '');
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function parsePdf(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
          }
          resolve(text.trim());
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function handleAiFill() {
    const aiBtn = document.getElementById('q15AiFillBtn');
    if (!aiBtn) return;
    if (!_uploadedText) {
      showUploadError('请先上传并解析文件');
      return;
    }

    // 先保存当前已填写的表单数据
    const content = document.getElementById('q15Content');
    const data = loadData();
    if (content) collectSectionData(content, data);

    aiBtn.disabled = true;
    aiBtn.textContent = '⏳ AI分析中...';

    try {
      // 尝试调用后端 API
      const res = await fetch('/api/ai/fill-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: _uploadedText }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.detail || 'AI 分析失败');
      }

      if (result.ok && result.data) {
        applyAiFillResult(result.data, aiBtn);
      } else {
        throw new Error('返回数据格式异常');
      }
    } catch (err) {
      // 后端不可用时，使用前端 mock 填充
      console.warn('后端不可用，使用前端 mock 填充:', err.message);
      const mockResult = frontendMockFill(_uploadedText);
      applyAiFillResult(mockResult, aiBtn);
    }
  }

  function applyAiFillResult(aiData, aiBtn) {
    applyAiData(aiData);
    aiBtn.textContent = '✓ AI填充完成，请检查并修改';
    aiBtn.className = 'btn btn-primary';
    setTimeout(() => {
      aiBtn.disabled = false;
      aiBtn.textContent = '🤖 AI重新填写问卷';
      aiBtn.className = 'btn btn-primary';
    }, 3000);
    renderSectionNav();
    // 跳转到第1步方便查看填充结果
    currentStep = 0;
    renderActiveSection();
    renderSectionNav();
  }

  function frontendMockFill(text) {
    // 前端关键词提取 + 默认 demo 数据
    var result = {
      companyName: '',
      deptName: '品控部',
      haccpTeam: [
        { name: '张工', dept: '品控部', position: '主管', role: '组长' },
        { name: '李工', dept: '生产部', position: '主任', role: '副组长' },
      ],
      auditor: '王审核员',
      productName: '',
      rawMaterials: '',
      additives: '',
      productPH: '',
      waterActivity: '',
      intendedUse: '供消费者直接食用',
      storageCondition: '阴凉干燥处保存',
      packagingMethod: '真空包装',
      targetConsumer: '一般人群',
      shelfLife: '12个月',
      formula: [
        { material: '主原料', dosage: '100g/kg', func: '主要成分' },
      ],
      processSteps: [
        { stepName: '原料验收', operationMethod: '检查供应商报告', parameters: '温度≤25℃', controlPoint: 'CCP-1', equipmentName: '' },
        { stepName: '杀菌处理', operationMethod: '高温杀菌', parameters: '中心温度≥85℃，时间≥15s', controlPoint: 'CCP-3', equipmentName: '杀菌釜' },
        { stepName: '金属检测', operationMethod: '在线金属检测', parameters: 'Fe≤1.5mm, SUS≤2.0mm', controlPoint: 'CCP-4', equipmentName: '金属检测仪' },
      ],
      execStandard: 'gb',
      criticalLimits: '依据GB 14881-2013，杀菌中心温度≥85℃，保持时间≥15秒',
      hazardBio: [
        { desc: '沙门氏菌', severity: '高', likelihood: '中', control: '充分加热处理' },
        { desc: '大肠杆菌', severity: '高', likelihood: '中', control: '严格卫生控制' },
      ],
      hazardChem: [
        { desc: '农药残留', severity: '高', likelihood: '低', control: '原料验收检测' },
      ],
      hazardPhys: [
        { desc: '金属异物', severity: '中', likelihood: '中', control: '金属检测器' },
      ],
      monitoring: [
        { ccp: 'CCP-3 杀菌工序', object: '杀菌温度、时间', method: '在线温度传感器连续监控', frequency: '每批次实时记录', personnel: '品控专员', remark: '依据GB 14881-2013' },
      ],
      correctiveActions: [
        { ccp: '杀菌工序', cl: '≥85℃', corrective: '温度不足时升温补足', verification: '复测温度', record: '温度纠偏记录表' },
      ],
      recordPeriod: '2年',
      recordFormat: '电子版+纸质版',
    };

    // 尝试从文本中提取关键词
    try {
      function extract(regex) {
        var m = text.match(regex);
        return m ? m[1].trim() : '';
      }
      result.companyName = extract(/(?:企业名称|公司名称|企业)[：:]\s*([^\n，。,\.]+)/) || '';
      result.productName = extract(/(?:产品名称|产品名|产品)[：:]\s*([^\n，。,\.]+)/) || '';
      result.rawMaterials = extract(/(?:原料|原材料)[：:]\s*([^\n。]+)/) || '';
      result.storageCondition = extract(/(?:储存条件|贮藏条件|存储条件)[：:]\s*([^\n。]+)/) || '';
      result.shelfLife = extract(/(?:保质期|保存期)[：:]\s*([^\n。]+)/) || '';
    } catch (e) { /* ignore */ }

    return result;
  }

  function applyAiData(aiData) {
    const data = loadData();

    // 通用字段
    if (aiData.companyName) data.companyName = aiData.companyName;
    if (aiData.deptName) data.deptName = aiData.deptName;
    if (aiData.auditor) data.auditor = aiData.auditor;
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

    // HACCP 小组成员
    if (aiData.haccpTeam && Array.isArray(aiData.haccpTeam) && aiData.haccpTeam.length > 0) {
      data.haccpTeam = aiData.haccpTeam.map(m => ({
        id: genId(),
        name: m.name || '',
        dept: m.dept || '',
        position: m.position || '',
        role: m.role || '',
      }));
    }

    // 配方
    if (aiData.formula && Array.isArray(aiData.formula) && aiData.formula.length > 0) {
      data.formula = aiData.formula.map(f => ({
        id: genId(),
        material: f.material || '',
        dosage: f.dosage || '',
        func: f.func || '',
      }));
    }

    // 生产步骤
    if (aiData.processSteps && Array.isArray(aiData.processSteps) && aiData.processSteps.length > 0) {
      data.processSteps = aiData.processSteps.map(s => ({
        id: genId(),
        stepName: s.stepName || '',
        operationMethod: s.operationMethod || '',
        parameters: s.parameters || '',
        controlPoint: s.controlPoint || '',
        equipmentName: s.equipmentName || '',
      }));
    }

    // 危害分析
    if (aiData.hazardBio && Array.isArray(aiData.hazardBio)) {
      data.hazardBio = aiData.hazardBio.map(h => ({
        desc: h.desc || '',
        severity: h.severity || '中',
        likelihood: h.likelihood || '中',
        control: h.control || '',
      }));
    }
    if (aiData.hazardChem && Array.isArray(aiData.hazardChem)) {
      data.hazardChem = aiData.hazardChem.map(h => ({
        desc: h.desc || '',
        severity: h.severity || '中',
        likelihood: h.likelihood || '中',
        control: h.control || '',
      }));
    }
    if (aiData.hazardPhys && Array.isArray(aiData.hazardPhys)) {
      data.hazardPhys = aiData.hazardPhys.map(h => ({
        desc: h.desc || '',
        severity: h.severity || '中',
        likelihood: h.likelihood || '中',
        control: h.control || '',
      }));
    }

    // 监控
    if (aiData.monitoring && Array.isArray(aiData.monitoring) && aiData.monitoring.length > 0) {
      data.monitoring = aiData.monitoring.map(m => ({
        id: genId(),
        ccp: m.ccp || '',
        object: m.object || '',
        method: m.method || '',
        frequency: m.frequency || '',
        personnel: m.personnel || '',
        remark: m.remark || '',
      }));
    }

    // 纠偏措施
    if (aiData.correctiveActions && Array.isArray(aiData.correctiveActions) && aiData.correctiveActions.length > 0) {
      data.correctiveActions = aiData.correctiveActions.map(c => ({
        id: genId(),
        ccp: c.ccp || '',
        cl: c.cl || '',
        corrective: c.corrective || '',
        verification: c.verification || '',
        record: c.record || '',
      }));
    }

    saveData(data);
    renderActiveSection();
  }

  let currentStep = 0;
  const TOTAL_STEPS = 7;

  const SECTION_NAMES = [
    '企业信息',
    '产品信息',
    '生产流程',
    '危害分析',
    '关键限制',
    '验证程序',
    '记录与报表'
  ];

  function renderSectionNav() {
    const data = loadData();
    const nav = document.getElementById('q15Progress');
    if (!nav) return;
    nav.innerHTML = SECTION_NAMES.map((name, i) => {
      const isActive = i === currentStep;
      const isDone = isStepCompleted(data, i);
      return `
        <div class="q15-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}" data-step="${i}">
          <div class="q15-step-num">${isDone ? '✓' : i + 1}</div>
          <span>${name}</span>
        </div>
      `;
    }).join('');

    nav.querySelectorAll('.q15-step').forEach(el => {
      el.addEventListener('click', () => {
        currentStep = parseInt(el.dataset.step);
        renderActiveSection();
        renderSectionNav();
      });
    });
  }

  function isStepCompleted(data, step) {
    switch (step) {
      case 0: return !!data.companyName;
      case 1: return !!data.productName;
      case 2: return data.processSteps.some(s => s.stepName);
      case 3: return data.hazardConfirmed;
      case 4: return !!data.execStandard;
      case 5: return data.monitoring.some(m => m.ccp);
      case 6: return !!data.recordPeriod || !!data.recordFormat;
      default: return false;
    }
  }

  function renderActiveSection() {
    const content = document.getElementById('q15Content');
    if (!content) return;
    const data = loadData();

    const sections = [
      renderCompanyInfo,
      renderProductInfo,
      renderProcessFlow,
      renderHazardAnalysis,
      renderCriticalLimits,
      renderVerification,
      renderRecords
    ];

    const sectionHTML = sections[currentStep](data);
    content.innerHTML = `
      <div class="q15-section">
        <h2>${SECTION_NAMES[currentStep]}</h2>
        ${sectionHTML}
      </div>
      <div class="q15-nav-buttons">
        <button class="btn btn-secondary" id="q15PrevBtn" ${currentStep === 0 ? 'disabled' : ''}>← 上一步</button>
        <span class="q15-step-indicator">第 ${currentStep + 1} / ${TOTAL_STEPS} 步</span>
        ${currentStep < TOTAL_STEPS - 1 
          ? `<button class="btn btn-primary" id="q15NextBtn">下一步 →</button>`
          : `<button class="btn btn-primary btn-lg" id="q15SubmitBtn">✓ 提交问卷</button>`
        }
      </div>
    `;

    // 绑定事件
    bindSectionEvents(content, data);

    document.getElementById('q15PrevBtn')?.addEventListener('click', () => {
      collectSectionData(content, data);
      saveData(data);
      if (currentStep > 0) { currentStep--; renderActiveSection(); renderSectionNav(); }
    });

    const nextBtn = document.getElementById('q15NextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        collectSectionData(content, data);
        saveData(data);
        if (currentStep < TOTAL_STEPS - 1) { currentStep++; renderActiveSection(); renderSectionNav(); }
      });
    }

    document.getElementById('q15SubmitBtn')?.addEventListener('click', () => {
      collectSectionData(content, data);
      saveData(data);
      submitQuestionnaire(data);
    });
  }

  function collectSectionData(content, data) {
    // 通用字段收集
    const inputs = content.querySelectorAll('[data-q15-field]');
    inputs.forEach(el => {
      const field = el.dataset.q15Field;
      if (el.type === 'checkbox') {
        data[field] = el.checked;
      } else {
        data[field] = el.value;
      }
    });
  }

  // ==================== 渲染各章节 ====================

  // ---- 一、企业信息 ----
  function renderCompanyInfo(data) {
    return `
      <div class="q15-field-group">
        <label>企业名称 <span class="required">*</span></label>
        <input type="text" data-q15-field="companyName" value="${esc(data.companyName)}" placeholder="请输入企业名称">
      </div>
      <div class="q15-field-group">
        <label>制定部门 <span class="required">*</span></label>
        <input type="text" data-q15-field="deptName" value="${esc(data.deptName)}" placeholder="请输入制定部门">
      </div>
      <div class="q15-field-group">
        <label>审核人员</label>
        <input type="text" data-q15-field="auditor" value="${esc(data.auditor)}" placeholder="请输入审核人员姓名">
      </div>

      <div class="q15-table-section">
        <h3>HACCP小组成员 <span class="required">*</span></h3>
        <p class="q15-table-hint">成员涵盖生产、品控、设备、仓储、采购等部门负责人，必要时需要外部专家参与</p>
        <table class="q15-table" id="teamTable">
          <thead>
            <tr>
              <th>姓名</th>
              <th>部门</th>
              <th>职位</th>
              <th>小组职责</th>
              <th style="width:50px">操作</th>
            </tr>
          </thead>
          <tbody id="teamBody">
            ${data.haccpTeam.map((m, i) => `
              <tr data-team-idx="${i}">
                <td><input type="text" value="${esc(m.name)}" placeholder="姓名"></td>
                <td><input type="text" value="${esc(m.dept)}" placeholder="部门"></td>
                <td><input type="text" value="${esc(m.position)}" placeholder="职位"></td>
                <td><input type="text" value="${esc(m.role)}" placeholder="如：组长、副组长"></td>
                <td><button class="q15-del-row" data-team-idx="${i}">&times;</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <button class="btn btn-sm btn-secondary" id="addTeamRow">+ 添加成员</button>
      </div>
    `;
  }

  // ---- 二、产品信息 ----
  function renderProductInfo(data) {
    return `
      <div class="q15-field-group">
        <label>产品名称 <span class="required">*</span></label>
        <input type="text" data-q15-field="productName" value="${esc(data.productName)}" placeholder="请输入产品名称">
      </div>
      <div class="q15-field-group">
        <label>主要原料</label>
        <textarea data-q15-field="rawMaterials" placeholder="列出主要原料，不同原料用逗号分隔">${esc(data.rawMaterials)}</textarea>
      </div>
      <div class="q15-field-group">
        <label>添加剂</label>
        <textarea data-q15-field="additives" placeholder="列出使用的添加剂，不同添加剂用逗号分隔">${esc(data.additives)}</textarea>
      </div>
      <div class="q15-row">
        <div class="q15-field-group">
          <label>产品的特性PH</label>
          <input type="number" step="0.01" data-q15-field="productPH" value="${esc(data.productPH)}" placeholder="如：6.5">
        </div>
        <div class="q15-field-group">
          <label>水分活度</label>
          <input type="number" step="0.01" data-q15-field="waterActivity" value="${esc(data.waterActivity)}" placeholder="如：0.85">
        </div>
      </div>
      <div class="q15-field-group">
        <label>预期用途</label>
        <textarea data-q15-field="intendedUse" placeholder="描述产品的预期用途和消费群体如何使用该产品">${esc(data.intendedUse)}</textarea>
      </div>
      <div class="q15-row">
        <div class="q15-field-group">
          <label>储存条件</label>
          <input type="text" data-q15-field="storageCondition" value="${esc(data.storageCondition)}" placeholder="如：阴凉干燥处">
        </div>
        <div class="q15-field-group">
          <label>包装方式</label>
          <input type="text" data-q15-field="packagingMethod" value="${esc(data.packagingMethod)}" placeholder="如：真空包装">
        </div>
      </div>
      <div class="q15-row">
        <div class="q15-field-group">
          <label>目标消费者</label>
          <input type="text" data-q15-field="targetConsumer" value="${esc(data.targetConsumer)}" placeholder="如：一般人群">
        </div>
        <div class="q15-field-group">
          <label>保质期</label>
          <input type="text" data-q15-field="shelfLife" value="${esc(data.shelfLife)}" placeholder="如：12个月">
        </div>
      </div>
    `;
  }

  // ---- 三、生产流程 ----
  function renderProcessFlow(data) {
    return `
      <h3>配方以及依据</h3>
      <p class="q15-table-hint">根据投料顺序列出原料、辅料及添加剂的精确用量，并解释关键原料的作用</p>
      <table class="q15-table" id="formulaTable">
        <thead>
          <tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th><th style="width:50px">操作</th></tr>
        </thead>
        <tbody id="formulaBody">
          ${data.formula.map((f, i) => `
            <tr data-fm-idx="${i}">
              <td><input type="text" value="${esc(f.material)}" placeholder="如：活性炭"></td>
              <td><input type="text" value="${esc(f.dosage)}" placeholder="如：Xx g/kg原料"></td>
              <td><input type="text" value="${esc(f.func)}" placeholder="如：除去色素"></td>
              <td><button class="q15-del-row" data-fm-idx="${i}">&times;</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button class="btn btn-sm btn-secondary" id="addFormulaRow">+ 添加原料</button>

      <hr class="q15-divider">

      <h3>基于产品类型，AI列出常见危害</h3>
      <p class="q15-table-hint">基于产品类型，系统将自动识别该产品常见的生物/化学/物理危害</p>
      <div class="q15-ai-btn-wrapper">
        <button class="btn btn-secondary btn-sm" id="aiHazardBtn">🤖 AI识别危害</button>
        <span id="aiHazardHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span>
      </div>
      <div id="aiHazardResult" style="margin-top:12px;"></div>

      <hr class="q15-divider">

      <h3>操作方式和步骤 <span class="required">*</span></h3>
      <p class="q15-table-hint">详细描述每一步的具体操作方法、设备参数（温度、时间、转速等）</p>
      <div id="processStepsList">
        ${data.processSteps.map((s, i) => `
          <div class="q15-process-card" data-ps-idx="${i}">
            <div class="q15-process-header">
              <span class="q15-step-badge">步骤 ${i + 1}</span>
              <button class="q15-del-process" data-ps-idx="${i}">&times;</button>
            </div>
            <div class="q15-process-grid">
              <div class="q15-field-group">
                <label>操作名称</label>
                <input type="text" value="${esc(s.stepName)}" placeholder="如：原料清洗">
              </div>
              <div class="q15-field-group">
                <label>操作方法</label>
                <input type="text" value="${esc(s.operationMethod)}" placeholder="具体操作方法">
              </div>
              <div class="q15-field-group">
                <label>工艺参数</label>
                <input type="text" value="${esc(s.parameters)}" placeholder="如：温度：80℃，时间：30min">
              </div>
              <div class="q15-field-group">
                <label>控制点</label>
                <input type="text" value="${esc(s.controlPoint)}" placeholder="关键控制要求">
              </div>
              <div class="q15-field-group">
                <label>设备名称</label>
                <input type="text" value="${esc(s.equipmentName)}" placeholder="设备名称及型号">
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-sm btn-secondary" id="addProcessStep">+ 添加步骤</button>

      <hr class="q15-divider">

      <h3>流程图现场确认</h3>
      <div class="q15-confirm-box">
        <label class="q15-checkbox-label">
          <input type="checkbox" data-q15-field="flowConfirmed" ${data.flowConfirmed ? 'checked' : ''}>
          HACCP小组已到生产现场，对以上流程图的每一步进行核对确认，确保与实际操作完全一致
        </label>
        <p style="font-size:12px;color:var(--gray-400);margin-top:6px;">（确认内容包括：是否有额外的原料添加、步骤合并等）</p>
      </div>
    `;
  }

  // ---- 四、危害分析 ----
  function renderHazardAnalysis(data) {
    const bio = Array.isArray(data.hazardBio) ? data.hazardBio : [];
    const chem = Array.isArray(data.hazardChem) ? data.hazardChem : [];
    const phys = Array.isArray(data.hazardPhys) ? data.hazardPhys : [];

    return `
      <p class="q15-table-hint">根据CCP判断树结合危害的严重性、发生可能性、控制措施的有效性进行多维度判断，且需要团队的集体确认</p>
      
      <h3>生物危害</h3>
      <table class="q15-table">
        <thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead>
        <tbody id="hazardBioBody">
          ${bio.length > 0 ? bio.map((h, i) => `
            <tr data-hb-idx="${i}">
              <td><input type="text" value="${esc(h.desc || '')}" placeholder="如：沙门氏菌"></td>
              <td><select><option value="高" ${h.severity === '高' ? 'selected' : ''}>高</option><option value="中" ${h.severity === '中' ? 'selected' : ''}>中</option><option value="低" ${h.severity === '低' ? 'selected' : ''}>低</option></select></td>
              <td><select><option value="高" ${h.likelihood === '高' ? 'selected' : ''}>高</option><option value="中" ${h.likelihood === '中' ? 'selected' : ''}>中</option><option value="低" ${h.likelihood === '低' ? 'selected' : ''}>低</option></select></td>
              <td><input type="text" value="${esc(h.control || '')}" placeholder="控制措施"></td>
            </tr>
          `).join('') : `
            <tr class="q15-empty-row">
              <td colspan="4" style="text-align:center;color:var(--gray-400);padding:20px;">点击上方AI识别后自动填充</td>
            </tr>
          `}
        </tbody>
      </table>

      <h3>化学危害</h3>
      <table class="q15-table">
        <thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead>
        <tbody id="hazardChemBody">
          ${chem.length > 0 ? chem.map((h, i) => `
            <tr data-hc-idx="${i}">
              <td><input type="text" value="${esc(h.desc || '')}" placeholder="如：农药残留"></td>
              <td><select><option value="高" ${h.severity === '高' ? 'selected' : ''}>高</option><option value="中" ${h.severity === '中' ? 'selected' : ''}>中</option><option value="低" ${h.severity === '低' ? 'selected' : ''}>低</option></select></td>
              <td><select><option value="高" ${h.likelihood === '高' ? 'selected' : ''}>高</option><option value="中" ${h.likelihood === '中' ? 'selected' : ''}>中</option><option value="低" ${h.likelihood === '低' ? 'selected' : ''}>低</option></select></td>
              <td><input type="text" value="${esc(h.control || '')}" placeholder="控制措施"></td>
            </tr>
          `).join('') : `
            <tr class="q15-empty-row">
              <td colspan="4" style="text-align:center;color:var(--gray-400);padding:20px;">点击上方AI识别后自动填充</td>
            </tr>
          `}
        </tbody>
      </table>

      <h3>物理危害</h3>
      <table class="q15-table">
        <thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead>
        <tbody id="hazardPhysBody">
          ${phys.length > 0 ? phys.map((h, i) => `
            <tr data-hp-idx="${i}">
              <td><input type="text" value="${esc(h.desc || '')}" placeholder="如：金属异物"></td>
              <td><select><option value="高" ${h.severity === '高' ? 'selected' : ''}>高</option><option value="中" ${h.severity === '中' ? 'selected' : ''}>中</option><option value="低" ${h.severity === '低' ? 'selected' : ''}>低</option></select></td>
              <td><select><option value="高" ${h.likelihood === '高' ? 'selected' : ''}>高</option><option value="中" ${h.likelihood === '中' ? 'selected' : ''}>中</option><option value="低" ${h.likelihood === '低' ? 'selected' : ''}>低</option></select></td>
              <td><input type="text" value="${esc(h.control || '')}" placeholder="控制措施"></td>
            </tr>
          `).join('') : `
            <tr class="q15-empty-row">
              <td colspan="4" style="text-align:center;color:var(--gray-400);padding:20px;">点击上方AI识别后自动填充</td>
            </tr>
          `}
        </tbody>
      </table>

      <div class="q15-confirm-box" style="margin-top:20px;">
        <label class="q15-checkbox-label">
          <input type="checkbox" data-q15-field="hazardConfirmed" ${data.hazardConfirmed ? 'checked' : ''}>
          团队已对以上危害分析进行集体确认，无问题
        </label>
        <p style="font-size:12px;color:var(--gray-400);margin-top:6px;">如有问题，可返回上一步重新编辑</p>
      </div>
    `;
  }

  // ---- 五、关键限制 ----
  function renderCriticalLimits(data) {
    return `
      <p class="q15-table-hint">得到关键控制点CCP以后，根据用户选择的执行标准，系统将提出相应的关键限制的设立。需要有科学依据（如法规标准、文献数据、实验验证结果）</p>
      
      <div class="q15-field-group">
        <label>选择执行标准 <span class="required">*</span></label>
        <select data-q15-field="execStandard">
          <option value="">请选择</option>
          <option value="gb" ${data.execStandard === 'gb' ? 'selected' : ''}>国标（GB）</option>
          <option value="industry" ${data.execStandard === 'industry' ? 'selected' : ''}>行业标准</option>
          <option value="enterprise" ${data.execStandard === 'enterprise' ? 'selected' : ''}>企业标准</option>
          <option value="international" ${data.execStandard === 'international' ? 'selected' : ''}>国际标准</option>
        </select>
      </div>

      <div class="q15-ai-btn-wrapper">
        <button class="btn btn-secondary btn-sm" id="aiCriticalBtn">🤖 AI建议关键限制</button>
        <span id="aiCriticalHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span>
      </div>
      <div id="aiCriticalResult" style="margin-top:12px;"></div>

      <div class="q15-field-group">
        <label>关键限制说明</label>
        <textarea data-q15-field="criticalLimits" rows="5" placeholder="描述关键限制的科学依据和具体数值">${esc(data.criticalLimits)}</textarea>
      </div>
    `;
  }

  // ---- 六、验证程序 ----
  function renderVerification(data) {
    return `
      <h3>监控程序设置</h3>
      <p class="q15-table-hint">AI根据危害的严重性、发生概率、法规要求、企业历史数据给出建议</p>
      <div class="q15-ai-btn-wrapper" style="margin-bottom:12px;">
        <button class="btn btn-secondary btn-sm" id="aiMonitorBtn">🤖 AI规划监控方案</button>
        <span id="aiMonitorHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span>
      </div>
      <table class="q15-table">
        <thead>
          <tr>
            <th>关键控制点(CCP)</th>
            <th>监控对象</th>
            <th>监控方法</th>
            <th>监控频率</th>
            <th>监控人员</th>
            <th>备注</th>
            <th style="width:50px">操作</th>
          </tr>
        </thead>
        <tbody id="monitorBody">
          ${data.monitoring.map((m, i) => `
            <tr data-mn-idx="${i}">
              <td><input type="text" value="${esc(m.ccp)}" placeholder="如：CCP-3杀菌工序"></td>
              <td><input type="text" value="${esc(m.object)}" placeholder="杀菌的温度、时间"></td>
              <td><input type="text" value="${esc(m.method)}" placeholder="推荐：在线温度传感器连续监控"></td>
              <td><input type="text" value="${esc(m.frequency)}" placeholder="如：每批次实时记录"></td>
              <td><input type="text" value="${esc(m.personnel)}" placeholder="经过HACCP培训的品控专员"></td>
              <td><input type="text" value="${esc(m.remark)}" placeholder="依据 GB 14881-2013"></td>
              <td><button class="q15-del-row" data-mn-idx="${i}">&times;</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button class="btn btn-sm btn-secondary" id="addMonitorRow">+ 添加监控项</button>

      <hr class="q15-divider">

      <h3>纠偏措施</h3>
      <p class="q15-table-hint">根据偏差的实际情况，系统给出相应的验证措施建议。数据不满足关键限制的设定，即刻采取纠偏计划</p>
      <table class="q15-table">
        <thead>
          <tr>
            <th>关键控制点(CCP)</th>
            <th>关键限值(CL)</th>
            <th>纠偏措施</th>
            <th>验证</th>
            <th>记录</th>
            <th style="width:50px">操作</th>
          </tr>
        </thead>
        <tbody id="correctiveBody">
          ${data.correctiveActions.map((c, i) => `
            <tr data-ca-idx="${i}">
              <td><input type="text" value="${esc(c.ccp)}" placeholder="如：杀菌工序"></td>
              <td><input type="text" value="${esc(c.cl)}" placeholder="如：90℃"></td>
              <td><input type="text" value="${esc(c.corrective)}" placeholder="1.温度86~89℃→升温补足；2.＜85℃→整批隔离"></td>
              <td><input type="text" value="${esc(c.verification)}" placeholder="复测温度+抽样微生物"></td>
              <td><input type="text" value="${esc(c.record)}" placeholder="温度纠偏记录表"></td>
              <td><button class="q15-del-row" data-ca-idx="${i}">&times;</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button class="btn btn-sm btn-secondary" id="addCorrectiveRow">+ 添加纠偏项</button>
    `;
  }

  // ---- 七、记录 ----
  function renderRecords(data) {
    return `
      <div class="q15-field-group">
        <label>记录保存期限</label>
        <input type="text" data-q15-field="recordPeriod" value="${esc(data.recordPeriod)}" placeholder="如：2年">
      </div>
      <div class="q15-field-group">
        <label>记录格式要求</label>
        <textarea data-q15-field="recordFormat" rows="3" placeholder="描述记录格式要求，如：电子版、纸质版">${esc(data.recordFormat)}</textarea>
      </div>

      <div class="q15-records-summary">
        <h3>配套监控记录表格</h3>
        <p class="q15-table-hint">AI自动汇总监控数据，纠偏记录，生成标准化的报表，减轻人工记录的负担</p>
        <div class="q15-record-cards">
          <div class="q15-record-card">
            <div class="q15-record-icon">📋</div>
            <h4>监控记录表</h4>
            <p>记录各项关键控制点的监控数据</p>
          </div>
          <div class="q15-record-card">
            <div class="q15-record-icon">📊</div>
            <h4>纠偏记录表</h4>
            <p>记录偏差情况及采取的纠偏措施</p>
          </div>
          <div class="q15-record-card">
            <div class="q15-record-icon">📄</div>
            <h4>验证记录表</h4>
            <p>记录验证活动的执行情况</p>
          </div>
          <div class="q15-record-card">
            <div class="q15-record-icon">📑</div>
            <h4>综合报表</h4>
            <p>AI生成标准化HACCP综合报表</p>
          </div>
        </div>
        <div class="q15-export-actions">
          <button class="btn btn-secondary btn-sm" id="exportTableBtn" style="margin-top:10px;">📥 导出空白记录表格</button>
        </div>
      </div>
    `;
  }

  // ==================== 事件绑定 ====================
  function bindSectionEvents(content, data) {
    // ---- 企业信息：HACCP小组动态行 ----
    const addTeamBtn = content.querySelector('#addTeamRow');
    if (addTeamBtn) {
      addTeamBtn.addEventListener('click', () => {
        data.haccpTeam.push({ id: genId(), name: '', dept: '', position: '', role: '' });
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }
    content.querySelectorAll('#teamBody .q15-del-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.teamIdx);
        if (data.haccpTeam.length > 1) {
          data.haccpTeam.splice(idx, 1);
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        }
      });
    });
    // 实时保存小组数据
    content.querySelectorAll('#teamBody input').forEach(el => {
      el.addEventListener('input', () => {
        const row = el.closest('tr');
        const idx = parseInt(row.dataset.teamIdx);
        const inputs = row.querySelectorAll('input');
        if (data.haccpTeam[idx]) {
          data.haccpTeam[idx].name = inputs[0].value;
          data.haccpTeam[idx].dept = inputs[1].value;
          data.haccpTeam[idx].position = inputs[2].value;
          data.haccpTeam[idx].role = inputs[3].value;
          saveData(data);
        }
      });
    });

    // ---- 生产流程：配方动态行 ----
    const addFormulaBtn = content.querySelector('#addFormulaRow');
    if (addFormulaBtn) {
      addFormulaBtn.addEventListener('click', () => {
        data.formula.push({ id: genId(), material: '', dosage: '', func: '' });
        saveData(data);
        renderActiveSection();
      });
    }
    content.querySelectorAll('#formulaBody .q15-del-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.fmIdx);
        if (data.formula.length > 1) {
          data.formula.splice(idx, 1);
          saveData(data);
          renderActiveSection();
        }
      });
    });
    content.querySelectorAll('#formulaBody input').forEach(el => {
      el.addEventListener('input', () => {
        const row = el.closest('tr');
        const idx = parseInt(row.dataset.fmIdx);
        const inputs = row.querySelectorAll('input');
        if (data.formula[idx]) {
          data.formula[idx].material = inputs[0].value;
          data.formula[idx].dosage = inputs[1].value;
          data.formula[idx].func = inputs[2].value;
          saveData(data);
        }
      });
    });

    // ---- 生产流程：操作步骤 ----
    const addStepBtn = content.querySelector('#addProcessStep');
    if (addStepBtn) {
      addStepBtn.addEventListener('click', () => {
        data.processSteps.push({ id: genId(), stepName: '', operationMethod: '', parameters: '', controlPoint: '', equipmentName: '' });
        saveData(data);
        renderActiveSection();
      });
    }
    content.querySelectorAll('.q15-del-process').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.psIdx);
        if (data.processSteps.length > 1) {
          data.processSteps.splice(idx, 1);
          saveData(data);
          renderActiveSection();
        }
      });
    });
    content.querySelectorAll('.q15-process-card input').forEach(el => {
      el.addEventListener('input', () => {
        const card = el.closest('.q15-process-card');
        const idx = parseInt(card.dataset.psIdx);
        const inputs = card.querySelectorAll('input');
        if (data.processSteps[idx]) {
          data.processSteps[idx].stepName = inputs[0].value;
          data.processSteps[idx].operationMethod = inputs[1].value;
          data.processSteps[idx].parameters = inputs[2].value;
          data.processSteps[idx].controlPoint = inputs[3].value;
          data.processSteps[idx].equipmentName = inputs[4].value;
          saveData(data);
        }
      });
    });

    // ---- 生产流程：AI识别危害 ----
    const aiBtn = content.querySelector('#aiHazardBtn');
    if (aiBtn) {
      aiBtn.addEventListener('click', () => {
        aiBtn.disabled = true;
        const hint = content.querySelector('#aiHazardHint');
        if (hint) hint.textContent = 'AI分析中...';
        setTimeout(() => {
          // 模拟AI识别结果
          data.hazardBio = [
            { desc: '沙门氏菌', severity: '高', likelihood: '中', control: '充分加热处理' },
            { desc: '大肠杆菌', severity: '高', likelihood: '中', control: '严格卫生控制' },
            { desc: '金黄色葡萄球菌', severity: '中', likelihood: '低', control: '温度控制' },
          ];
          data.hazardChem = [
            { desc: '农药残留', severity: '高', likelihood: '低', control: '原料验收检测' },
            { desc: '重金属污染', severity: '高', likelihood: '低', control: '供应商审核' },
          ];
          data.hazardPhys = [
            { desc: '金属异物', severity: '中', likelihood: '中', control: '金属检测器' },
            { desc: '玻璃碎片', severity: '高', likelihood: '低', control: '玻璃管理制度' },
          ];
          saveData(data);
          if (hint) hint.textContent = '✓ AI识别完成，请确认以下危害分析内容';
          aiBtn.disabled = false;
          renderActiveSection();
        }, 1000);
      });
    }

    // ---- 危害分析：实时保存表格数据 ----
    ['Bio', 'Chem', 'Phys'].forEach(type => {
      const bodyId = `hazard${type}Body`;
      const body = content.querySelector(`#${bodyId}`);
      if (body) {
        body.querySelectorAll('input, select').forEach(el => {
          el.addEventListener('change', () => {
            collectHazardTableData(content, data);
            saveData(data);
          });
          el.addEventListener('input', () => {
            collectHazardTableData(content, data);
            saveData(data);
          });
        });
      }
    });

    // ---- 关键限制：AI建议 ----
    const aiCriticalBtn = content.querySelector('#aiCriticalBtn');
    if (aiCriticalBtn) {
      aiCriticalBtn.addEventListener('click', () => {
        aiCriticalBtn.disabled = true;
        const hint = content.querySelector('#aiCriticalHint');
        if (hint) hint.textContent = 'AI分析中...';
        const result = content.querySelector('#aiCriticalResult');
        setTimeout(() => {
          const standard = data.execStandard || '国标';
          const demoResult = `根据${standard === 'gb' ? 'GB 14881-2013 食品安全国家标准 食品生产通用卫生规范' : standard}，建议关键限制如下：

1. 杀菌工序 CCP-3：
   - 中心温度：≥85℃
   - 保持时间：≥15秒
   - 依据：GB 14881-2013 第5.2.1条

2. 金属检测 CCP-4：
   - Fe：≤1.5mm
   - SUS：≤2.0mm
   - 依据：GB/T 25346-2010

3. 原料验收 CCP-1：
   - 农药残留：符合GB 2763-2021
   - 重金属：符合GB 2762-2022`;
          if (result) result.innerHTML = `<div class="q15-ai-result">${demoResult.replace(/\n/g, '<br>')}</div>`;
          if (hint) hint.textContent = '✓ AI建议已生成';
          aiCriticalBtn.disabled = false;
        }, 800);
      });
    }

    // ---- 验证程序：监控动态行 ----
    const addMonitorBtn = content.querySelector('#addMonitorRow');
    if (addMonitorBtn) {
      addMonitorBtn.addEventListener('click', () => {
        data.monitoring.push({ id: genId(), ccp: '', object: '', method: '', frequency: '', personnel: '', remark: '' });
        saveData(data);
        renderActiveSection();
      });
    }
    content.querySelectorAll('#monitorBody .q15-del-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.mnIdx);
        if (data.monitoring.length > 1) {
          data.monitoring.splice(idx, 1);
          saveData(data);
          renderActiveSection();
        }
      });
    });
    content.querySelectorAll('#monitorBody input').forEach(el => {
      el.addEventListener('input', () => {
        const row = el.closest('tr');
        const idx = parseInt(row.dataset.mnIdx);
        const inputs = row.querySelectorAll('input');
        if (data.monitoring[idx]) {
          data.monitoring[idx].ccp = inputs[0].value;
          data.monitoring[idx].object = inputs[1].value;
          data.monitoring[idx].method = inputs[2].value;
          data.monitoring[idx].frequency = inputs[3].value;
          data.monitoring[idx].personnel = inputs[4].value;
          data.monitoring[idx].remark = inputs[5].value;
          saveData(data);
        }
      });
    });

    // ---- 验证程序：纠偏措施动态行 ----
    const addCorrectiveBtn = content.querySelector('#addCorrectiveRow');
    if (addCorrectiveBtn) {
      addCorrectiveBtn.addEventListener('click', () => {
        data.correctiveActions.push({ id: genId(), ccp: '', cl: '', corrective: '', verification: '', record: '' });
        saveData(data);
        renderActiveSection();
      });
    }
    content.querySelectorAll('#correctiveBody .q15-del-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.caIdx);
        if (data.correctiveActions.length > 1) {
          data.correctiveActions.splice(idx, 1);
          saveData(data);
          renderActiveSection();
        }
      });
    });
    content.querySelectorAll('#correctiveBody input').forEach(el => {
      el.addEventListener('input', () => {
        const row = el.closest('tr');
        const idx = parseInt(row.dataset.caIdx);
        const inputs = row.querySelectorAll('input');
        if (data.correctiveActions[idx]) {
          data.correctiveActions[idx].ccp = inputs[0].value;
          data.correctiveActions[idx].cl = inputs[1].value;
          data.correctiveActions[idx].corrective = inputs[2].value;
          data.correctiveActions[idx].verification = inputs[3].value;
          data.correctiveActions[idx].record = inputs[4].value;
          saveData(data);
        }
      });
    });

    // ---- 验证程序：AI规划监控 ----
    const aiMonitorBtn = content.querySelector('#aiMonitorBtn');
    if (aiMonitorBtn) {
      aiMonitorBtn.addEventListener('click', () => {
        aiMonitorBtn.disabled = true;
        const hint = content.querySelector('#aiMonitorHint');
        if (hint) hint.textContent = 'AI分析中...';
        setTimeout(() => {
          data.monitoring = [
            { id: genId(), ccp: 'CCP-3 杀菌工序', object: '杀菌温度、时间', method: '在线温度传感器连续监控', frequency: '每批次实时记录', personnel: '经HACCP培训的品控专员', remark: '依据GB 14881-2013，温度偏差需≤±1℃' },
            { id: genId(), ccp: 'CCP-4 金属检测', object: '金属异物', method: '在线金属检测仪自动检测', frequency: '连续监控', personnel: '设备维护人员+品控专员', remark: '依据GB/T 25346-2010' },
            { id: genId(), ccp: 'CCP-1 原料验收', object: '农药残留、重金属', method: '供应商检测报告+抽检验证', frequency: '每批次审核', personnel: '经培训的采购专员', remark: '依据GB 2763-2021、GB 2762-2022' },
          ];
          saveData(data);
          if (hint) hint.textContent = '✓ AI规划完成';
          aiMonitorBtn.disabled = false;
          renderActiveSection();
        }, 1000);
      });
    }

    // ---- 记录：导出表格 ----
    const exportBtn = content.querySelector('#exportTableBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        alert('导出功能：将生成空白记录表格供打印使用（此功能为占位，后续可实现为PDF/Excel导出）');
      });
    }
  }

  // 收集危害分析表格数据
  function collectHazardTableData(content, data) {
    const types = [
      { bodyId: 'hazardBioBody', key: 'hazardBio' },
      { bodyId: 'hazardChemBody', key: 'hazardChem' },
      { bodyId: 'hazardPhysBody', key: 'hazardPhys' },
    ];
    types.forEach(({ bodyId, key }) => {
      const body = content.querySelector(`#${bodyId}`);
      if (!body) return;
      const rows = body.querySelectorAll('tr:not(.q15-empty-row)');
      data[key] = [];
      rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const selects = row.querySelectorAll('select');
        if (inputs.length > 0) {
          data[key].push({
            desc: inputs[0]?.value || '',
            severity: selects[0]?.value || '中',
            likelihood: selects[1]?.value || '中',
            control: inputs[1]?.value || '',
          });
        }
      });
    });
  }

  // ==================== 提交问卷 ====================
  function submitQuestionnaire(data) {
    // 最终收集所有数据
    const finalData = loadData();
    // 保存完整数据
    localStorage.setItem('haccp_15min_submitted', JSON.stringify(finalData));
    localStorage.setItem('haccp_submitted', 'true');
    localStorage.setItem(SECTION_COMPLETED_KEY, 'true');

    alert('问卷提交成功！\n\n您的HACCP问卷信息已保存，可前往「查看结果」页面查看。');

    // 导航到结果页
    App.navigateTo('results');
  }

  // ==================== 公共方法 ====================
  return {
    init,
    loadData,
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SECTION_COMPLETED_KEY);
      currentStep = 0;
    }
  };
})();