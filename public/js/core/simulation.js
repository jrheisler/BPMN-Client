// public/js/core/simulation.js

// Simple token simulation service built on Streams
// Usage:
//   const simulation = createSimulation({ elementRegistry, canvas }, { delay: 500 });
//   simulation.start();
//
// Handlers can be registered via `elementHandlers` to intercept elements:
//   simulation.elementHandlers.set('bpmn:UserTask', (token, api) => {
//     api.pause();
//     // async work ... then
//     api.resume();
//     return [token];
//   });

function createSimulation(services, opts = {}) {
  const { elementRegistry, canvas } = services;
  const delay = opts.delay || 1000;

  // Stream of currently active tokens [{ id, element }]
  const tokenStream = new Stream([]);
  const tokenLogStream = new Stream([]);
  // Stream of available sequence flows when waiting on a gateway decision
  const pathsStream = new Stream(null);

  const TOKEN_LOG_STORAGE_KEY = 'simulationTokenLog';

  function saveTokenLog() {
    try {
      const data = tokenLogStream.get();
      if (data && data.length) {
        localStorage.setItem(TOKEN_LOG_STORAGE_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(TOKEN_LOG_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Failed to save token log', err);
    }
  }

  function loadTokenLog() {
    try {
      const data = localStorage.getItem(TOKEN_LOG_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        tokenLogStream.set(parsed);
        if (parsed.length) {
          const last = parsed[parsed.length - 1];
          if (last.elementId) {
            const el = elementRegistry.get(last.elementId);
            if (el) {
              tokens = [{ id: last.tokenId, element: el }];
              tokenStream.set(tokens);
            }
          }
        }
        saveTokenLog();
      }
    } catch (err) {
      console.warn('Failed to load token log', err);
    }
  }

  function clearTokenLog() {
    tokenLogStream.set([]);
    saveTokenLog();
  }
let timer = null;
let running = false;
let tokens = [];
let awaitingToken = null;
let resumeAfterChoice = false;
let nextTokenId = 1;

// Map of BPMN element type -> handler(token, api)
  const elementHandlers = new Map();

  // Cleanup hooks for element handlers (timeouts, listeners, ...)
  const handlerCleanups = new Set();

  // Token ids that should skip their element handler on next step
  const skipHandlerFor = new Set();

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

  loadTokenLog();

  function logToken(token) {
    const el = token.element;
    const entry = {
      tokenId: token.id,
      elementId: el ? el.id : null,
      elementName: el ? el.businessObject?.name || el.name || null : null,
      timestamp: Date.now()
    };
    tokenLogStream.set([...tokenLogStream.get(), entry]);
    saveTokenLog();
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

  // --- Default element handlers ---
  elementHandlers.set('bpmn:UserTask', (token, api) => {
    console.log('Waiting at user task', token.element.id);
    api.pause();
    const to = setTimeout(() => {
      skipHandlerFor.add(token.id);
      api.resume();
    }, delay);
    api.addCleanup(() => clearTimeout(to));
    return [token];
  });

  elementHandlers.set('bpmn:TimerEvent', (token, api) => {
    console.log('Timer event triggered', token.element.id);
    api.pause();
    const to = setTimeout(() => {
      skipHandlerFor.add(token.id);
      api.resume();
    }, delay);
    api.addCleanup(() => clearTimeout(to));
    return [token];
  });

  function clearHandlerState(clearSkip = false) {
    handlerCleanups.forEach(fn => fn());
    handlerCleanups.clear();
    if (clearSkip) skipHandlerFor.clear();
  }

  function cleanup() {
    clearHandlerState(true);
    awaitingToken = null;
    resumeAfterChoice = false;
    pathsStream.set(null);
    tokens = [];
    tokenStream.set(tokens);
    previousIds.forEach(id => {
      if (elementRegistry.get(id)) canvas.removeMarker(id, 'active');
    });
    previousIds = new Set();
  }

  function handleDefault(token, outgoing) {
    const flow = outgoing[0];
    if (flow) {
      const next = { id: token.id, element: flow.target, pendingJoins: token.pendingJoins };
      logToken(next);
      return [next];
    }
    logToken({ id: token.id, element: null });
    return [];
  }

  function handleExclusiveGateway(token, outgoing, flowId) {
    // Determine viable flows based on conditions when no flowId is provided
    if (!flowId) {
      const evaluate = expr => {
        if (!expr) return true;
        const raw = (expr.body || expr.value || '').toString().trim();
        const js = raw.replace(/^\$\{?|\}$/g, '');
        if (!js) return true;
        try {
          return !!Function(`return (${js});`)();
        } catch (err) {
          console.warn('Failed to evaluate condition', js, err);
          return false;
        }
      };

      let viable = outgoing.filter(flow => evaluate(flow.businessObject?.conditionExpression));

      if (!viable.length) {
        const defBo = token.element.businessObject?.default;
        if (defBo) {
          const defFlow = elementRegistry.get(defBo.id) || defBo;
          if (defFlow) viable = [defFlow];
        }
      }

      if (viable.length === 1) {
        const flow = viable[0];
        const next = { id: token.id, element: flow.target, pendingJoins: token.pendingJoins };
        logToken(next);
        return [next];
      }

      pathsStream.set({ flows: viable, type: token.element.type });
      awaitingToken = token;
      resumeAfterChoice = running;
      pause();
      return null;
    }

    // Flow was chosen explicitly
    const flow = elementRegistry.get(flowId);
    if (flow) {
      const next = { id: token.id, element: flow.target, pendingJoins: token.pendingJoins };
      logToken(next);
      return [next];
    }
    return [];
  }

  function handleParallelGateway(token, outgoing) {
    return outgoing.map((flow, idx) => {
      const next = {
        id: idx === 0 ? token.id : nextTokenId++,
        element: flow.target,
        pendingJoins: token.pendingJoins
      };
      logToken(next);
      return next;
    });
  }

  function findInclusiveJoin(split) {
    const outgoings = split.outgoing || [];
    const pathJoins = [];

    function traverse(start) {
      const joins = {};
      const queue = [{ el: start, dist: 1 }];
      const visited = new Map();
      while (queue.length) {
        const { el, dist } = queue.shift();
        const prev = visited.get(el.id);
        if (prev !== undefined && prev <= dist) continue;
        visited.set(el.id, dist);
        if (
          el.type === 'bpmn:InclusiveGateway' &&
          el.businessObject?.gatewayDirection === 'Converging'
        ) {
          if (joins[el.id] === undefined || dist < joins[el.id]) {
            joins[el.id] = dist;
          }
        }
        (el.outgoing || []).forEach(flow => {
          if (flow.target) queue.push({ el: flow.target, dist: dist + 1 });
        });
      }
      return joins;
    }

    outgoings.forEach(flow => {
      if (flow.target) {
        pathJoins.push(traverse(flow.target));
      }
    });

    if (!pathJoins.length) return [];

    // find common join ids across all paths
    let commonIds = Object.keys(pathJoins[0]);
    for (let i = 1; i < pathJoins.length; i++) {
      const ids = Object.keys(pathJoins[i]);
      commonIds = commonIds.filter(id => ids.includes(id));
    }

    if (!commonIds.length) return [];

    // select nearest joins based on maximal distance among paths
    let nearest = [];
    let minMax = Infinity;
    commonIds.forEach(id => {
      const max = Math.max(...pathJoins.map(j => j[id]));
      if (max < minMax) {
        minMax = max;
        nearest = [id];
      } else if (max === minMax) {
        nearest.push(id);
      }
    });

    return nearest.map(id => elementRegistry.get(id)).filter(Boolean);
  }

  function handleInclusiveGateway(token, outgoing, flowIds) {
    const direction = token.element.businessObject?.gatewayDirection;
    const incomingCount = (token.element.incoming || []).length;
    const diverging =
      outgoing.length > 1 &&
      (direction === 'Diverging' ||
        ((!direction || direction === 'Unspecified') && incomingCount <= 1));
    if (!diverging) {
      return handleDefault(token, outgoing);
    }

    const ids = Array.isArray(flowIds) ? flowIds : flowIds ? [flowIds] : null;
    if (!ids || ids.length === 0) {
      console.log('Awaiting inclusive decision at gateway', token.element.id);
      pathsStream.set({ flows: outgoing, type: token.element.type });
      awaitingToken = token;
      resumeAfterChoice = running;
      pause();
      return null;
    }
    const joins = findInclusiveJoin(token.element);
    return ids
      .map((id, idx) => {
        const flow = elementRegistry.get(id);
        if (!flow) return null;
        const pendingJoins = { ...(token.pendingJoins || {}) };
        if (joins && joins.length) {
          joins.forEach(join => {
            pendingJoins[join.id] = ids.length;
          });
        }
        const next = {
          id: idx === 0 ? token.id : nextTokenId++,
          element: flow.target,
          pendingJoins
        };
        logToken(next);
        return next;
      })
      .filter(Boolean);
  }

  function handleEventBasedGateway(token, outgoing, flowId) {
    if (!flowId) {
      console.log('Awaiting event at gateway', token.element.id);
      pathsStream.set({ flows: outgoing, type: token.element.type });
      awaitingToken = token;
      resumeAfterChoice = running;
      pause();
      return null;
    }
    const flow = elementRegistry.get(flowId);
    if (flow) {
      const next = { id: token.id, element: flow.target, pendingJoins: token.pendingJoins };
      logToken(next);
      return [next];
    }
    return [];
  }

  function processToken(token, flowIds) {
    const outgoing = token.element.outgoing || [];

    if (!skipHandlerFor.has(token.id)) {
      const elHandler = elementHandlers.get(token.element.type);
      if (elHandler) {
        const api = {
          pause,
          resume,
          addCleanup: fn => handlerCleanups.add(fn)
        };
        const res = elHandler(token, api, flowIds);
        if (Array.isArray(res)) return res;
      }
    } else {
      skipHandlerFor.delete(token.id);
    }

    const gatewayHandlers = {
      'bpmn:ExclusiveGateway': handleExclusiveGateway,
      'bpmn:ParallelGateway': handleParallelGateway,
      'bpmn:InclusiveGateway': handleInclusiveGateway,
      'bpmn:EventBasedGateway': handleEventBasedGateway
    };
    const gatewayHandler = gatewayHandlers[token.element.type];
    if (gatewayHandler) {
      return gatewayHandler(token, outgoing, flowIds);
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
        cleanup();
        return;
      }
      if (resumeAfterChoice) {
        resumeAfterChoice = false;
        resume();
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
      const type = el.type;
      if (incomingCount > 1 && (type === 'bpmn:ParallelGateway' || type === 'bpmn:InclusiveGateway')) {
        const group = tokens.filter(t => t.element.id === el.id);
        group.forEach(t => processed.add(t.id));
        const expected = group[0].pendingJoins?.[el.id] || incomingCount;
        if (group.length < expected) {
          newTokens.push(...group);
          continue;
        }
        const merged = { id: group[0].id, element: el };
        const mergedPending = {};
        group.forEach(t => {
          if (t.pendingJoins) Object.assign(mergedPending, t.pendingJoins);
        });
        if (mergedPending[el.id]) delete mergedPending[el.id];
        if (Object.keys(mergedPending).length) {
          merged.pendingJoins = mergedPending;
        }
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
      cleanup();
      return;
    }

    schedule();
  }

  function start() {
    if (tokens.length || running) {
      stop();
    }

    clearHandlerState();
    clearTokenLog();
    pathsStream.set(null);
    awaitingToken = null;
    previousIds.forEach(id => {
      if (elementRegistry.get(id)) canvas.removeMarker(id, 'active');
    });
    previousIds = new Set();

    const startEl = getStart();
    const t = { id: nextTokenId++, element: startEl };
    tokens = [t];
    tokenStream.set(tokens);
    logToken(t);
    console.log('Simulation started');
    running = true;
    schedule();
  }

  function resume() {
    if (running) return;
    clearHandlerState();
    console.log('Simulation resumed');
    running = true;
    schedule();
  }

  function pause() {
    running = false;
    clearTimeout(timer);
    console.log('Simulation paused');
    if (!tokens.length) {
      cleanup();
    }
  }

  function stop() {
    pause();
    cleanup();
  }

  function reset() {
    pause();
    cleanup();
    clearTokenLog();
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
    resume,
    pause,
    stop,
    reset,
    clearTokenLog,
    step,
    tokenStream,
    tokenLogStream,
    pathsStream,
    elementHandlers
  };
}

