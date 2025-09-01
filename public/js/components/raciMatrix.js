(function(global) {
  /**
   * Collect RACI data from all BPMN elements in the modeler.
   * @param {BpmnJS} modeler
   * @returns {Array<{id:string,name:string,responsible:string,accountable:string,consulted:string,informed:string}>}
   */
  function collectData(modeler) {
    if (!modeler) return [];
    const elementRegistry = modeler.get('elementRegistry');
    if (!elementRegistry) return [];

    return elementRegistry
      .getAll()
      .filter(el => !el.labelTarget)
      .map(el => {
        const bo = el.businessObject || {};
        const raci = (bo.extensionElements?.values || []).find(v => v.$type === 'custom:Raci');
        const attrs = bo.$attrs || {};
        return {
          id: el.id,
          name: bo.name || '',
          responsible: bo.responsible || raci?.responsible || attrs.responsible || '',
          accountable: bo.accountable || raci?.accountable || attrs.accountable || '',
          consulted:  bo.consulted  || raci?.consulted  || attrs.consulted  || '',
          informed:   bo.informed   || raci?.informed   || attrs.informed   || ''
        };
      });
  }

  /**
   * Create a DOM node containing a RACI matrix table.
   * @param {BpmnJS} modeler
   * @returns {HTMLElement} DOM node for mounting
   */
  function createRaciMatrix(modeler) {
    const data = collectData(modeler);

    const table = document.createElement('table');
    table.classList.add('raci-matrix');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Task', 'Responsible', 'Accountable', 'Consulted', 'Informed'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(item => {
      const tr = document.createElement('tr');

      const task = document.createElement('td');
      task.textContent = item.name || item.id;
      tr.appendChild(task);

      ['responsible', 'accountable', 'consulted', 'informed'].forEach(prop => {
        const td = document.createElement('td');
        td.textContent = item[prop] || '';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Controls container
    const controls = document.createElement('div');
    controls.style.marginBottom = '0.5rem';

    // Export CSV button
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export CSV';
    exportBtn.addEventListener('click', () => {
      const rows = table.querySelectorAll('tr');
      const csv = Array.from(rows)
        .map(row => Array.from(row.children)
          .map(cell => '"' + (cell.textContent || '').replace(/"/g, '""') + '"')
          .join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'raci-matrix.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    controls.appendChild(exportBtn);

    // Print button
    const printBtn = document.createElement('button');
    printBtn.textContent = 'Print';
    printBtn.style.marginLeft = '0.5rem';
    printBtn.addEventListener('click', () => {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write('<html><head><title>RACI Matrix</title></head><body>' + table.outerHTML + '</body></html>');
      win.document.close();
      win.focus();
      win.print();
    });
    controls.appendChild(printBtn);

    const container = document.createElement('div');
    container.appendChild(controls);
    container.appendChild(table);

    return container;
  }

  global.raciMatrix = {
    createRaciMatrix
  };
})(window);

