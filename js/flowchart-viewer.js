/**
 * 流程图查看器模块 - 使用 draw.io 嵌入式编辑器
 * 通过 embed.diagrams.net postMessage API 与 draw.io 双向通信
 * 保存后自动同步 XML 和 SVG 到 localStorage，供结果报告页使用
 */
const FlowchartViewer = (() => {

  var DRAWIO_EMBED_URL = 'https://embed.diagrams.net/?embed=1&spin=1&proto=json&ui=min&noExitBtn=1&saveAndExit=0&stealth=1&zoom=0.9&lang=zh';
  var drawioFrame = null;
  var messageHandler = null;
  var initialized = false;

  function getInitialXml() {
    try {
      var saved = localStorage.getItem('haccp_drawio_xml');
      if (saved) return saved;
    } catch(e) {}
    if (window.INULIN_DRAWIO_XML) return window.INULIN_DRAWIO_XML;
    return '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
  }

  function sendToDrawio(msg) {
    if (drawioFrame && drawioFrame.contentWindow) {
      drawioFrame.contentWindow.postMessage(JSON.stringify(msg), '*');
    }
  }

  function init() {
    var container = document.getElementById('flowchartContainer');
    if (!container) return;

    // 清理旧的消息监听
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
      messageHandler = null;
    }
    initialized = false;

    container.innerHTML = '';

    // ===== 工具栏 =====
    var toolbar = document.createElement('div');
    toolbar.className = 'fc-toolbar';
    toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0 12px;flex-wrap:wrap;';
    toolbar.innerHTML = '<span style="font-size:13px;color:#374151;flex:1;">在下方 draw.io 编辑器中编辑流程图，按 <strong>Ctrl+S</strong> 保存，将自动同步到 AI 报告。</span>'
      + '<button id="fcSaveBtn" class="btn btn-sm btn-primary" style="min-width:80px;">💾 保存</button>'
      + '<button id="fcResetBtn" class="btn btn-sm btn-secondary">↩️ 恢复默认</button>';
    container.appendChild(toolbar);

    // ===== draw.io iframe =====
    var iframeWrap = document.createElement('div');
    iframeWrap.style.cssText = 'position:relative;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#f9fafb;';

    var loadingDiv = document.createElement('div');
    loadingDiv.id = 'fcDrawioLoading';
    loadingDiv.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f9fafb;z-index:10;gap:12px;';
    loadingDiv.innerHTML = '<div class="fc-spinner" style="width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite;"></div>'
      + '<p style="color:#6b7280;font-size:13px;margin:0;">正在加载 draw.io 编辑器...</p>';
    iframeWrap.appendChild(loadingDiv);

    var iframe = document.createElement('iframe');
    iframe.id = 'drawioFrame';
    iframe.src = DRAWIO_EMBED_URL;
    iframe.style.cssText = 'width:100%;height:680px;border:none;display:block;';
    iframe.allow = 'clipboard-read; clipboard-write';
    iframeWrap.appendChild(iframe);
    container.appendChild(iframeWrap);
    drawioFrame = iframe;

    // ===== 状态栏 =====
    var statusBar = document.createElement('div');
    statusBar.id = 'fcStatus';
    statusBar.style.cssText = 'margin-top:8px;font-size:12px;color:#6b7280;min-height:20px;';
    statusBar.textContent = '';
    container.appendChild(statusBar);

    // ===== CSS 动画（如果还没有）=====
    if (!document.getElementById('fcSpinStyle')) {
      var style = document.createElement('style');
      style.id = 'fcSpinStyle';
      style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    // ===== 消息监听 =====
    messageHandler = function(e) {
      if (!e.data || typeof e.data !== 'string') return;
      var msg;
      try { msg = JSON.parse(e.data); } catch(err) { return; }
      if (!msg || !msg.event) return;

      if (msg.event === 'init') {
        // draw.io 就绪，载入 XML
        setTimeout(function() {
          sendToDrawio({ action: 'load', xml: getInitialXml() });
          var loading = document.getElementById('fcDrawioLoading');
          if (loading) loading.style.display = 'none';
          initialized = true;
          setStatus('✅ draw.io 已就绪，编辑后按 Ctrl+S 或点击「保存」');
        }, 300);
      }

      if (msg.event === 'save' || msg.event === 'autosave') {
        // 用户保存（Ctrl+S）
        saveXml(msg.xml);
        // 请求 SVG 导出
        sendToDrawio({ action: 'export', format: 'svg', xml: msg.xml });
      }

      if (msg.event === 'export' && msg.format === 'svg' && msg.data) {
        saveSvg(msg.data);
      }
    };

    window.addEventListener('message', messageHandler);

    // ===== 按钮绑定 =====
    document.getElementById('fcSaveBtn').addEventListener('click', function() {
      // 向 draw.io 发送"强制保存"请求
      sendToDrawio({ action: 'export', format: 'xmlsvg', xml: getInitialXml() });
      // 也触发正常保存
      sendToDrawio({ action: 'load', xml: getInitialXml() });
      setStatus('⏳ 正在保存...');
      // 备用：如果 draw.io 没有响应，通过 xmlsvg 格式触发保存
      setTimeout(function() {
        sendToDrawio({ action: 'export', format: 'svg' });
      }, 200);
    });

    document.getElementById('fcResetBtn').addEventListener('click', function() {
      if (!confirm('确认恢复默认流程图？将丢失您的自定义修改。')) return;
      try {
        localStorage.removeItem('haccp_drawio_xml');
        localStorage.removeItem('haccp_drawio_svg');
      } catch(e2) {}
      sendToDrawio({ action: 'load', xml: window.INULIN_DRAWIO_XML || getInitialXml() });
      setStatus('✅ 已恢复默认流程图');
    });
  }

  function saveXml(xml) {
    if (!xml) return;
    try { localStorage.setItem('haccp_drawio_xml', xml); } catch(e) {}
    setStatus('✅ 已保存 · ' + new Date().toLocaleTimeString());
  }

  function saveSvg(svgData) {
    if (!svgData) return;
    try { localStorage.setItem('haccp_drawio_svg', svgData); } catch(e) {}
  }

  function setStatus(msg) {
    var bar = document.getElementById('fcStatus');
    if (bar) bar.textContent = msg;
  }

  function destroy() {
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
      messageHandler = null;
    }
    initialized = false;
    drawioFrame = null;
    var container = document.getElementById('flowchartContainer');
    if (container) container.innerHTML = '';
  }

  return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') {
  window.FlowchartViewer = FlowchartViewer;
}
