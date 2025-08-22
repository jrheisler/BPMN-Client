// public/js/core/simulation.js

// Simple token simulation service built on Streams
// Usage:
//   const simulation = createSimulation({ elementRegistry, canvas }, { delay: 500 });
//   simulation.start();

function createSimulation(services, opts = {}) {
  const { elementRegistry, canvas } = services;
  const delay = opts.delay || 1000;

  // Stream of currently active tokens [{ id, element }]
  const tokenStream = new Stream([]);
  const tokenLogStream = new Stream([]);
  // Stream of available sequence flows when waiting on a gateway decision
  const pathsStream = new Stream(null);

  let timer = null;
  let running = false;
  let tokens = [];
  let awaitingToken = null;
  let resumeAfterChoice = false;
  let nextTokenId = 1;

  // Visual highlighting of the active elements
  let previousIds = new Set();
  tokenStream.subscribe(list => {
    const currentIds = new Set(
      list.filter(t => t.element).map(t => t.element.id)
    );
    previousIds.forEach(id => {
      if (!currentIds.has(id) && elementRegistry.get(id)) {
        canvas.removeMarker(id, 'active');
      }
    });
    currentIds.forEach(id => {
      if (!previousIds.has(id)) {
        canvas.addMarker(id, 'active');
      }
    });
    previousIds = currentIds;
  });

  function logToken(token) {
    const el = token.element;
    const entry = {
      tokenId: token.id,
      elementId: el ? el.id : null,
      elementName: el ? el.businessObject?.name || el.name || null : null,
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

  function handleDefault(token, outgoing) {
    const flow = outgoing[0];
    if (flow) {
      const next = { id: token.id, element: flow.target };
      logToken(next);
      return [next];
    }
    logToken({ id: token.id, element: null });
    return [];
  }

  function handleExclusiveGateway(token, outgoing, flowId) {
    if (!flowId) {
      console.log('Awaiting decision at gateway', token.element.id);
      pathsStream.set(outgoing);
      awaitingToken = token;
      resumeAfterChoice = running;
      pause();
      return null;
    }
    const flow = elementRegistry.get(flowId);
    if (flow) {
      const next = { id: token.id, element: flow.target };
      logToken(next);
      return [next];
    }
    return [];
  }

  function handleParallelGateway(token, outgoing) {
    return outgoing.map((flow, idx) => {
      const next = {
        id: idx === 0 ? token.id : nextTokenId++,
        element: flow.target
      };
      logToken(next);
      return next;
    });
  }

  function handleInclusiveGateway(token, outgoing, flowIds) {
    const ids = Array.isArray(flowIds) ? flowIds : flowIds ? [flowIds] : null;
    if (!ids || ids.length === 0) {
      console.log('Awaiting inclusive decision at gateway', token.element.id);
      pathsStream.set(outgoing);
      awaitingToken = token;
      resumeAfterChoice = running;
      pause();
      return null;
    }
    return ids.map((id, idx) => {
      const flow = elementRegistry.get(id);
      if (!flow) return null;
      const next = {
        id: idx === 0 ? token.id : nextTokenId++,
        element: flow.target
      };
      logToken(next);
      return next;
    }).filter(Boolean);
  }

  function handleEventBasedGateway(token, outgoing, flowId) {
    if (!flowId) {
      console.log('Awaiting event at gateway', token.element.id);
      pathsStream.set(outgoing);
      awaitingToken = token;
      resumeAfterChoice = running;
      pause();
      return null;
    }
    const flow = elementRegistry.get(flowId);
    if (flow) {
      const next = { id: token.id, element: flow.target };
      logToken(next);
      return [next];
    }
    return [];
  }

  function processToken(token, flowIds) {
    const outgoing = token.element.outgoing || [];
    const handlers = {
      'bpmn:ExclusiveGateway': handleExclusiveGateway,
      'bpmn:ParallelGateway': handleParallelGateway,
      'bpmn:InclusiveGateway': handleInclusiveGateway,
      'bpmn:EventBasedGateway': handleEventBasedGateway
    };
    const handler = handlers[token.element.type];
    if (handler) {
      return handler(token, outgoing, flowIds);
    }
    if (/Gateway/.test(token.element.type)) {
      console.warn('Unknown gateway type', token.element.type);
    }
    return handleDefault(token, outgoing);
  }

  function step(flowIds) {
    if (awaitingToken) {
      const res = processToken(awaitingToken, flowIds);
      if (res === null) return;
      tokens = tokens.filter(t => t.id !== awaitingToken.id).concat(res);
      awaitingToken = null;
      pathsStream.set(null);
      tokenStream.set(tokens);
      if (!tokens.length) {
        console.log('No outgoing flow, simulation finished');
        pause();
        return;
      }
      if (resumeAfterChoice) {
        resumeAfterChoice = false;
        start();
      } else {
        schedule();
      }
      return;
    }

    if (!tokens.length) return;

    const newTokens = [];
    const processed = new Set();

    for (const token of tokens) {
      if (processed.has(token.id)) continue;
      const el = token.element;
      const incomingCount = (el.incoming || []).length;
      if (incomingCount > 1) {
        const group = tokens.filter(t => t.element.id === el.id);
        group.forEach(t => processed.add(t.id));
        if (group.length < incomingCount) {
          newTokens.push(...group);
          continue;
        }
        const merged = { id: group[0].id, element: el };
        const res = processToken(merged);
        if (res === null) {
          awaitingToken = merged;
          newTokens.push(merged);
          tokens = newTokens.concat(tokens.filter(t => !processed.has(t.id)));
          tokenStream.set(tokens);
          return;
        }
        newTokens.push(...res);
      } else {
        processed.add(token.id);
        const res = processToken(token);
        if (res === null) {
          awaitingToken = token;
          newTokens.push(token);
          tokens = newTokens.concat(tokens.filter(t => !processed.has(t.id)));
          tokenStream.set(tokens);
          return;
        }
        newTokens.push(...res);
      }
    }

    tokens = newTokens;
    tokenStream.set(tokens);
    pathsStream.set(null);

    if (!tokens.length) {
      console.log('No outgoing flow, simulation finished');
      pause();
      return;
    }

    schedule();
  }

  function start() {
    if (!tokens.length) {
      const startEl = getStart();
      const t = { id: nextTokenId++, element: startEl };
      tokens = [t];
      tokenStream.set(tokens);
      logToken(t);
    }
    console.log('Simulation started');
    running = true;
    schedule();
  }

  function pause() {
    running = false;
    clearTimeout(timer);
    console.log('Simulation paused');
  }

  function reset() {
    pause();
    previousIds.forEach(id => {
      if (elementRegistry.get(id)) canvas.removeMarker(id, 'active');
    });
    previousIds = new Set();
    tokens = [];
    awaitingToken = null;
    tokenLogStream.set([]);
    const startEl = getStart();
    const t = { id: nextTokenId++, element: startEl };
    tokens = [t];
    tokenStream.set(tokens);
    logToken(t);
    pathsStream.set(null);
    console.log('Simulation reset to start element', startEl && startEl.id);
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

