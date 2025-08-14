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
    if (previousId) {
      canvas.removeMarker(previousId, 'active');
    }
    if (id) {
      canvas.addMarker(id, 'active');
    }
    previousId = id;
  });

  function getStart() {
    return elementRegistry.filter(e => e.type === 'bpmn:StartEvent')[0] || null;
  }

  function schedule() {
    clearTimeout(timer);
    if (!running) return;
    timer = setTimeout(() => step(), delay);
  }

  function step(flowId) {
    if (!current) return;

    const outgoing = current.outgoing || [];

    // Handle exclusive gateway by exposing available paths
    if (current.type === 'bpmn:ExclusiveGateway' && !flowId) {
      pathsStream.set(outgoing);
      resumeAfterChoice = running;
      pause();
      return;
    }

    const flow = flowId ? elementRegistry.get(flowId) : outgoing[0];
    if (!flow) {
      pause();
      return;
    }

    current = flow.target;
    tokenStream.set(current);
    pathsStream.set(null);

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
    }
    running = true;
    schedule();
  }

  function pause() {
    running = false;
    clearTimeout(timer);
  }

  function reset() {
    pause();
    current = getStart();
    tokenStream.set(current);
    pathsStream.set(null);
  }

  return {
    start,
    pause,
    reset,
    step,
    tokenStream,
    pathsStream
  };
}

