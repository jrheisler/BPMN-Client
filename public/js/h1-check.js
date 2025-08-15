/**
 * Simple utility to log all H1 elements on the page.
 * Ensures Object.keys is only called with a valid object.
 */
(function () {
  function logHeadings(obj) {
    if (!obj || typeof obj !== 'object') {
      console.warn('h1-check: expected an object, received', obj);
      return;
    }

    Object.keys(obj).forEach(function (key) {
      console.log(key, obj[key]);
    });
  }

  const h1Nodes = document.querySelectorAll('h1');
  const headings = Array.from(h1Nodes).reduce(function (acc, node, index) {
    acc[index] = node.textContent;
    return acc;
  }, {});

  logHeadings(headings);
})();
