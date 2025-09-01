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

function buildDiagram(targetParticipant = false) {
  const startA = {
    id: 'Start_A',
    type: 'bpmn:StartEvent',
    incoming: [],
    outgoing: [],
    businessObject: { $type: 'bpmn:StartEvent' }
  };
  const task = { id: 'Task_A', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const next = { id: 'Task_B', type: 'bpmn:Task', incoming: [], outgoing: [] };

  const f0 = { id: 'Flow_0', type: 'bpmn:SequenceFlow', source: startA, target: task };
  startA.outgoing = [f0];
  task.incoming = [f0];

  const fSeq = { id: 'Flow_Seq', type: 'bpmn:SequenceFlow', source: task, target: next };
  task.outgoing = [fSeq];
  next.incoming = [fSeq];

  let msgTarget;
  if (targetParticipant) {
    msgTarget = { id: 'Participant_B', type: 'bpmn:Participant', incoming: [], outgoing: [] };
  } else {
    msgTarget = {
      id: 'Start_B',
      type: 'bpmn:StartEvent',
      incoming: [],
      outgoing: [],
      businessObject: { $type: 'bpmn:StartEvent' }
    };
  }

  const m1 = { id: 'Message_1', type: 'bpmn:MessageFlow', source: task, target: msgTarget };
  task.outgoing.push(m1);
  msgTarget.incoming = [m1];

  return [startA, task, next, msgTarget, f0, fSeq, m1];
}

test('task sends message and continues along sequence flow', () => {
  const diagram = buildDiagram(false);
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // start -> task
  sim.step(); // task -> next + message to Start_B
  const tokens = Array.from(sim.tokenStream.get(), t => t.element && t.element.id).sort();
  assert.deepStrictEqual(tokens, ['Start_B', 'Task_B'].sort());
});

test('message flow targeting participant does not spawn token', () => {
  const diagram = buildDiagram(true);
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // start -> task
  sim.step(); // task -> next (message flow ignored)
  const tokens = Array.from(sim.tokenStream.get(), t => t.element && t.element.id);
  assert.deepStrictEqual(tokens, ['Task_B']);
});

