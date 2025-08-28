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
  const canvas = {
    added: [],
    removed: [],
    addMarker(id, marker) { this.added.push([id, marker]); },
    removeMarker(id, marker) { this.removed.push([id, marker]); }
  };
  const createSimulation = loadSimulation();
  const sim = createSimulation({ elementRegistry, canvas }, opts);
  return { sim, canvas };
}

function buildSimpleDiagram() {
  const start = { id: 'start', type: 'bpmn:StartEvent', outgoing: [], incoming: [], businessObject: { $type: 'bpmn:StartEvent' } };
  const task = { id: 'task', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const f0 = { id: 'f0', source: start, target: task };
  start.outgoing = [f0];
  task.incoming = [f0];
  return [start, task, f0];
}

test('sequence flow receives active marker when token passes through it', () => {
  const { sim, canvas } = createSimulationInstance(buildSimpleDiagram(), { delay: 0 });
  sim.reset();
  canvas.added = [];
  canvas.removed = [];

  // start -> task via f0
  sim.step();
  assert.ok(canvas.added.some(([id, marker]) => id === 'f0' && marker === 'active'));

  canvas.added = [];
  canvas.removed = [];
  // task has no outgoing, token ends
  sim.step();
  assert.ok(canvas.removed.some(([id, marker]) => id === 'f0' && marker === 'active'));
});
