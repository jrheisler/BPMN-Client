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
  let tokenQueue = [];

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

  function step(flowIds) {
    if (!current) return;

    console.log('Stepping from', current.id);

    const outgoing = current.outgoing || [];

    const handlers = {
      'bpmn:ExclusiveGateway': handleExclusiveGateway,
      'bpmn:ParallelGateway': handleParallelGateway,
      'bpmn:InclusiveGateway': handleInclusiveGateway,
      'bpmn:EventBasedGateway': handleEventBasedGateway
    };

    const handler = handlers[current.type];

    if (handler) {
      const paused = handler(outgoing, flowIds);
      if (paused) return;
    } else {
      if (/Gateway/.test(current.type)) {
        console.warn('Unknown gateway type', current.type);
      }
      handleDefault(outgoing);
    }

    current = tokenQueue.shift();

    if (!current) {
      console.log('No outgoing flow, simulation finished');
      tokenStream.set(null);
      logToken(null);
      pathsStream.set(null);
      current = null;
      pause();
      return;
    }

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

  function handleDefault(outgoing) {
    const flow = outgoing[0];
    if (flow) {
      tokenQueue.push(flow.target);
    }
  }

  function handleExclusiveGateway(outgoing, flowId) {
    if (!flowId) {
      console.log('Awaiting decision at gateway', current.id);
      pathsStream.set(outgoing);
      resumeAfterChoice = running;
      pause();
      return true;
    }
    const flow = elementRegistry.get(flowId);
    if (flow) {
      tokenQueue.push(flow.target);
    }
  }

  function handleParallelGateway(outgoing) {
    outgoing.forEach(flow => {
      tokenQueue.push(flow.target);
    });
  }

  function handleInclusiveGateway(outgoing, flowIds) {
    const ids = Array.isArray(flowIds) ? flowIds : flowIds ? [flowIds] : null;
    if (!ids || ids.length === 0) {
      console.log('Awaiting inclusive decision at gateway', current.id);
      pathsStream.set(outgoing);
      resumeAfterChoice = running;
      pause();
      return true;
    }
    ids.forEach(id => {
      const flow = elementRegistry.get(id);
      if (flow) {
        tokenQueue.push(flow.target);
      }
    });
  }

  function handleEventBasedGateway(outgoing, flowId) {
    if (!flowId) {
      console.log('Awaiting event at gateway', current.id);
      pathsStream.set(outgoing);
      resumeAfterChoice = running;
      pause();
      return true;
    }
    const flow = elementRegistry.get(flowId);
    if (flow) {
      tokenQueue.push(flow.target);
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
    tokenQueue = [];
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

