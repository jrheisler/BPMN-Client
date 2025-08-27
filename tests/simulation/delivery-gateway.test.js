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

function buildDeliveryCheckDiagram() {
  const start = { id: 'start', type: 'bpmn:StartEvent', outgoing: [], incoming: [], businessObject: { $type: 'bpmn:StartEvent' } };
  const gw = {
    id: 'Gateway_DeliveryCheck',
    type: 'bpmn:ExclusiveGateway',
    businessObject: { gatewayDirection: 'Diverging' },
    incoming: [],
    outgoing: []
  };
  const success = { id: 'Task_DeliverySuccess', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const dispute = { id: 'Task_Dispute', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const other = { id: 'Task_Investigate', type: 'bpmn:Task', incoming: [], outgoing: [] };

  const f0 = { id: 'f0', source: start, target: gw };
  start.outgoing = [f0];
  gw.incoming = [f0];

  const fSuccess = {
    id: 'fSuccess',
    source: gw,
    target: success,
    businessObject: { conditionExpression: { body: "${deliveryStatus === 'successful'}" } }
  };
  const fDispute = {
    id: 'fDispute',
    source: gw,
    target: dispute,
    businessObject: { conditionExpression: { body: "${deliveryStatus === 'disputed'}" } }
  };
  const fOther = {
    id: 'fOther',
    source: gw,
    target: other,
    businessObject: {
      conditionExpression: {
        body: "${deliveryStatus !== 'successful' && deliveryStatus !== 'disputed'}"
      }
    }
  };

  gw.outgoing = [fSuccess, fDispute, fOther];
  success.incoming = [fSuccess];
  dispute.incoming = [fDispute];
  other.incoming = [fOther];

  return [start, gw, success, dispute, other, f0, fSuccess, fDispute, fOther];
}

test('token proceeds beyond Gateway_DeliveryCheck when deliveryStatus matches', () => {
  const diagram = buildDeliveryCheckDiagram();
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.setContext({ deliveryStatus: 'successful' });
  sim.step(); // start -> gateway
  sim.step(); // gateway evaluates condition
  const after = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(after, ['Task_DeliverySuccess']);
});

test('token takes fallback branch when deliveryStatus is unset', () => {
  const diagram = buildDeliveryCheckDiagram();
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // start -> gateway
  sim.step(); // gateway evaluates and takes default
  const after = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(after, ['Task_Investigate']);
});

