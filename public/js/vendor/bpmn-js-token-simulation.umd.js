/**
 * Tiny helper that loads the token simulation bundle from a CDN and exposes a
 * promise that resolves once the script finished loading.  Consumers may await
 * `window.BpmnJSTokenSimulationReady` to ensure the plugin is available.
 */
(function (global) {
  var resolveReady;

  // Expose a promise for consumers to await
  global.BpmnJSTokenSimulationReady = new Promise(function (resolve) {
    resolveReady = resolve;
  });

  var script = document.createElement('script');
  script.src =
    'https://unpkg.com/@bpmn-io/token-simulation@0.24.0/dist/index.umd.js';

  script.onload = function () {
    // Align with the various globals that may be exposed by the UMD bundle
    global.BpmnJSTokenSimulation =
      global.BpmnJSTokenSimulation ||
      global.BpmnJsTokenSimulation ||
      global.TokenSimulationModule ||
      global.TokenSimulation ||
      global['bpmn-js-token-simulation'] ||
      global.tokenSimulationModule;

    resolveReady(global.BpmnJSTokenSimulation);
  };

  // Resolve the promise even if loading fails so callers can continue
  script.onerror = function (err) {
    console.error('Failed to load bpmn-js-token-simulation bundle', err);
    resolveReady();
  };

  document.head.appendChild(script);
})(window);
