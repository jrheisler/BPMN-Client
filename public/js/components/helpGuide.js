(function(global){
  // Simple help guide data; in practice this could be imported from HTML.
  const HELP = [
    {
      title: 'Getting Started',
      html: `
        <p>Use the toolbar buttons to manipulate the diagram. Zoom with the ➕ and ➖ controls and use the tree view to navigate elements.</p>
      `
    },
    {
      title: 'Editing',
      html: `
        <p>Double‑click an element to edit its properties. Drag elements to reposition them. Use the palette to create new nodes.</p>
      `
    },
    {
      title: 'Simulation',
      html: `
        <p>Start the token simulation with the ▶ control. Pause with ⏸ or step through tokens using ⏭.</p>
      `
    }
  ];

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

  function openHelpGuideModal(themeStream = currentTheme){
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

    HELP.forEach(section => {
      const h2 = document.createElement('h2');
      h2.textContent = section.title;
      h2.style.color = 'var(--accent)';
      h2.style.marginTop = '1rem';
      content.appendChild(h2);

      const div = document.createElement('div');
      div.innerHTML = DOMPurify.sanitize(section.html);
      div.style.marginBottom = '0.5rem';
      content.appendChild(div);
    });

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
