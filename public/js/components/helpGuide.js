(function(global){

  function hexToRgb(hex){
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    return m ? {
      r: parseInt(m[1],16),
      g: parseInt(m[2],16),
      b: parseInt(m[3],16)
    } : { r:0, g:0, b:0 };
  }

  function withOpacity(hex, alpha){
    const {r,g,b} = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function lighten(hex, amount){
    const {r,g,b} = hexToRgb(hex);
    return `rgb(${Math.round(r + (255 - r) * amount)}, ${Math.round(g + (255 - g) * amount)}, ${Math.round(b + (255 - b) * amount)})`;
  }

  async function openHelpGuideModal(themeStream = currentTheme){
    const overlay = document.createElement('div');
    overlay.className = 'help-guide-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--muted)',
      zIndex: 2000
    });

    const panel = document.createElement('div');
    panel.className = 'help-guide-panel';
    Object.assign(panel.style, {
      position: 'relative',
      maxWidth: '600px',
      maxHeight: '80vh',
      overflowY: 'auto',
      background: 'var(--panel)',
      color: 'var(--text)',
      padding: '1rem',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      boxShadow: '0 4px 16px var(--panel2)'
    });
    overlay.appendChild(panel);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '0.5rem',
      right: '0.5rem',
      background: 'transparent',
      color: 'var(--text)',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer'
    });
    closeBtn.onmouseover = () => closeBtn.style.color = 'var(--accent-2)';
    closeBtn.onmouseout  = () => closeBtn.style.color = 'var(--text)';
    panel.appendChild(closeBtn);

    const content = document.createElement('div');
    panel.appendChild(content);

    try {
      const response = await fetch('/bpmn_help_guide_embeddable_html.html');
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      content.innerHTML = DOMPurify.sanitize(parsed.body.innerHTML);
    } catch (err) {
      console.error('Failed to load help guide:', err);
      content.textContent = 'Error loading help guide.';
    }

    function applyTheme(theme){
      const colors = theme.colors || {};
      overlay.style.setProperty('--bg', colors.background || '#ffffff');
      overlay.style.setProperty('--panel', colors.surface || '#ffffff');
      overlay.style.setProperty('--panel2', lighten(colors.surface || '#ffffff', 0.1));
      overlay.style.setProperty('--text', colors.foreground || '#000000');
      overlay.style.setProperty('--muted', withOpacity(colors.foreground || '#000000', 0.6));
      overlay.style.setProperty('--accent', colors.accent || '#6200ee');
      overlay.style.setProperty('--accent-2', lighten(colors.accent || '#6200ee', 0.2));
      overlay.style.setProperty('--border', colors.border || '#cccccc');
    }

    const unsubscribe = themeStream.subscribe(applyTheme);
    applyTheme(themeStream.get());

    function close(){
      unsubscribe && unsubscribe();
      overlay.remove();
    }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    document.body.appendChild(overlay);
    return overlay;
  }

  global.openHelpGuideModal = openHelpGuideModal;
})(this);
