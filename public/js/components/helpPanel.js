import { helpContent } from '../helpContent.js';

export function createHelpPanel() {
  const panel = document.createElement('aside');
  panel.className = 'help-panel';
  panel.style.display = 'none';

  const header = document.createElement('h2');
  header.textContent = 'Help';
  panel.appendChild(header);

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

  function showQuickMenuHelp(types = []) {
    const items = types
      .map(t => helpContent[t] && `<div class="help-item"><strong>${t.replace('bpmn:', '')}</strong>: ${helpContent[t]}</div>`)
      .filter(Boolean);
    if (items.length) {
      content.innerHTML = items.join('');
      panel.style.display = '';
    } else {
      panel.style.display = 'none';
      content.innerHTML = '';
    }
  }

  return { el: panel, update, showQuickMenuHelp };
}
