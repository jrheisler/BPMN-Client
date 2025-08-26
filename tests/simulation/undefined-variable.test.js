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

function createSimulationInstance(elements, opts = {}, context = {}) {
  const map = new Map(elements.map(e => [e.id, e]));
  const elementRegistry = {
    get(id) { return map.get(id); },
    filter(fn) { return Array.from(map.values()).filter(fn); }
  };
  const canvas = { addMarker() {}, removeMarker() {} };
  const createSimulation = loadSimulation();
  return createSimulation({ elementRegistry, canvas, context }, opts);
}

function buildDiagram() {
  const start = { id: 'start', type: 'bpmn:StartEvent', outgoing: [], incoming: [], businessObject: { $type: 'bpmn:StartEvent' } };
  const gw = { id: 'gw', type: 'bpmn:ExclusiveGateway', businessObject: { gatewayDirection: 'Diverging' }, incoming: [], outgoing: [] };
  const a = { id: 'a', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const b = { id: 'b', type: 'bpmn:Task', incoming: [], outgoing: [] };

  const f0 = { id: 'f0', source: start, target: gw };
  start.outgoing = [f0];
  gw.incoming = [f0];

  const f1 = { id: 'f1', source: gw, target: a, businessObject: { conditionExpression: { body: '${flag}' } } };
  const f2 = { id: 'f2', source: gw, target: b };
  gw.outgoing = [f1, f2];
  gw.businessObject.default = f2;
  a.incoming = [f1];
  b.incoming = [f2];

  return [start, gw, a, b, f0, f1, f2];
}

test('undefined variables evaluate to false by default', () => {
  const diagram = buildDiagram();
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // start -> gateway
  sim.step(); // evaluate
  const after = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(after, ['b']);
});

test('undefined variables use provided fallback', () => {
  const diagram = buildDiagram();
  const sim = createSimulationInstance(diagram, { delay: 0, conditionFallback: true });
  sim.reset();
  sim.step(); // start -> gateway
  sim.step(); // evaluate and pause since two flows are viable
  const paths = sim.pathsStream.get();
  assert.ok(paths);
  assert.deepStrictEqual(paths.flows.map(f => f.id), ['f1', 'f2']);
  sim.step('f1'); // choose conditional flow
  const after = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(after, ['a']);
});
