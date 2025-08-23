(function(global){
  function createTokenListPanel(logStream, themeStream = currentTheme){
    const panel = document.createElement('div');
    panel.classList.add('token-list-panel');
    panel.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.classList.add('token-list-header');
    panel.appendChild(header);

    const title = document.createElement('span');
    title.textContent = 'Token Log';
    header.appendChild(title);

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '\u2193';
    downloadBtn.classList.add('token-list-download');
    header.appendChild(downloadBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.classList.add('token-list-clear');
    header.appendChild(clearBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    closeBtn.classList.add('token-list-close');
    header.appendChild(closeBtn);

    const list = document.createElement('ul');
    list.classList.add('token-list-entry');
    panel.appendChild(list);

    let prevLength = 0;

    function getTypeClass(id){
      if(!id) return null;
      if(/StartEvent/i.test(id)) return 'token-entry-start';
      if(/EndEvent/i.test(id)) return 'token-entry-end';
      if(/Task/i.test(id)) return 'token-entry-task';
      if(/Gateway/i.test(id)) return 'token-entry-gateway';
      return null;
    }

    function render(entries){
      list.innerHTML = '';
      entries.forEach((entry, index) => {
        const li = document.createElement('li');
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const namePart = entry.elementName ? ` - ${entry.elementName}` : '';
        const idPart = entry.tokenId != null ? `[${entry.tokenId}] ` : '';
        li.textContent = `${time} ${idPart}${entry.elementId}${namePart}`;

        li.classList.add('token-entry');
        li.classList.add(index % 2 === 0 ? 'token-entry-even' : 'token-entry-odd');
        const typeClass = getTypeClass(entry.elementId);
        if(typeClass) li.classList.add(typeClass);
        if(index >= prevLength){
          li.classList.add('token-entry-new');
          li.addEventListener('animationend', () => li.classList.remove('token-entry-new'), { once: true });
        }

        list.appendChild(li);
      });
      prevLength = entries.length;
      if(entries.length){
        show();
        panel.scrollTop = panel.scrollHeight;
      }
    }

    const unsubscribe = logStream.subscribe(render);

    const cleanupFns = [unsubscribe];

    const treeBtn = document.querySelector('.diagram-tree-toggle');
    if(treeBtn){
      const styles = window.getComputedStyle(treeBtn);
      const gap = 8; // px

      function positionPanel(){
        const rect = treeBtn.getBoundingClientRect();
        panel.style.bottom = `${window.innerHeight - rect.top + gap}px`;
        panel.style.right = `${window.innerWidth - rect.right}px`;
      }

      positionPanel();

      const zIndex = parseInt(styles.zIndex, 10);
      panel.style.zIndex = String((Number.isNaN(zIndex) ? 0 : zIndex) + 1);

      window.addEventListener('resize', positionPanel);
      cleanupFns.push(() => window.removeEventListener('resize', positionPanel));
    }

    themeStream.subscribe(theme => {
      panel.style.background = theme.colors.surface;
      panel.style.color = theme.colors.foreground;
      panel.style.border = `1px solid ${theme.colors.border}`;
      panel.style.fontFamily = theme.fonts.base || 'sans-serif';
    });

    function show(){
      if(list.children.length){
        panel.classList.add('token-list-open');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    function hide(){
      panel.classList.remove('token-list-open');
      panel.setAttribute('aria-hidden', 'true');
      downloadBtn.style.display = 'none';
    }

    function showDownload(){
      downloadBtn.style.display = 'inline';
    }

    function setDownloadHandler(handler){
      // allow consumers to hook into the download button
      downloadBtn.addEventListener('click', handler);
    }

    clearBtn.addEventListener('click', () => {
      if (global.simulation && typeof global.simulation.clearTokenLog === 'function') {
        global.simulation.clearTokenLog();
      }
    });

    closeBtn.addEventListener('click', hide);

    observeDOMRemoval(panel, ...cleanupFns);

    return { el: panel, show, hide, showDownload, setDownloadHandler };
  }

  global.tokenListPanel = { createTokenListPanel };
})(window);
