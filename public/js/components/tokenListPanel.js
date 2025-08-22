(function(global){
  function createTokenListPanel(logStream, themeStream = currentTheme){
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '1rem',
      right: '1rem',
      width: '250px',
      maxHeight: '200px',
      overflowY: 'auto',
      padding: '1.5rem 0.5rem 0.5rem 0.5rem',
      borderRadius: '4px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      display: 'none',
      zIndex: '1000',
      fontSize: '14px'
    });

    const list = document.createElement('ul');
    Object.assign(list.style, {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem'
    });
    panel.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '0.25rem',
      right: '0.25rem',
      background: 'transparent',
      border: 'none',
      color: 'inherit',
      cursor: 'pointer',
      fontSize: '1rem',
      lineHeight: '1'
    });
    panel.appendChild(closeBtn);

    function render(entries){
      list.innerHTML = '';
      entries.forEach(entry => {
        const li = document.createElement('li');
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const namePart = entry.elementName ? ` - ${entry.elementName}` : '';
        li.textContent = `${time}: ${entry.elementId}${namePart}`;
        list.appendChild(li);
      });
      panel.style.display = entries.length ? 'block' : 'none';
      if(entries.length){
        panel.scrollTop = panel.scrollHeight;
      }
    }

    const unsubscribe = logStream.subscribe(render);

    const treeBtn = document.querySelector('.diagram-tree-toggle');
    if(treeBtn){
      const styles = window.getComputedStyle(treeBtn);
      const gap = 8; // px

      // position the panel above the tree button
      const bottom = parseFloat(styles.bottom) || 0;
      const bottomOffset = bottom + treeBtn.offsetHeight + gap;
      panel.style.bottom = `${bottomOffset}px`;
      panel.style.right = styles.right;

      // ensure the panel appears above the tree button
      const zIndex = parseInt(styles.zIndex || '0', 10);
      panel.style.zIndex = String(zIndex + 1);
    }

    themeStream.subscribe(theme => {
      panel.style.background = theme.colors.surface;
      panel.style.color = theme.colors.foreground;
      panel.style.border = `1px solid ${theme.colors.border}`;
      panel.style.fontFamily = theme.fonts.base || 'sans-serif';
    });

    function show(){
      if(list.children.length){
        panel.style.display = 'block';
      }
    }

    let clearing = false;

    function hide(){
      panel.style.display = 'none';
      if(!clearing && logStream.get().length){
        clearing = true;
        logStream.set([]);
        clearing = false;
      }
    }

    closeBtn.addEventListener('click', hide);

    observeDOMRemoval(panel, unsubscribe);

    return { el: panel, show, hide };
  }

  global.tokenListPanel = { createTokenListPanel };
})(window);
