(function(global){
  function collectRaciData(modeler){
    if(!modeler) return [];
    const elementRegistry = modeler.get('elementRegistry');
    if(!elementRegistry) return [];
    return elementRegistry.getAll()
      .filter(el => !el.labelTarget)
      .map(el => {
        const bo = el.businessObject || {};
        return {
          id: el.id,
          name: bo.name || '',
          responsible: bo.responsible || '',
          accountable: bo.accountable || '',
          consulted: bo.consulted || '',
          informed: bo.informed || ''
        };
      });
  }

  function createRaciMatrix(modeler){
    const data = collectRaciData(modeler);

    const table = document.createElement('table');
    table.classList.add('raci-matrix');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Task','Responsible','Accountable','Consulted','Informed'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(item => {
      const tr = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.textContent = item.name || item.id;
      tr.appendChild(nameCell);
      ['responsible','accountable','consulted','informed'].forEach(prop => {
        const td = document.createElement('td');
        td.textContent = item[prop] || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const container = document.createElement('div');
    const buttons = document.createElement('div');

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export CSV';
    exportBtn.addEventListener('click', () => {
      const headers = ['Task','Responsible','Accountable','Consulted','Informed'];
      const escape = str => `"${String(str).replace(/"/g, '""')}"`;
      const rows = data.map(item => [
        escape(item.name || item.id || ''),
        escape(item.responsible || ''),
        escape(item.accountable || ''),
        escape(item.consulted || ''),
        escape(item.informed || '')
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'raci-matrix.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
    buttons.appendChild(exportBtn);

    const printBtn = document.createElement('button');
    printBtn.textContent = 'Print';
    printBtn.addEventListener('click', () => {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write('<html><head><title>RACI Matrix</title></head><body>');
      win.document.write(table.outerHTML);
      win.document.write('</body></html>');
      win.document.close();
      win.focus();
      win.print();
    });
    buttons.appendChild(printBtn);

    container.appendChild(buttons);
    container.appendChild(table);

    return container;
  }

  global.raciMatrix = { createRaciMatrix };
})(window);
