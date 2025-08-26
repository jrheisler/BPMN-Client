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
  const streamCode = fs.readFileSync(path.resolve(__dirname, '../public/js/core/stream.js'), 'utf8');
  const simulationCode = fs.readFileSync(path.resolve(__dirname, '../public/js/core/simulation.js'), 'utf8');
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

function buildDiagram(direction, outgoingCount = 1) {
  const task = { id: 'task', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const gateway = {
    id: 'gw',
    type: 'bpmn:InclusiveGateway',
    businessObject: { gatewayDirection: direction },
    incoming: [],
    outgoing: []
  };
  const start = {
    id: 'start',
    type: 'bpmn:StartEvent',
    outgoing: [],
    incoming: [],
    businessObject: { $type: 'bpmn:StartEvent' }
  };
  const flow0 = { id: 'f0', source: start, target: gateway };
  start.outgoing = [flow0];
  gateway.incoming = [flow0];

  const flows = [];
  for (let i = 0; i < outgoingCount; i++) {
    const flow = { id: `f${i + 1}`, source: gateway, target: task };
    flows.push(flow);
  }
  gateway.outgoing = flows;
  task.incoming = flows;

  return [start, gateway, task, flow0, ...flows];
}

test('converging inclusive gateway auto forwards without confirmation', () => {
  const diagram = buildDiagram('Converging');
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // move to gateway
  sim.step(); // should auto-forward
  assert.strictEqual(sim.tokenStream.get()[0].element.id, 'task');
  assert.strictEqual(sim.pathsStream.get(), null);
});

test('single-path diverging inclusive gateway auto forwards without confirmation', () => {
  const diagram = buildDiagram('Diverging', 1);
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // move to gateway
  sim.step(); // should auto-forward
  assert.strictEqual(sim.tokenStream.get()[0].element.id, 'task');
  assert.strictEqual(sim.pathsStream.get(), null);
});
