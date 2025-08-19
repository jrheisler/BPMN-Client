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

    Object.entries(addOnTypes).forEach(([type, subtypes]) => {
      const section = document.createElement('div');

      const header = reactiveElement(selectedType, sel => {
        const div = document.createElement('div');
        div.textContent = type;
        div.style.cursor = 'pointer';
        div.style.fontWeight = sel === type ? 'bold' : 'normal';
        div.addEventListener('click', () => {
          expandedType.set(expandedType.get() === type ? null : type);
          selectedType.set(type);
          selectedSubtype.set(null);
        });
        return div;
      });

      section.appendChild(header);

      const subList = reactiveElement(expandedType, exp => {
        if (exp !== type) return null;
        return subtypes.map(sub => reactiveElement(selectedSubtype, sel => {
          const item = document.createElement('div');
          item.textContent = sub;
          item.style.cursor = 'pointer';
          item.style.marginLeft = '1rem';
          item.style.fontWeight = sel === sub ? 'bold' : 'normal';
          item.addEventListener('click', e => {
            e.stopPropagation();
            selectedSubtype.set(sub);
          });
          return item;
        }));
      });

      section.appendChild(subList);
      panel.appendChild(section);
    });

    themeStream.subscribe(theme => {
      panel.style.backgroundColor = theme.colors.surface;
      panel.style.color = theme.colors.foreground;
      panel.style.borderRight = `1px solid ${theme.colors.border}`;
      panel.style.fontFamily = theme.fonts.base || 'sans-serif';
    });

    return panel;
  }

  global.addOnFilter = {
    createAddOnFilterPanel,
    selectedType,
    selectedSubtype
  };

})(window);
