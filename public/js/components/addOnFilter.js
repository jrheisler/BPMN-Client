(function(global){
  const addOnTypes = {
    'Knowledge': [
      'Process Assumptions',
      'Process Issues',
      'Lessons Learned',
      'Best Practices',
      'Practical Solutions',
      'Other'
    ],
    'Business': [
      'Corporate Mission',
      'Critical Success',
      'Goals',
      'Objectives',
      'Others'
    ],
    'Requirement': [
      'Availability',
      'Resource',
      'Customer',
      'Directive',
      'Governance',
      'Quality (e.g., ISO)',
      'Legal',
      'Maintainability',
      'Policy',
      'Procedure(s)',
      'Work Instruction',
      'Regulations',
      'Reliability',
      'Safety',
      'Service Responsibility',
      'Standards',
      'System',
      'Others'
    ],
    'Lifecycle': [
      'Create',
      'In Work',
      'In Review',
      'Approved',
      'Released',
      'Archived',
      'Obsolete',
      'Others'
    ],
    'Measurement': [
      'Quality',
      'Quantity',
      'Time',
      'Cost',
      'Service Level Agreement',
      'Utilization',
      'Others'
    ],
    'Condition': [
      'Start Event',
      'Stop Event',
      'Others'
    ],
    'Material': [
      'Raw',
      'Processed',
      'Others'
    ],
    'Role': [
      'Individual',
      'Group',
      'Organization',
      'Stakeholders',
      'Others'
    ],
    'Equipment': [
      'Apparatus',
      'Fixed',
      'Asset',
      'Others'
    ],
    'System': [
      'Transaction Processing',
      'Office Automation',
      'Knowledge Work',
      'Management Information',
      'Decision Support',
      'Executive Support',
      'Others'
    ],
    'Tool': [
      'Hardware',
      'Software',
      'Techno-mechanical',
      'Others'
    ],
    'Information': [
      'Artifact',
      'Data',
      'Others'
    ]
  };

  const selectedType = new Stream(null);
  const selectedSubtype = new Stream(null);
  const expandedType = new Stream(null);

  function createAddOnFilterPanel(themeStream = currentTheme){
    const panel = document.createElement('div');
    panel.classList.add('addon-filter');
    Object.assign(panel.style, {
      position: 'fixed',
      top: '3rem',
      right: '1rem',
      width: '250px',
      maxHeight: '80vh',
      overflowY: 'auto',
      padding: '1rem',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      flexDirection: 'column',
      gap: '0.5rem',
      zIndex: '1000',
      display: 'none'
    });

    const list = document.createElement('ul');
    panel.appendChild(list);

    Object.entries(addOnTypes).forEach(([type, subtypes]) => {
      const typeItem = document.createElement('li');
      typeItem.className = 'addon-type';

      const header = document.createElement('div');
      header.className = 'addon-type-header';
      header.textContent = type;
      header.addEventListener('click', () => {
        expandedType.set(expandedType.get() === type ? null : type);
        selectedType.set(type);
        selectedSubtype.set(null);
      });
      typeItem.appendChild(header);

      const subList = document.createElement('ul');
      subList.className = 'subtype-list';

      subtypes.forEach(sub => {
        const subItem = document.createElement('li');
        subItem.className = 'subtype-item';
        subItem.textContent = sub;
        subItem.addEventListener('click', e => {
          e.stopPropagation();
          selectedSubtype.set(sub);
        });
        selectedSubtype.subscribe(sel => {
          subItem.classList.toggle('selected', sel === sub);
        });
        subList.appendChild(subItem);
      });

      typeItem.appendChild(subList);
      list.appendChild(typeItem);

      selectedType.subscribe(sel => {
        header.classList.toggle('selected', sel === type);
      });

      expandedType.subscribe(exp => {
        typeItem.classList.toggle('expanded', exp === type);
      });
    });

    themeStream.subscribe(theme => {
      panel.style.backgroundColor = theme.colors.surface;
      panel.style.color = theme.colors.foreground;
      panel.style.borderRight = `1px solid ${theme.colors.border}`;
      panel.style.fontFamily = theme.fonts.base || 'sans-serif';
      panel.style.setProperty('--addon-hover-bg', theme.colors.primary + '22');
      panel.style.setProperty('--addon-icon-color', theme.colors.foreground);
    });

    return panel;
  }

  global.addOnFilter = {
    createAddOnFilterPanel,
    selectedType,
    selectedSubtype
  };

})(window);
