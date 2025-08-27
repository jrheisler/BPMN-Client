const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEnvironment() {
  const crypto = require('crypto');
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    localStorage: {
      _data: {},
      getItem(key) { return this._data[key] || null; },
      setItem(key, val) { this._data[key] = String(val); },
      removeItem(key) { delete this._data[key]; }
    },
    sha256: data => crypto.createHash('sha256').update(data).digest('hex')
  };
  sandbox.window = sandbox;
  const streamCode = fs.readFileSync(path.resolve(__dirname, '../../public/js/core/stream.js'), 'utf8');
  const simulationCode = fs.readFileSync(path.resolve(__dirname, '../../public/js/core/simulation.js'), 'utf8');
  const blockchainCode = fs.readFileSync(path.resolve(__dirname, '../../public/js/blockchain.js'), 'utf8');
  vm.runInNewContext(streamCode, sandbox);
  vm.runInNewContext(simulationCode, sandbox);
  vm.runInNewContext(blockchainCode, sandbox);
  return sandbox;
}

function createSimulationInstance(sandbox, elements, opts = {}) {
  const map = new Map(elements.map(e => [e.id, e]));
  const elementRegistry = {
    get(id) { return map.get(id); },
    filter(fn) { return Array.from(map.values()).filter(fn); }
  };
  const canvas = { addMarker() {}, removeMarker() {} };
  return sandbox.createSimulation({ elementRegistry, canvas }, opts);
}

function buildDiagram() {
  const start = { id: 'start', type: 'bpmn:StartEvent', outgoing: [], incoming: [], businessObject: { $type: 'bpmn:StartEvent' } };
  const task = { id: 'task', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const end = { id: 'end', type: 'bpmn:EndEvent', incoming: [], outgoing: [], businessObject: { $type: 'bpmn:EndEvent' } };

  const f0 = { id: 'f0', source: start, target: task };
  const f1 = { id: 'f1', source: task, target: end };
  start.outgoing = [f0];
  task.incoming = [f0];
  task.outgoing = [f1];
  end.incoming = [f1];

  return [start, task, end, f0, f1];
}

function runToCompletion(sim) {
  while (sim.tokenStream.get().length) {
    sim.step();
  }
}

test('simulation run adds blocks to blockchain', () => {
  const sandbox = loadEnvironment();
  const sim = createSimulationInstance(sandbox, buildDiagram(), { delay: 0 });
  const blockchain = new sandbox.Blockchain();
  let processed = 0;
  sim.tokenLogStream.subscribe(entries => {
    for (let i = processed; i < entries.length; i++) {
      blockchain.addBlock(entries[i]);
    }
    processed = entries.length;
  });
  sim.reset();
  runToCompletion(sim);
  assert.strictEqual(blockchain.chain[0].data.genesis, true);
  assert.strictEqual(blockchain.chain.length, sim.tokenLogStream.get().length + 1);
});

test('resetting simulation and blockchain starts fresh chain', () => {
  const sandbox = loadEnvironment();
  const sim = createSimulationInstance(sandbox, buildDiagram(), { delay: 0 });
  const blockchain = new sandbox.Blockchain();
  let processed = 0;
  sim.tokenLogStream.subscribe(entries => {
    for (let i = processed; i < entries.length; i++) {
      blockchain.addBlock(entries[i]);
    }
    processed = entries.length;
  });
  // First run
  sim.reset();
  runToCompletion(sim);
  assert.ok(blockchain.chain.length > 1);

  // Reset both simulation and blockchain
  blockchain.reset();
  processed = 0;
  assert.strictEqual(blockchain.chain.length, 1); // genesis only
  sim.reset();
  runToCompletion(sim);
  assert.strictEqual(blockchain.chain[0].data.genesis, true);
  assert.strictEqual(blockchain.chain.length, sim.tokenLogStream.get().length + 1);
});

