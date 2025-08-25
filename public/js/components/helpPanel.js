import { helpContent } from '../helpContent.js';

export function createHelpPanel() {
  const panel = document.createElement('aside');
  panel.className = 'help-panel';
  panel.style.position = 'fixed';
  panel.style.top = '0';
  panel.style.right = '0';
  panel.style.height = '100%';
  panel.style.width = '250px';
  panel.style.overflowY = 'auto';
  panel.style.background = '#fff';
  panel.style.borderLeft = '1px solid #ccc';
  panel.style.padding = '1em';
  panel.style.display = 'none';

  const content = document.createElement('div');
  panel.appendChild(content);

  function update(element) {
    const type = element?.businessObject?.$type;
    const help = type && helpContent[type];
    if (help) {
      content.innerHTML = help;
      panel.style.display = '';
    } else {
      panel.style.display = 'none';
      content.innerHTML = '';
    }
  }

  return { el: panel, update };
}
