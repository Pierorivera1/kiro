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
async function app(saved = null, blockedStorage = false, generationGate = null, mode = 'bedrock', courseGate = null) {
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
  const nav = ['course', 'prepare', 'review', 'portfolio'].map(view => Object.assign(new Element(), { dataset: { view } }));
  const steps = [0, 1, 2].map(step => Object.assign(new Element(), { dataset: { courseStep: String(step) } }));
  const requests = [];
  const writes = [];
  const windowListeners = {};
  let printCount = 0;
  const modules = [{ id: 'water', title: 'El agua en nuestra comunidad', text: 'Water source' }, { id: 'reading', title: 'Leemos para comprender', text: 'Reading source' }];
  elements['improve-phase'].value = 'development'; elements['improve-instruction'].value = 'Más práctico';
  elements.grade.value = '5.º de primaria'; elements.duration.value = '60'; elements.context.value = 'Aula multigrado';
  vm.runInNewContext(source, {
    document: { getElementById: id => elements[id], createElement: () => new Element(), querySelectorAll: selector => selector === '[data-course-step]' ? steps : nav },
    window: { print() { printCount++; }, addEventListener(name, listener) { windowListeners[name] = listener; } }, Intl, Date, JSON,
    localStorage: {
      getItem() { if (blockedStorage) throw Error('Denied'); return saved; },
      setItem(key, value) { if (blockedStorage) throw Error('Denied'); writes.push(JSON.parse(value)); }
    },
    fetch: async (path, options) => {
      requests.push({ path, options });
      let payload = path === '/config' ? { mode, team: 'T084' } : path === '/modules' ? { modules } : { sessions: [] };
      if (path === '/courses/generate') {
        const input = JSON.parse(options.body);
        if (courseGate) await courseGate;
        payload = { name: input.name, provenance: mode, modules: [{ id: 'history', title: 'Historia del barrio', objective: 'Comparar mapas históricos', text: input.syllabus }] };
      }
      if (path.endsWith('/rubric')) payload = { provenance: mode, rubric: [{ criterion: 'Explicación', beginning: 'Reconoce', developing: 'Compara', achieved: 'Justifica con evidencias' }] };
      if (path.endsWith('/improve')) payload = { provenance: mode, phase: 'development', text: 'Mejora concreta y participativa' };
      if (path.endsWith('/adapt')) {
        const input = JSON.parse(options.body);
        payload = { ...input.lesson, adaptation: input.instruction, development: { ...input.lesson.development, text: 'Actividad adaptada a los recursos' } };
      }
      if (path === '/sessions/generate') {
        if (generationGate) await generationGate;
        const prep = JSON.parse(options.body);
        payload = { ...prep, id: 'lesson', title: 'Sample lesson', objective: 'Objective', assessment: 'Evidence', moduleTitle: 'Water', provenance: mode, opening: { text: 'Start', minutes: 10 }, development: { text: 'Work', minutes: 40 }, closing: { text: 'End', minutes: 10 } };
      }
      if (path === '/sessions/lesson' && options.method === 'PUT') payload = { ...JSON.parse(options.body), status: 'saved', localDirty: false };
      return { ok: true, json: async () => payload };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, requests, writes, nav, windowListeners, printed: () => printCount };
}

test('new visitors can organize a real syllabus without automatic AI calls', async () => {
  const { elements: e, requests } = await app();
  assert.equal(e.course.hidden, false);
  assert.equal(e.prepare.hidden, true);
  assert.equal(e['course-confirm'].disabled, true);
  assert.equal(e['course-module-list'].children.length, 0);
  assert.match(e.mode.textContent, /IA real/);
  assert.match(e['course-demo-notice'].textContent, /Amazon Bedrock/);
  assert.deepEqual(requests.map(request => request.path).sort(), ['/config', '/modules']);
});

test('custom syllabus generates editable modules and passes its actual source into lesson generation', async () => {
  const { elements: e, requests, writes } = await app();
  e['course-name'].value = '<img src=x onerror=alert(1)> Historia';
  await e['course-name'].fire('input');
  await e['course-next'].fire('click');
  e.syllabus.value = 'Sílabo de historia: comparar mapas del barrio de 1950 y 2020.';
  await e.syllabus.fire('input');
  await e['course-preview'].fire('click');
  assert.equal(e['course-modules'].hidden, false);
  assert.match(e['syllabus-preview-note'].textContent, /a partir de tu sílabo/);
  const card = e['course-module-list'].children[0];
  card.children[2].value = 'Mapas editados por el docente';
  await card.children[2].fire('input');
  await e['course-confirm'].fire('click');
  assert.equal(e.prepare.hidden, false);
  assert.equal(e.module.value, 'history');
  assert.equal(e['module-title'].textContent, 'Mapas editados por el docente');
  assert.equal(e['prepared-course-name'].textContent, '<img src=x onerror=alert(1)> Historia');
  assert.equal(writes.at(-1).course.confirmed, true);
  await e['prepare-form'].fire('submit');
  const generation = JSON.parse(requests.find(request => request.path === '/sessions/generate').options.body);
  assert.equal(generation.customModule.text, e.syllabus.value);
  assert.equal(generation.customModule.title, 'Mapas editados por el docente');
  assert.equal(generation.courseName, '<img src=x onerror=alert(1)> Historia');
  e.syllabus.value += ' Otro módulo';
  await e.syllabus.fire('input');
  assert.equal(writes.at(-1).course.confirmed, false);
  assert.equal(writes.at(-1).course.modules.length, 0);
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

test('generated course restores locally and blocked storage still permits the workflow', async () => {
  const first = await app();
  await first.elements['course-preview'].fire('click');
  await first.elements['course-confirm'].fire('click');
  const restored = await app(JSON.stringify(first.writes.at(-1)));
  assert.equal(restored.elements.prepare.hidden, false);
  assert.equal(restored.elements['course-context'].hidden, false);
  assert.equal(restored.elements.module.value, 'history');
  const blocked = await app(null, true);
  await blocked.elements['course-preview'].fire('click');
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
  assert.match(e['generated-summary'].textContent, /Sample lesson.*Objective/);
  assert.equal(e['generation-progress'].hidden, true);
  assert.ok(!source.includes('innerHTML'));
});

test('result summary follows teacher edits', async () => {
  const { elements: e } = await app();
  await e['prepare-form'].fire('submit');
  e['lesson-title'].value = 'Título revisado';
  e.objective.value = 'Objetivo revisado';
  await e['lesson-form'].fire('input');
  assert.equal(e['generated-summary'].textContent, 'Sesión actual: Título revisado. Objetivo: Objetivo revisado');
});

test('slow generation displays progress near the action and a readable result', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { elements: e } = await app(null, false, gate);
  const pending = e['prepare-form'].fire('submit');
  assert.equal(e.generate.disabled, true);
  assert.equal(e['generation-progress'].hidden, false);
  assert.match(e['generation-progress'].textContent, /espera en esta página/);
  release();
  await pending;
  assert.equal(e['generation-progress'].hidden, true);
  assert.equal(e.review.hidden, false);
  assert.match(e['generated-summary'].textContent, /Sample lesson.*Objective/);
});

test('syllabus course reaches a generated and saved session in five actions', async () => {
  const { elements: e, requests } = await app();
  await e['course-next'].fire('click');
  await e['course-preview'].fire('click');
  await e['course-confirm'].fire('click');
  assert.equal(e.prepare.hidden, false);
  assert.equal(e.module.value, 'history');
  await e['prepare-form'].fire('submit');
  assert.equal(e.review.hidden, false);
  assert.match(e.provenance.textContent, /Amazon Bedrock/);
  await e['lesson-form'].fire('submit');
  assert.match(e.status.textContent, /Sesión guardada/);
  assert.equal(requests.filter(r => r.path === '/courses/generate').length, 1);
  assert.equal(requests.filter(r => r.path === '/sessions/generate').length, 1);
  assert.equal(requests.filter(r => r.path === '/sessions/lesson' && r.options.method === 'PUT').length, 1);
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

test('section improvement changes only selected text and uses the latest teacher edits', async () => {
  const { elements: e, requests } = await app();
  await e['prepare-form'].fire('submit');
  e.opening.value = 'Inicio escrito por la docente';
  e.development.value = 'Desarrollo editado antes de pedir ayuda';
  e['lesson-title'].value = 'Título que debe conservarse';
  await e['improve-section'].fire('click');
  const body = JSON.parse(requests.find(request => request.path.endsWith('/improve')).options.body);
  assert.equal(body.lesson.development.text, 'Desarrollo editado antes de pedir ayuda');
  assert.equal(body.phase, 'development');
  assert.equal(e.development.value, 'Mejora concreta y participativa');
  assert.equal(e.opening.value, 'Inicio escrito por la docente');
  assert.equal(e.closing.value, 'End');
  assert.equal(e['lesson-title'].value, 'Título que debe conservarse');
  assert.equal(e['development-minutes'].value, 40);
});

test('each classroom preset adapts the current lesson and retains planned phase times', async () => {
  for (const [button, phrase] of [['adapt-offline', 'sin internet'], ['adapt-multigrade', 'multigrado'], ['adapt-materials', 'pocos materiales']]) {
    const { elements: e, requests } = await app();
    await e['prepare-form'].fire('submit');
    e.objective.value = 'Objetivo escrito por la docente';
    await e[button].fire('click');
    const body = JSON.parse(requests.find(request => request.path.endsWith('/adapt')).options.body);
    assert.match(body.instruction, new RegExp(phrase, 'i'));
    assert.equal(body.lesson.objective, 'Objetivo escrito por la docente');
    assert.equal(e.objective.value, 'Objetivo escrito por la docente');
    assert.equal(e.development.value, 'Actividad adaptada a los recursos');
    assert.deepEqual(['opening', 'development', 'closing'].map(phase => e[phase + '-minutes'].value), [10, 40, 10]);
    assert.match(e['adaptation-note'].textContent, new RegExp(phrase, 'i'));
  }
});

test('rubric is editable, sent with save and restored with the lesson draft', async () => {
  const { elements: e, requests, writes } = await app();
  await e['prepare-form'].fire('submit');
  e.objective.value = 'Objetivo actual para evaluar';
  await e['generate-rubric'].fire('click');
  const request = requests.find(request => request.path.endsWith('/rubric'));
  assert.equal(JSON.parse(request.options.body).lesson.objective, 'Objetivo actual para evaluar');
  const row = e['rubric-editor'].children[0];
  row.children[8].value = 'Justifica comparando dos mapas';
  await row.children[8].fire('input');
  await e['lesson-form'].fire('submit');
  const saved = JSON.parse(requests.find(request => request.path === '/sessions/lesson' && request.options.method === 'PUT').options.body);
  assert.equal(saved.rubric[0].achieved, 'Justifica comparando dos mapas');
  const restored = await app(JSON.stringify(writes.at(-1)));
  await restored.nav[2].fire('click');
  assert.equal(restored.elements['rubric-editor'].children[0].children[8].value, 'Justifica comparando dos mapas');
});

test('print sheet contains complete current text and rubric, not clipped form controls', async () => {
  const instance = await app();
  const e = instance.elements;
  await e['prepare-form'].fire('submit');
  await e['generate-rubric'].fire('click');
  e['lesson-title'].value = 'Ficha revisada sin guardar';
  e.development.value = 'Actividad extensa de aula. '.repeat(100);
  await e['print-lesson'].fire('click');
  const allText = element => [element.textContent, ...element.children.map(allText)].join('\n');
  const text = allText(e['print-sheet']);
  assert.match(text, /Ficha revisada sin guardar/);
  assert.ok(text.includes(e.development.value));
  assert.match(text, /Rúbrica de evaluación/);
  assert.match(text, /Justifica con evidencias/);
  assert.equal(instance.printed(), 1);
  const css = readFileSync('src/web/style.css', 'utf8');
  assert.match(css, /@media print/);
  assert.match(css, /white-space:pre-wrap/);
});

test('demo disclosures apply to course and rubric as well as lessons', async () => {
  const { elements: e } = await app(null, false, null, 'demo');
  assert.match(e['course-demo-notice'].textContent, /no IA real/);
  await e['course-preview'].fire('click');
  assert.match(e['syllabus-preview-note'].textContent, /no IA real/);
  await e['prepare-form'].fire('submit');
  await e['generate-rubric'].fire('click');
  assert.match(e['rubric-note'].textContent, /no IA real/);
});

test('editing a confirmed course module keeps preparation bound to its current custom source', async () => {
  const { elements: e, requests, nav } = await app();
  await e['course-preview'].fire('click');
  await e['course-confirm'].fire('click');
  await nav[0].fire('click');
  const card = e['course-module-list'].children[0];
  card.children[2].value = 'Historia revisada';
  await card.children[2].fire('input');
  card.children[6].value = 'Nueva fuente: comparar fotografías anónimas del barrio.';
  await card.children[6].fire('input');
  await nav[1].fire('click');
  assert.equal(e.module.value, 'history');
  assert.equal(e['module-title'].textContent, 'Historia revisada');
  assert.equal(e['module-text'].textContent, 'Nueva fuente: comparar fotografías anónimas del barrio.');
  await e['prepare-form'].fire('submit');
  const body = JSON.parse(requests.find(request => request.path === '/sessions/generate').options.body);
  assert.equal(body.customModule.id, 'history');
  assert.equal(body.customModule.title, 'Historia revisada');
  assert.equal(body.customModule.text, e['module-text'].textContent);
});

test('an in-flight course result never installs old modules under a changed name or syllabus', async () => {
  for (const field of ['course-name', 'syllabus']) {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const { elements: e, writes } = await app(null, false, null, 'bedrock', gate);
    await e['course-next'].fire('click');
    const pending = e['course-preview'].fire('click');
    e[field].value = 'Nueva fuente o nombre escrito durante la espera';
    await e[field].fire('input');
    release();
    await pending;
    assert.equal(e['course-module-list'].children.length, 0);
    assert.equal(e['course-confirm'].disabled, true);
    assert.equal(e['course-syllabus'].hidden, false);
    assert.match(e.status.textContent, /Conservamos tu nuevo texto/);
    assert.equal(writes.at(-1).course[field === 'course-name' ? 'name' : 'syllabus'], e[field].value);
  }
});
