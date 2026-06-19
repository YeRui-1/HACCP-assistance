/**
 * 流程图解析器 - 从 draw.io 格式的 XML 中提取操作步骤信息
 * 
 * 支持两种 XML 格式：
 *   1. drawio-data.js 中的 INULIN_DRAWIO_XML（两列15步布局）
 *   2. process-flowchart-template.xml（单列22步布局）
 * 
 * 用法：
 *   var steps = FlowchartParser.parse(xmlString);
 *   // steps 为按顺序排列的步骤对象数组
 */
var FlowchartParser = (function() {

  // ===== 控制点类型颜色映射 =====
  var CONTROL_POINT_COLORS = {
    // CCP 关键控制点
    '#fff3e0': 'CCP',
    '#ff9800': 'CCP',
    // OPRP 操作性前提方案
    '#e3f2fd': 'OPRP',
    '#1976d2': 'OPRP',
    // CQP 关键质量点
    '#e8f5e9': 'CQP',
    '#43a047': 'CQP',
    // 核心节点（蓝色，模板中的高亮节点）
    '#1e88e5': '核心',
    '#0d47a1': '核心',
  };

  // 默认普通节点颜色
  var DEFAULT_FILL_COLORS = ['#ffffff', '#f5f5f5', '#f8f9fa'];

  // ===== 主入口 =====
  function parse(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') {
      return [];
    }

    var doc = parseXml(xmlString);
    if (!doc) return [];

    var allCells = extractCells(doc);
    if (allCells.length === 0) return [];

    // 分离主步骤节点、注释节点和连线
    var mainSteps = [];
    var annotations = [];
    var edges = [];

    allCells.forEach(function(cell) {
      var isVertex = cell.getAttribute('vertex') === '1' || !cell.getAttribute('edge');
      var isEdge = cell.getAttribute('edge') === '1';
      var parentId = cell.getAttribute('parent');
      var style = cell.getAttribute('style') || '';
      var fillColor = extractFillColor(style);

      // 主步骤：vertex 类型，有 value 内容（步骤名称），有坐标
      if (isVertex && !isEdge) {
        var value = cell.getAttribute('value') || '';
        var geo = cell.querySelector('mxGeometry');
        if (!geo) return;

        var x = parseFloat(geo.getAttribute('x')) || 0;
        var y = parseFloat(geo.getAttribute('y')) || 0;
        var w = parseFloat(geo.getAttribute('width')) || 100;
        var h = parseFloat(geo.getAttribute('height')) || 40;

        // 跳过根节点和无内容节点
        if (!value.trim()) return;
        // 跳过连线标签（带 value 的 edge）
        if (isEdge) return;

        // 判断是主步骤还是注释
        if (isAnnotationNode(style, fillColor, value)) {
          annotations.push({
            id: cell.getAttribute('id') || '',
            value: value,
            x: x, y: y, w: w, h: h,
            fillColor: fillColor,
            style: style
          });
        } else {
          var stepInfo = parseStepFromCell(cell, value, style, fillColor, x, y, w, h);
          if (stepInfo) {
            mainSteps.push(stepInfo);
          }
        }
      }
    });

    // 按 y 坐标排序（从上到下）
    mainSteps.sort(function(a, b) { return a.y - b.y; });

    // 重新编号 stepOrder
    mainSteps.forEach(function(step, index) {
      step.stepOrder = index + 1;
    });

    // 为每个主步骤关联侧边注释
    associateAnnotations(mainSteps, annotations);

    return mainSteps;
  }

  // ===== XML 解析 =====
  function parseXml(str) {
    try {
      // 兼容 drawio-data.js 的 JS 字符串拼接格式（可能是 JS 表达式而非纯 XML）
      // 提取实际 XML 部分：从 <mxfile 到 </mxfile>
      var xmlMatch = str.match(/<mxfile[\s\S]*?<\/mxfile>/);
      if (xmlMatch) {
        str = xmlMatch[0];
      }

      var parser = new DOMParser();
      // 处理可能的 HTML 实体
      str = str.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g, '&');
      return parser.parseFromString(str, 'text/xml');
    } catch(e) {
      console.warn('FlowchartParser: XML 解析失败', e);
      return null;
    }
  }

  // ===== 提取所有 mxCell 节点 =====
  function extractCells(doc) {
    var cells = doc.querySelectorAll('mxCell');
    if (cells.length === 0) {
      // 尝试其他查找方式
      var root = doc.querySelector('root');
      if (root) {
        cells = root.querySelectorAll('mxCell');
      }
    }
    return Array.prototype.slice.call(cells);
  }

  // ===== 从 style 中提取 fillColor =====
  function extractFillColor(style) {
    if (!style) return '';
    // 支持格式: fillColor=#fff3e0 或 fillColor=#e8f5e9;
    var match = style.match(/fillColor=([^;]+)/);
    return match ? match[1].trim() : '';
  }

  // ===== 判断是否为注释节点（紫色侧边注释） =====
  function isAnnotationNode(style, fillColor, value) {
    // 紫色背景是侧边注释的典型特征
    if (fillColor === '#f3e5f5') return true;
    // 判断 style 中是否包含 text;html=1 且颜色为紫色
    if (style.indexOf('text;html=1') !== -1 && style.indexOf('#8e24aa') !== -1) return true;
    // 值以"入料"或"出料"开头的是箭头标签，不是步骤也不是注释
    if (value === '入料' || value === '出料') return false;
    return false;
  }

  // ===== 从 mxCell 节点解析步骤信息 =====
  function parseStepFromCell(cell, value, style, fillColor, x, y, w, h) {
    // 清洗 value 中的换行符
    var cleanValue = value.replace(/&#xa;/g, '\n').replace(/<[^>]+>/g, '').trim();
    // 取第一行作为步骤名称（多行时通常第一行是名称）
    var lines = cleanValue.split('\n');
    var stepName = lines[0].trim();

    if (!stepName) return null;

    // 判断控制点类型
    var controlPoint = determineControlPoint(stepName, style, fillColor);

    // 从步骤名称中提取控制点标记（如 "菊芋验收 (CQP-1)" → CQP）
    var cpMatch = stepName.match(/\(([A-Z]+-\d+)\)/);
    if (cpMatch) {
      controlPoint = cpMatch[1];
    }

    // 从 value 中的换行提取附加信息（如模板中的多行步骤可能有设备描述）
    var extraInfo = '';
    if (lines.length > 1) {
      extraInfo = lines.slice(1).join(' ').trim();
    }

    return {
      id: cell.getAttribute('id') || '',
      stepName: stepName,
      controlPoint: controlPoint,
      equipment: '',
      parameters: '',
      inputs: [],
      outputs: [],
      extraInfo: extraInfo,
      isCore: fillColor === '#1e88e5',
      x: x, y: y, w: w, h: h
    };
  }

  // ===== 判断控制点类型 =====
  function determineControlPoint(stepName, style, fillColor) {
    // 1. 从颜色判断
    var cp = CONTROL_POINT_COLORS[fillColor];
    if (cp) return cp;

    // 2. 从样式中的 strokeColor 判断
    var strokeMatch = style.match(/strokeColor=([^;]+)/);
    if (strokeMatch) {
      var strokeColor = strokeMatch[1].trim();
      cp = CONTROL_POINT_COLORS[strokeColor];
      if (cp) return cp;
    }

    // 3. 从步骤名称中的标记判断
    if (stepName.indexOf('CCP') !== -1) return 'CCP';
    if (stepName.indexOf('OPRP') !== -1) return 'OPRP';
    if (stepName.indexOf('CQP') !== -1) return 'CQP';

    // 4. 检查是否是普通白色/灰色背景
    for (var i = 0; i < DEFAULT_FILL_COLORS.length; i++) {
      if (fillColor === DEFAULT_FILL_COLORS[i]) return '普通';
    }

    // 5. 特殊：蓝色核心节点
    if (fillColor === '#1e88e5') return '核心';

    return '普通';
  }

  // ===== 将侧边注释关联到主步骤 =====
  function associateAnnotations(mainSteps, annotations) {
    if (mainSteps.length === 0 || annotations.length === 0) return;

    annotations.forEach(function(ann) {
      // 找到离该注释最近的主步骤
      var nearest = findNearestStep(mainSteps, ann);

      if (!nearest) return;

      var annValue = ann.value.replace(/&#xa;/g, '\n').replace(/<[^>]+>/g, '').trim();

      // 判断注释类型：根据注释相对于步骤的位置
      // 左侧 = 输入/设备，右侧 = 输出/废物
      var annCenterX = ann.x + ann.w / 2;
      var stepCenterX = nearest.x + nearest.w / 2;

      if (annCenterX < stepCenterX) {
        // 左侧注释 → 设备和输入
        if (isEquipmentOrParam(annValue)) {
          nearest.equipment = mergeInfo(nearest.equipment, annValue);
        } else {
          nearest.inputs.push(annValue);
        }
      } else {
        // 右侧注释 → 输出/废物
        nearest.outputs.push(annValue);
      }

      // 尝试从注释文本中提取参数信息（温度、时间、频率等）
      var params = extractParameters(annValue);
      if (params) {
        nearest.parameters = mergeInfo(nearest.parameters, params);
      }
    });
  }

  // ===== 找到离注释最近的步骤 =====
  function findNearestStep(steps, annotation) {
    var annCenterX = annotation.x + annotation.w / 2;
    var annCenterY = annotation.y + annotation.h / 2;
    var minDist = Infinity;
    var nearest = null;

    steps.forEach(function(step) {
      var stepCenterX = step.x + step.w / 2;
      var stepCenterY = step.y + step.h / 2;
      var dx = annCenterX - stepCenterX;
      var dy = annCenterY - stepCenterY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      // 只考虑垂直方向距离相近（同一行）或水平方向距离相近（同一列）的步骤
      var verticalAligned = Math.abs(annCenterY - stepCenterY) < step.h * 2;
      var horizontalAligned = Math.abs(annCenterX - stepCenterX) < step.w * 2;

      if ((verticalAligned || horizontalAligned) && dist < minDist) {
        minDist = dist;
        nearest = step;
      }
    });

    return nearest;
  }

  // ===== 判断注释文本是否描述设备或工艺 =====
  function isEquipmentOrParam(text) {
    if (!text) return false;
    var equipmentKeywords = ['机', '器', '仪', '设备', '釜', '槽', '塔', '罐', '箱', '炉', '泵'];
    for (var i = 0; i < equipmentKeywords.length; i++) {
      if (text.indexOf(equipmentKeywords[i]) !== -1) return true;
    }
    // 包含单位或工艺参数特征
    if (text.match(/\d+[~-]?\d*\s*(℃|°C|°|min|h|秒|分钟|小时|W|Hz|MPa|bar|r\/min)/)) return true;
    return false;
  }

  // ===== 从文本中提取工艺参数 =====
  function extractParameters(text) {
    if (!text) return null;
    var paramParts = [];

    // 温度
    var tempMatch = text.match(/(\d+[~-]?\d*)\s*(?:℃|°C|°|摄氏度)/);
    if (tempMatch) paramParts.push('温度' + tempMatch[0]);

    // 时间
    var timeMatch = text.match(/(\d+[~-]?\d*)\s*(?:分钟|min|小时|h|秒|s)/);
    if (timeMatch) paramParts.push('时间' + timeMatch[0]);

    // 功率
    var powerMatch = text.match(/(\d+[~-]?\d*)\s*W/);
    if (powerMatch) paramParts.push('功率' + powerMatch[0]);

    // 频率
    var freqMatch = text.match(/(\d+[~-]?\d*)\s*k?Hz/);
    if (freqMatch) paramParts.push('频率' + freqMatch[0]);

    // 转速
    var speedMatch = text.match(/(\d+[~-]?\d*)\s*r\/(?:min|分钟)/);
    if (speedMatch) paramParts.push('转速' + speedMatch[0]);

    // 压力
    var pressureMatch = text.match(/(\d+[~-]?\d*)\s*(?:MPa|Pa|bar)/);
    if (pressureMatch) paramParts.push('压力' + pressureMatch[0]);

    return paramParts.length > 0 ? paramParts.join('，') : null;
  }

  // ===== 合并信息（避免重复） =====
  function mergeInfo(existing, newInfo) {
    if (!existing) return newInfo;
    if (!newInfo) return existing;
    if (existing.indexOf(newInfo) !== -1) return existing;
    return existing + '，' + newInfo;
  }

  // ===== 工具函数：从 XML 字符串中提取步骤名称列表（简洁版） =====
  function listStepNames(xmlString) {
    var steps = parse(xmlString);
    return steps.map(function(s) { return s.stepName; });
  }

  // ===== 工具函数：从 XML 字符串中提取步骤数据（适配 questionnaire-15min.js 的 processSteps 格式） =====
  function toProcessSteps(xmlString) {
    var steps = parse(xmlString);
    return steps.map(function(s) {
      return {
        stepName: s.stepName,
        operationMethod: s.extraInfo || '',
        parameters: s.parameters || '',
        controlPoint: s.controlPoint || '',
        equipmentName: s.equipment || ''
      };
    });
  }

  // ===== 公开 API =====
  return {
    parse: parse,
    listStepNames: listStepNames,
    toProcessSteps: toProcessSteps
  };

})();

// 挂载到 window
if (typeof window !== 'undefined') {
  window.FlowchartParser = FlowchartParser;
}