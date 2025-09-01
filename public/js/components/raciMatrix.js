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

    return table;
  }

  global.raciMatrix = {
    createRaciMatrix
  };
})(window);

