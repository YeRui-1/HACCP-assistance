// 国际化：中文 / English
const I18n = (() => {
  const STORAGE_KEY = 'haccp_lang';

  const strings = {
    // ===== 导航 =====
    'nav.home':             ['首页', 'Home'],
    'nav.results':          ['查看结果', 'Results'],
    'nav.admin':            ['管理', 'Admin'],
    'nav.exitAdmin':        ['退出管理', 'Exit Admin'],
    'nav.back':             ['返回首页', 'Back to Lobby'],

    // ===== 密码弹窗 =====
    'pwd.title':            ['管理员验证', 'Admin Verification'],
    'pwd.desc':             ['请输入管理密码以进入问卷编辑', 'Enter admin password to edit questionnaire'],
    'pwd.placeholder':      ['请输入密码', 'Enter password'],
    'pwd.error':            ['密码错误，请重试', 'Incorrect password, try again'],
    'pwd.cancel':           ['取消', 'Cancel'],
    'pwd.confirm':          ['确认', 'Confirm'],

    // ===== 首页 =====
    'home.title':           ['HACCP AI 助手', 'HACCP AI Assistant'],
    'home.subtitle':        ['快速生成符合标准的 HACCP 计划，保障食品安全生产', 'Quickly generate standard-compliant HACCP plans for food safety'],
    'home.step1.title':     ['填写问卷', 'Fill Questionnaire'],
    'home.step1.desc':      ['回答关于产品和工艺的问题', 'Answer questions about product and process'],
    'home.step2.title':     ['AI 分析', 'AI Analysis'],
    'home.step2.desc':      ['智能识别危害与关键控制点', 'Intelligently identify hazards and CCPs'],
    'home.step3.title':     ['生成计划', 'Generate Plan'],
    'home.step3.desc':      ['获得完整的 HACCP 计划文档', 'Get the complete HACCP plan document'],
    'home.btnStart':        ['开始创建', 'Start Creating'],

    // ===== 大厅 =====
    'lobby.card1.title':    ['填写问卷', 'Fill Questionnaire'],
    'lobby.card1.desc':     ['回答产品与工艺相关问题，为生成 HACCP 计划提供信息', 'Answer questions about your product and process to provide information for HACCP plan generation'],
    'lobby.card2.title':    ['查看结果', 'View Results'],
    'lobby.card2.desc':     ['查看已生成的 HACCP 计划文档', 'View the generated HACCP plan document'],
    'lobby.card2.btn':      ['查看计划', 'View Plan'],
    'lobby.status.hasData': ['已有 HACCP 计划', 'HACCP plan available'],
    'lobby.status.noData':  ['暂无计划，请先完成问卷', 'No plan yet. Please complete the questionnaire first'],

    // ===== 问卷页 =====
    'q.empty.title':        ['暂无问卷', 'No Questionnaire'],
    'q.empty.desc':         ['管理员尚未创建问卷模板，请联系管理员在后台创建', 'The admin has not created a questionnaire yet. Please contact the admin.'],
    'q.questions':          ['个问题', ' questions'],
    'q.submit':             ['提交问卷', 'Submit Questionnaire'],
    'q.submitTest':         ['提交测试', 'Submit Test'],
    'q.testHint':           ['测试模式：提交结果不会影响用户数据', 'Test mode: submission will not affect user data'],
    'q.required':           ['请填写此项', 'This field is required'],
    'q.placeholder.text':   ['请输入', 'Please enter'],
    'q.placeholder.select': ['请选择', 'Please select'],

    // ===== 结果页 =====
    'r.empty.title':        ['暂无 HACCP 计划', 'No HACCP Plan'],
    'r.empty.desc':         ['请先完成问卷，AI 将根据您的信息生成标准的 HACCP 计划', 'Please complete the questionnaire first. AI will generate a standard HACCP plan based on your information.'],
    'r.empty.btn':          ['去填写问卷', 'Go to Questionnaire'],
    'r.sidebarTitle':       ['HACCP 计划', 'HACCP Plan'],

    // ===== 管理页 =====
    'admin.title':          ['管理后台', 'Admin Console'],
    'admin.subtitle':       ['选择要使用的管理功能', 'Select an admin function'],
    'admin.card1.title':    ['编辑问卷', 'Edit Questionnaire'],
    'admin.card1.desc':     ['创建和编辑问卷模板，添加章节与题目，支持测试模式预览', 'Create and edit questionnaire templates, add sections and questions, with test mode preview'],
    'admin.card2.title':    ['用户提交结果', 'User Submissions'],
    'admin.card2.desc':     ['查看用户填写并提交的问卷答案', 'View questionnaire answers submitted by users'],
    'admin.card2.empty':    ['暂无用户提交结果', 'No user submissions yet'],
    'admin.edit':           ['编辑', 'Edit'],
    'admin.test':           ['测试', 'Test'],
    'admin.sectionList':    ['问卷章节', 'Sections'],
    'admin.noSection':      ['暂无章节', 'No sections'],
    'admin.addSection':     ['+ 添加章节', '+ Add Section'],
    'admin.preview':        ['预览问卷', 'Preview'],
    'admin.noSectionHint':  ['请先添加一个章节，然后在此编辑题目', 'Please add a section first, then edit questions here'],
    'admin.questions':      ['个题目', ' questions'],
    'admin.addQuestion':    ['+ 添加题目', '+ Add Question'],
    'admin.qTitle':         ['请输入题目', 'Enter question title'],
    'admin.required':       ['必填', 'Required'],
    'admin.deleteQ':        ['删除题目', 'Delete Question'],
    'admin.options':        ['选项：', 'Options: '],
    'admin.optPlaceholder': ['添加选项后回车', 'Add option and press Enter'],
    'admin.delSection':     ['删除', 'Delete'],
    'admin.newSection':     ['新章节', 'New Section'],
    'admin.sectionPrompt':  ['请输入章节名称：', 'Enter section name:'],
    'admin.confirmDel':     ['确定删除该章节及其所有题目？', 'Delete this section and all its questions?'],
    'admin.testSuccess':    ['测试提交成功！\n\n这是管理员测试模式，提交结果仅保存在测试存储中，不会影响用户数据。\n\n可在浏览器 localStorage 中查看 "haccp_test_answers" 键。', 'Test submitted!\n\nAdmin test mode: results are saved in test storage only and will not affect user data.\n\nCheck "haccp_test_answers" in browser localStorage.'],
    'admin.noTestData':     ['还没有创建任何章节和题目，请先在编辑模式下创建问卷', 'No sections or questions yet. Please create the questionnaire in edit mode first.'],
    'admin.backLobby':      ['← 返回管理后台', '← Back to Admin Console'],
    'admin.backEdit':       ['← 返回编辑', '← Back to Editor'],
    'admin.noUserResult':   ['用户尚未提交任何问卷结果', 'No questionnaire results have been submitted by users yet.'],
    'admin.resultTitle':    ['用户提交结果', 'User Submission'],
    'admin.resultTime':     ['提交时间', 'Submission Time'],
    'admin.resultUnknown':  ['未知', 'Unknown'],
    'admin.templates':      ['模板管理', 'Template Manager'],
    'admin.templatesDesc':  ['管理所有问卷模板，创建、编辑、发布或删除模板', 'Manage all questionnaire templates: create, edit, publish or delete'],
    'admin.newTemplate':    ['新建模板', 'New Template'],
    'admin.refresh':        ['刷新', 'Refresh'],
    'admin.noTemplates':    ['暂无模板', 'No Templates'],
    'admin.noTemplatesDesc':['请点击「新建模板」创建第一个问卷模板', 'Click "New Template" to create your first questionnaire template'],
    'admin.genReport':      ['生成 AI 报告', 'Generate AI Report'],
    'admin.genLoading':     ['生成中...', 'Generating...'],
    'admin.genError':       ['生成失败，请检查后端是否启动', 'Generation failed. Please check if the backend is running'],
    'admin.reportTitle':    ['AI 分析报告', 'AI Analysis Report'],

    // ===== 生产流程图 =====
    'fc.title':             ['生产流程图', 'Process Flow Chart'],
    'fc.desc':              ['请按顺序填写每个生产步骤', 'Please fill in each production step in order'],
    'fc.stepName':          ['步骤名称', 'Step Name'],
    'fc.stepNamePh':        ['如：原料验收', 'e.g. Receiving'],
    'fc.stepDesc':          ['步骤描述', 'Description'],
    'fc.stepDescPh':        ['描述此步骤的操作内容', 'Describe what happens in this step'],
    'fc.paramName':         ['参数名称', 'Param Name'],
    'fc.paramNamePh':       ['如：温度', 'e.g. Temperature'],
    'fc.paramValue':        ['参数值', 'Value'],
    'fc.paramValuePh':      ['如：121', 'e.g. 121'],
    'fc.paramUnit':         ['单位', 'Unit'],
    'fc.paramUnitPh':       ['如：°C', 'e.g. °C'],
    'fc.addParam':          ['+ 添加参数', '+ Add Parameter'],
    'fc.addStep':           ['+ 添加步骤', '+ Add Step'],
    'fc.delStep':           ['删除', 'Delete'],
    'fc.moveUp':            ['上移', 'Move Up'],
    'fc.moveDown':          ['下移', 'Move Down'],
    'fc.enableFlowchart':   ['启用生产流程图', 'Enable Process Flow Chart'],
    'fc.defaultSteps':      ['默认步骤模板', 'Default Step Templates'],
    'fc.defaultStepsHint':  ['每行一个步骤名称，用户填写时将预填这些步骤', 'One step name per line. These will be pre-filled for users.'],
    'fc.noSteps':           ['请至少添加一个生产步骤', 'Please add at least one production step'],
    'fc.stepNameRequired':  ['步骤名称不能为空', 'Step name is required'],
    'fc.paramHeader':       ['工艺参数', 'Parameters'],
    'fc.resultTitle':       ['生产流程图', 'Process Flow Chart'],
    'fc.resultOverview':    ['以下为产品生产流程及各步骤的工艺参数：', 'Below is the production process flow and parameters for each step:'],
    'fc.resultNoData':      ['未填写生产流程', 'No process flow data'],

    // ===== 题型标签 =====
    'type.text':            ['文本输入', 'Text Input'],
    'type.textarea':        ['多行文本', 'Textarea'],
    'type.number':          ['数字', 'Number'],
    'type.date':            ['日期', 'Date'],
    'type.select':          ['下拉选择', 'Dropdown'],
    'type.radio':           ['单选', 'Radio'],
    'type.checkbox':        ['多选', 'Checkbox'],

    // ===== 用户认证 =====
    'auth.login':             ['登录', 'Login'],
    'auth.register':          ['注册', 'Register'],
    'auth.logout':            ['退出', 'Logout'],
    'auth.username':          ['用户名', 'Username'],
    'auth.password':          ['密码', 'Password'],
    'auth.confirmPassword':   ['确认密码', 'Confirm Password'],
    'auth.companyName':       ['企业名称', 'Company Name'],
    'auth.loginTitle':        ['用户登录', 'User Login'],
    'auth.registerTitle':     ['用户注册', 'User Registration'],
    'auth.loginDesc':         ['登录以使用全部功能', 'Login to access all features'],
    'auth.registerDesc':      ['注册账号以使用 HACCP AI 助手', 'Register to use HACCP AI Assistant'],
    'auth.noAccount':         ['没有账号？去注册', 'No account? Register'],
    'auth.hasAccount':        ['已有账号？去登录', 'Already have an account? Login'],
    'auth.registerSuccess':   ['注册成功', 'Registration successful'],
    'auth.loginSuccess':      ['登录成功', 'Login successful'],
    'auth.passwordMismatch':  ['两次密码输入不一致', 'Passwords do not match'],
    'auth.usernameError':     ['用户名长度应在 2-50 之间', 'Username must be 2-50 characters'],
    'auth.passwordError':     ['密码长度至少 6 位', 'Password must be at least 6 characters'],
    'auth.companyNameError':  ['企业名称不能为空', 'Company name cannot be empty'],
    'auth.cancel':            ['取消', 'Cancel'],
    'auth.loading':           ['处理中...', 'Loading...'],
  };

  let currentLang = 'zh';

  function loadLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') currentLang = saved;
    } catch (e) { /* ignore */ }
  }

  function t(key) {
    const entry = strings[key];
    if (!entry) return key;
    return currentLang === 'en' ? entry[1] : entry[0];
  }

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function getLang() {
    return currentLang;
  }

  loadLang();

  return { t, setLang, getLang };
})();
