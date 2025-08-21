// public/js/core/simulation.js

// Simple token simulation service built on Streams
// Usage:
//   const simulation = createSimulation({ elementRegistry, canvas }, { delay: 500 });
//   simulation.start();

function createSimulation(services, opts = {}) {
  const { elementRegistry, canvas } = services;
  const delay = opts.delay || 1000;

  // Stream of the current BPMN element holding the token
  const tokenStream = new Stream(null);
  const tokenLogStream = new Stream([]);
  // Stream of available sequence flows when waiting on a gateway decision
  const pathsStream = new Stream(null);

  let timer = null;
  let running = false;
  let current = null;
  let resumeAfterChoice = false;

  // Visual highlighting of the active element
  let previousId = null;
  tokenStream.subscribe(el => {
    const id = el && el.id;
    if (previousId && elementRegistry.get(previousId)) {
      canvas.removeMarker(previousId, 'active');
    }
    if (id) {
      canvas.addMarker(id, 'active');
    }
    previousId = id;
  });

  function logToken(element) {
    const entry = {
      elementId: element ? element.id : null,
      elementName: element ? element.businessObject?.name || element.name || null : null,
      timestamp: Date.now()
    };
    tokenLogStream.set([...tokenLogStream.get(), entry]);
  }

  function getStart() {
    const all = elementRegistry.filter
      ? elementRegistry.filter(e => e.type === 'bpmn:StartEvent' || e.businessObject?.$type === 'bpmn:StartEvent')
      : [];
    const start = all[0] || null;
    if (!start) {
      console.warn('No StartEvent found in diagram');
    }
    return start;
  }

  function schedule() {
    clearTimeout(timer);
    if (!running) return;
    timer = setTimeout(() => step(), delay);
  }

  function step(flowId) {
    if (!current) return;

    console.log('Stepping from', current.id);

    const outgoing = current.outgoing || [];

    // Handle exclusive gateway by exposing available paths
    if (current.type === 'bpmn:ExclusiveGateway' && !flowId) {
      console.log('Awaiting decision at gateway', current.id);
      pathsStream.set(outgoing);
      resumeAfterChoice = running;
      pause();
      return;
    }

    const flow = flowId ? elementRegistry.get(flowId) : outgoing[0];
    if (!flow) {
      console.log('No outgoing flow, simulation finished at', current.id);
      // clear token and reset state so simulation can start over cleanly
      tokenStream.set(null);
      logToken(null);
      pathsStream.set(null);
      current = null;
      pause();
      return;
    }

    current = flow.target;
    tokenStream.set(current);
    logToken(current);
    pathsStream.set(null);
    console.log('Token moved to element', current.id);

    if (resumeAfterChoice) {
      resumeAfterChoice = false;
      start();
    } else {
      schedule();
    }
  }

  function start() {
    if (!current) {
      current = getStart();
      tokenStream.set(current);
      logToken(current);
    }
    console.log('Simulation started at element', current && current.id);
    running = true;
    schedule();
  }

  function pause() {
    running = false;
    clearTimeout(timer);
    console.log('Simulation paused at element', current && current.id);
  }

  function reset() {
    pause();
    if (previousId && elementRegistry.get(previousId)) {
      canvas.removeMarker(previousId, 'active');
    }
    previousId = null;
    current = getStart();
    tokenLogStream.set([]);
    tokenStream.set(current);
    logToken(current);
    pathsStream.set(null);
    console.log('Simulation reset to start element', current && current.id);
  }

  return {
    start,
    pause,
    reset,
    step,
    tokenStream,
    tokenLogStream,
    pathsStream
  };
}

