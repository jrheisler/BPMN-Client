const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSimulation() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    localStorage: {
      _data: {},
      getItem(key) { return this._data[key] || null; },
      setItem(key, val) { this._data[key] = String(val); },
      removeItem(key) { delete this._data[key]; }
    }
  };
  const streamCode = fs.readFileSync(path.resolve(__dirname, '../../public/js/core/stream.js'), 'utf8');
  const simulationCode = fs.readFileSync(path.resolve(__dirname, '../../public/js/core/simulation.js'), 'utf8');
  vm.runInNewContext(streamCode, sandbox);
  vm.runInNewContext(simulationCode, sandbox);
  return sandbox.createSimulation;
}

function createSimulationInstance(elements, opts = {}) {
  const map = new Map(elements.map(e => [e.id, e]));
  const elementRegistry = {
    get(id) { return map.get(id); },
    filter(fn) { return Array.from(map.values()).filter(fn); }
  };
  const canvas = { addMarker() {}, removeMarker() {} };
  const createSimulation = loadSimulation();
  return createSimulation({ elementRegistry, canvas }, opts);
}

function buildDiagram() {
  const start = { id: 'start', type: 'bpmn:StartEvent', outgoing: [], incoming: [], businessObject: { $type: 'bpmn:StartEvent' } };
  const gw = { id: 'gw', type: 'bpmn:InclusiveGateway', businessObject: {}, incoming: [], outgoing: [] };
  const a = { id: 'a', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const b = { id: 'b', type: 'bpmn:Task', incoming: [], outgoing: [] };

  const f0 = { id: 'f0', source: start, target: gw };
  start.outgoing = [f0];
  gw.incoming = [f0];

  const fa = { id: 'fa', source: gw, target: a };
  const fb = { id: 'fb', source: gw, target: b };
  gw.outgoing = [fa, fb];
  a.incoming = [fa];
  b.incoming = [fb];

  return [start, gw, a, b, f0, fa, fb];
}

function buildUnspecifiedDiagram() {
  const start = { id: 'start', type: 'bpmn:StartEvent', outgoing: [], incoming: [], businessObject: { $type: 'bpmn:StartEvent' } };
  const gw = { id: 'gw', type: 'bpmn:InclusiveGateway', businessObject: { gatewayDirection: 'Unspecified' }, incoming: [], outgoing: [] };
  const a = { id: 'a', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const b = { id: 'b', type: 'bpmn:Task', incoming: [], outgoing: [] };

  const f0 = { id: 'f0', source: start, target: gw };
  start.outgoing = [f0];
  gw.incoming = [f0];

  const fa = { id: 'fa', source: gw, target: a };
  const fb = { id: 'fb', source: gw, target: b };
  gw.outgoing = [fa, fb];
  a.incoming = [fa];
  b.incoming = [fb];

  return [start, gw, a, b, f0, fa, fb];
}

test('inclusive gateway without gatewayDirection waits for explicit flow selection', () => {
  // Inclusive gateways with multiple outgoing flows but no gatewayDirection are
  // ambiguous. The simulator should pause at the gateway and expose the
  // available flows for an explicit user decision instead of choosing
  // automatically.
  const diagram = buildDiagram();
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // start -> gateway
  sim.step(); // process gateway, should wait for decision
  const paths = sim.pathsStream.get();
  assert.ok(paths && paths.flows.map(f => f.flow.id).sort().join(',') === 'fa,fb');
  const tokens = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(tokens, ['gw']);
});

test('inclusive gateway with "Unspecified" direction waits for explicit flow selection', () => {
  // Treating gatewayDirection="Unspecified" like no direction should pause at the gateway
  // and expose available flows for selection.
  const diagram = buildUnspecifiedDiagram();
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // start -> gateway
  sim.step(); // process gateway, should wait for decision
  const paths = sim.pathsStream.get();
  assert.ok(paths && paths.flows.map(f => f.flow.id).sort().join(',') === 'fa,fb');
  const tokens = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(tokens, ['gw']);
});


