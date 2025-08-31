const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.style = {};
    this._text = '';
    this.parentNode = null;
    this.events = {};
  }
  set textContent(val) {
    this._text = String(val);
  }
  get textContent() {
    return this._text + this.children.map(c => c.textContent).join('');
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
  }
  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx >= 0) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }
  addEventListener(type, fn) {
    this.events[type] = fn;
  }
  contains(el) {
    if (this === el) return true;
    return this.children.some(child => child.contains && child.contains(el));
  }
  querySelectorAll(selector) {
    const results = [];
    const traverse = node => {
      node.children.forEach(child => {
        if (selector === 'input' && child.tagName === 'input') results.push(child);
        if (selector === 'label > span' && child.tagName === 'label') {
          child.children.forEach(grand => {
            if (grand.tagName === 'span') results.push(grand);
          });
        }
        traverse(child);
      });
    };
    traverse(this);
    return results;
  }
}

class Document {
  constructor() {
    this.body = new Element('body');
  }
  createElement(tag) {
    return new Element(tag);
  }
  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

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
  const gw = { id: 'gw', type: 'bpmn:ExclusiveGateway', businessObject: { gatewayDirection: 'Diverging' }, incoming: [], outgoing: [] };
  const a = { id: 'a', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const b = { id: 'b', type: 'bpmn:Task', incoming: [], outgoing: [] };

  const f0 = { id: 'f0', source: start, target: gw };
  start.outgoing = [f0];
  gw.incoming = [f0];

  const fa = { id: 'fa', source: gw, target: a, businessObject: { conditionExpression: { body: '${true}' } } };
  const fb = { id: 'fb', source: gw, target: b, businessObject: { conditionExpression: { body: '${true}' } } };
  gw.outgoing = [fa, fb];
  a.incoming = [fa];
  b.incoming = [fb];

  return [start, gw, a, b, f0, fa, fb];
}

function buildSingleViableDiagram() {
  const start = { id: 'start', type: 'bpmn:StartEvent', outgoing: [], incoming: [], businessObject: { $type: 'bpmn:StartEvent' } };
  const gw = { id: 'gw', type: 'bpmn:ExclusiveGateway', businessObject: { gatewayDirection: 'Diverging' }, incoming: [], outgoing: [] };
  const a = { id: 'a', type: 'bpmn:Task', incoming: [], outgoing: [] };
  const b = { id: 'b', type: 'bpmn:Task', incoming: [], outgoing: [] };

  const f0 = { id: 'f0', source: start, target: gw };
  start.outgoing = [f0];
  gw.incoming = [f0];

  const fa = { id: 'fa', source: gw, target: a, businessObject: { conditionExpression: { body: '${true}' } } };
  const fb = { id: 'fb', source: gw, target: b, businessObject: { conditionExpression: { body: '${false}' } } };
  gw.outgoing = [fa, fb];
  a.incoming = [fa];
  b.incoming = [fb];

  return [start, gw, a, b, f0, fa, fb];
}

test('exclusive gateway exposes flows and waits for explicit choice', () => {
  const diagram = buildDiagram();
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // start -> gateway
  sim.step(); // evaluate and pause
  const paths = sim.pathsStream.get();
  assert.ok(paths);
  assert.deepStrictEqual(paths.flows.map(f => f.id), ['fa', 'fb']);
  sim.step('fb'); // choose second flow
  const after = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(after, ['b']);
  assert.strictEqual(sim.pathsStream.get(), null);
});

test('exclusive gateway pauses even when only one flow is viable', () => {
  const diagram = buildSingleViableDiagram();
  const sim = createSimulationInstance(diagram, { delay: 0 });
  sim.reset();
  sim.step(); // start -> gateway
  sim.step(); // evaluate and pause
  const tokens = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(tokens, ['gw']);
  const paths = sim.pathsStream.get();
  assert.ok(paths);
  assert.deepStrictEqual(paths.flows.map(f => f.id), ['fa']);
  sim.step('fa');
  const after = Array.from(sim.tokenStream.get(), t => t.element.id);
  assert.deepStrictEqual(after, ['a']);
  assert.strictEqual(sim.pathsStream.get(), null);
});

function loadElements() {
  const document = new Document();
  const window = { document };
  const sandbox = {
    window,
    document,
    Node: Element,
    console,
    setTimeout,
    clearTimeout
  };
  const streamCode = fs.readFileSync(path.resolve(__dirname, '../../public/js/core/stream.js'), 'utf8');
  vm.runInNewContext(streamCode, sandbox);
  vm.runInNewContext('currentTheme = new Stream({ colors: {}, fonts: {} });', sandbox);
  const elementsCode = fs.readFileSync(path.resolve(__dirname, '../../public/js/components/elements.js'), 'utf8');
  vm.runInNewContext(elementsCode, sandbox);
  return { sandbox, document };
}

test('flow selection modal displays condition text', () => {
  const { sandbox, document } = loadElements();
  const flows = [
    {
      target: { id: 'a', businessObject: { name: 'Task A' } },
      businessObject: { conditionExpression: { body: '${x>5}' } }
    },
    {
      target: { id: 'b', businessObject: { name: 'Task B' } },
      businessObject: {}
    }
  ];
  sandbox.window.openFlowSelectionModal(flows);
  const labels = document.querySelectorAll('label > span');
  assert.ok(labels[0].textContent.includes('${x>5}'));
  assert.ok(labels[1].textContent.includes('default'));
});

