(function (global) {
  /**
   * Load the real bpmn-js-token-simulation UMD bundle from a CDN.
   * The original repository does not ship a pre-built bundle with the npm
   * package, therefore we dynamically fetch the official UMD build and expose
   * its global so that `app.js` can resolve `tokenSimulationModule`.
   */
  var script = document.createElement('script');
  script.src =
    'https://unpkg.com/bpmn-js-token-simulation@0.31.0/dist/bpmn-js-token-simulation.umd.js';

  script.onload = function () {
    // Align with the various globals that may be exposed by the UMD bundle
    global.BpmnJSTokenSimulation =
      global.BpmnJSTokenSimulation ||
      global.BpmnJsTokenSimulation ||
      global.TokenSimulationModule ||
      global.TokenSimulation ||
      global['bpmn-js-token-simulation'] ||
      global.tokenSimulationModule;
  };

  document.head.appendChild(script);
})(window);
