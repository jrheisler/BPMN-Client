(function(global){
  const treeStream = new Stream(null);

  function renderNode(node){
    const li = document.createElement('li');
    li.textContent = node.name || node.id;

    if (node.children && node.children.length){
      const ul = document.createElement('ul');
      node.children.forEach(child => {
        const childEl = renderNode(child);
        if (childEl) ul.appendChild(childEl);
      });
      li.appendChild(ul);
    }

    return li;
  }

  function createTreeContainer(){
    const container = document.createElement('div');
    treeStream.subscribe(tree => {
      container.innerHTML = '';
      if (!tree) return;
      const ul = document.createElement('ul');
      ul.appendChild(renderNode(tree));
      container.appendChild(ul);
    });
    return container;
  }

  global.diagramTree = {
    treeStream,
    createTreeContainer
  };
})(window);
