'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync('src/web/app.js', 'utf8');
const html = readFileSync('src/web/index.html', 'utf8');
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.checked = false; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.classList = { toggle() {}, add() {} }; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; if (nodes[0]?.value) this.value = nodes[0].value; }
  focus() { this.focused = true; }
  reportValidity() { return !!this.value; }
  async fire(name) { return this.listeners[name]?.({ preventDefault() {} }); }
}
async function app(saved = null, blockedStorage = false) {
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
  const nav = ['course', 'prepare', 'review', 'portfolio'].map(view => Object.assign(new Element(), { dataset: { view } }));
  const steps = [0, 1, 2].map(step => Object.assign(new Element(), { dataset: { courseStep: String(step) } }));
  const requests = [];
  const writes = [];
  const windowListeners = {};
  const modules = [{ id: 'water', title: 'El agua en nuestra comunidad', text: 'Water source' }, { id: 'reading', title: 'Leemos para comprender', text: 'Reading source' }];
  elements.grade.value = '5.º de primaria'; elements.duration.value = '60'; elements.context.value = 'Aula multigrado';
  vm.runInNewContext(source, {
    document: { getElementById: id => elements[id], createElement: () => new Element(), querySelectorAll: selector => selector === '[data-course-step]' ? steps : nav },
    window: { addEventListener(name, listener) { windowListeners[name] = listener; } }, Intl, Date, JSON,
    localStorage: {
      getItem() { if (blockedStorage) throw Error('Denied'); return saved; },
      setItem(key, value) { if (blockedStorage) throw Error('Denied'); writes.push(JSON.parse(value)); }
    },
    fetch: async (path, options) => {
      requests.push({ path, options });
      let payload = path === '/config' ? { mode: 'bedrock', team: 'T054' } : path === '/modules' ? { modules } : { sessions: [] };
      if (path === '/sessions/generate') {
        const prep = JSON.parse(options.body);
        payload = { ...prep, id: 'lesson', title: 'Sample lesson', objective: 'Objective', assessment: 'Evidence', moduleTitle: 'Water', provenance: 'demo', opening: { text: 'Start', minutes: 10 }, development: { text: 'Work', minutes: 40 }, closing: { text: 'End', minutes: 10 } };
      }
      return { ok: true, json: async () => payload };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, requests, writes, nav, windowListeners };
}

test('new visitors see course onboarding; fixed source cards match supported backend modules', async () => {
  const { elements: e, requests } = await app();
  assert.equal(e.course.hidden, false);
  assert.equal(e.prepare.hidden, true);
  assert.equal(e['course-confirm'].disabled, true);
  assert.equal(e['course-module-list'].children.length, 2);
  const backend = readFileSync('src/app.py', 'utf8');
  for (const card of e['course-module-list'].children) {
    assert.ok(backend.includes(card.children[1].textContent));
    assert.ok(backend.includes(card.children[3].textContent));
  }
  assert.match(e.mode.textContent, /IA real/);
  assert.match(html, /segmentación de ejemplo, aún sin IA real/);
  assert.deepEqual(requests.map(request => request.path).sort(), ['/config', '/modules']);
});

test('custom syllabus is retained and cannot masquerade as an AI extraction', async () => {
  const { elements: e, requests, writes } = await app();
  e['course-name'].value = '<img src=x onerror=alert(1)> Historia';
  await e['course-name'].fire('input');
  await e['course-next'].fire('click');
  assert.equal(e['course-syllabus'].hidden, false);
  e.syllabus.value = 'Sílabo de historia, sin agua ni lectura.';
  await e.syllabus.fire('input');
  await e['course-preview'].fire('click');
  assert.equal(e['course-modules'].hidden, false);
  assert.match(e['syllabus-preview-note'].textContent, /no se extrajeron de tu texto/);
  await e['course-confirm'].fire('click');
  assert.equal(e.course.hidden, false);
  e['course-reviewed'].checked = true;
  await e['course-reviewed'].fire('change');
  assert.equal(e['course-confirm'].disabled, false);
  await e['course-confirm'].fire('click');
  assert.equal(e.prepare.hidden, false);
  assert.equal(e['prepared-course-name'].textContent, '<img src=x onerror=alert(1)> Historia');
  assert.equal(e.syllabus.value, 'Sílabo de historia, sin agua ni lectura.');
  assert.equal(writes.at(-1).course.confirmed, true);
  assert.equal(requests.length, 2, 'course creation/review must not call an API');
  e.syllabus.value += ' Draft change';
  await e.syllabus.fire('input');
  assert.equal(e['course-confirm'].disabled, true);
  assert.equal(e['course-context'].hidden, true);
});

test('course restoration preserves existing preparation and lesson drafts', async () => {
  const saved = { prep: { moduleId: 'reading', grade: '6.º', duration: 45, context: 'Existing context' }, current: null, drafts: { old: { localDirty: true } }, evidenceDrafts: { old: 'Reflection draft' } };
  const { elements: e, writes, nav } = await app(JSON.stringify(saved));
  assert.equal(e.prepare.hidden, false);
  assert.equal(e.module.value, 'reading');
  assert.equal(e.context.value, 'Existing context');
  assert.equal(writes[0].drafts.old.localDirty, true);
  assert.equal(writes[0].evidenceDrafts.old, 'Reflection draft');
  await nav[0].fire('click');
  assert.equal(e.course.hidden, false);
});

test('confirmation restores locally and blocked storage does not prevent continuation', async () => {
  const first = await app();
  first.elements['course-reviewed'].checked = true;
  await first.elements['course-reviewed'].fire('change');
  await first.elements['course-confirm'].fire('click');
  const restored = await app(JSON.stringify(first.writes.at(-1)));
  assert.equal(restored.elements.prepare.hidden, false);
  assert.equal(restored.elements['course-context'].hidden, false);
  const blocked = await app(null, true);
  blocked.elements['course-reviewed'].checked = true;
  await blocked.elements['course-reviewed'].fire('change');
  await blocked.elements['course-confirm'].fire('click');
  assert.equal(blocked.elements.prepare.hidden, false);
  assert.match(blocked.elements.status.textContent, /no permite conservar borradores/);
});

test('lesson generation still sends only the original preparation contract', async () => {
  const { elements: e, requests } = await app();
  await e['prepare-form'].fire('submit');
  const generation = requests.find(request => request.path === '/sessions/generate');
  assert.deepEqual(Object.keys(JSON.parse(generation.options.body)).sort(), ['context', 'duration', 'grade', 'moduleId']);
  assert.equal(JSON.parse(generation.options.body).moduleId, 'water');
  assert.equal(e.review.hidden, false);
  assert.equal(e['lesson-title'].value, 'Sample lesson');
  assert.ok(!source.includes('innerHTML'));
});


test('storage failure warns on unload for course edits, not untouched or persisted samples', async () => {
  function prevented(instance) {
    let blocked = false;
    instance.windowListeners.beforeunload({ preventDefault() { blocked = true; } });
    return blocked;
  }
  const untouched = await app(null, true);
  assert.equal(prevented(untouched), false);
  await untouched.elements['course-next'].fire('click');
  assert.equal(prevented(untouched), false, 'navigation alone must not mark the sample dirty');
  for (const field of ['course-name', 'syllabus']) {
    const blocked = await app(null, true);
    blocked.elements[field].value += ' Local edit';
    await blocked.elements[field].fire('input');
    assert.equal(blocked.writes.length, 0);
    assert.equal(prevented(blocked), true, `${field} must be protected without storage`);
    const persisted = await app();
    persisted.elements[field].value += ' Saved locally';
    await persisted.elements[field].fire('input');
    assert.equal(prevented(persisted), false, 'persisted course edits need no unload prompt');
  }
});
