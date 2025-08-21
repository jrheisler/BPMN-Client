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
      padding: '0.5rem',
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

    function hide(){
      panel.style.display = 'none';
    }

    observeDOMRemoval(panel, unsubscribe);

    return { el: panel, show, hide };
  }

  global.tokenListPanel = { createTokenListPanel };
})(window);
