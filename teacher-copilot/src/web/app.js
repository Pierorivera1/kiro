'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'teacher-copilot-v1';
  const DEMO = 'Modo demostración: respuesta de ejemplo, no IA real';
  const SAMPLE_TITLE = 'Aprendizajes para nuestra comunidad';
  const SAMPLE_MODULES = [
    { id: 'water', title: 'El agua en nuestra comunidad', text: 'El agua se utiliza en el hogar, la escuela y las chacras. Observar cómo la usamos permite reconocer situaciones de desperdicio y proponer acciones para cuidarla. Comparar ideas y justificar acuerdos ayuda a construir una propuesta de acción colectiva.' },
    { id: 'reading', title: 'Leemos para comprender', text: 'Comprender un texto implica identificar una idea central, relacionarla con experiencias y explicar qué partes sustentan nuestra interpretación. Conversar sobre interpretaciones distintas ayuda a revisar las ideas. El docente ofrece preguntas y oportunidades de releer.' }
  ];
  const SAMPLE_SYLLABUS = SAMPLE_TITLE + '\nSílabo ficticio · muestra del prototipo\n\n' + SAMPLE_MODULES.map((module, index) => `Unidad ${index + 1}. ${module.title}\n${module.text}`).join('\n\n');
  const phases = ['opening', 'development', 'closing'];
  let state = { prep: null, drafts: {}, current: null, evidenceDrafts: {}, activePortfolio: null };
  let modules = [];
  let sessions = [];
  let currentView = 'course';
  let storageAvailable = true;
  let courseDirty = false;
  let evidenceRequest = 0;
  let portfolioRequest = 0;
  let generateLabel = 'Generar propuesta →';

  function notice(message = '') { $('status').textContent = message; }
  function clearError() { $('error').hidden = true; $('retry').hidden = true; }
  function fail(error, retry = false) {
    $('error-text').textContent = error.message || 'No se pudo completar la operación. Vuelve a intentarlo.';
    $('retry').hidden = !retry;
    $('error').hidden = false;
    notice('');
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); courseDirty = false; }
    catch (_) {
      storageAvailable = false;
      notice('Este navegador no permite conservar borradores. No cierres esta pestaña sin guardar la sesión.');
    }
  }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object' && saved.drafts && saved.evidenceDrafts) state = saved;
    } catch (_) { notice('No se pudo recuperar el borrador local. Puedes abrir tus sesiones guardadas en el portafolio.'); }
  }
  async function api(path, method = 'GET', data) {
    let result;
    try {
      result = await fetch(path, { method, headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    } catch (_) { throw new Error('No hay conexión con el servidor. Tus cambios permanecen en esta pestaña; inténtalo de nuevo.'); }
    let payload;
    try { payload = await result.json(); }
    catch (_) { throw new Error('El servidor no devolvió una respuesta válida. Inténtalo de nuevo.'); }
    if (!result.ok) throw new Error(payload.error || 'No se pudo completar la operación. Vuelve a intentarlo.');
    return payload;
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function action(text, handler, className) {
    const button = node('button', text, className);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }
  function busy(button, active, label) {
    button.disabled = active;
    button.textContent = label;
    button.setAttribute('aria-busy', String(active));
  }
  function courseStep(step, focus = true) {
    state.course.step = step;
    ['course-details', 'course-syllabus', 'course-modules'].forEach((id, index) => { $(id).hidden = index !== step; });
    document.querySelectorAll('[data-course-step]').forEach(item => {
      if (Number(item.dataset.courseStep) === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    persist();
    if (focus) $(['course-details-heading', 'course-syllabus-heading', 'course-modules-heading'][step]).focus();
  }
  function showCourseContext() {
    $('course-context').hidden = !state.course.confirmed;
    $('prepared-course-name').textContent = state.course.confirmed ? state.course.name : '';
  }
  function showCoursePreview() {
    const custom = state.course.syllabus !== SAMPLE_SYLLABUS;
    $('syllabus-preview-note').textContent = custom
      ? 'Tu texto se conserva como borrador. Estos módulos pertenecen al sílabo de ejemplo, no se extrajeron de tu texto. Al continuar prepararás con esta muestra fija.'
      : 'Esta es una segmentación predefinida del sílabo ficticio de ejemplo. No se ha ejecutado IA ni se ha creado un curso en el servidor.';
    $('course-confirm').disabled = !state.course.name.trim();
  }
  function captureCourse() {
    courseDirty = courseDirty || state.course.name !== $('course-name').value || state.course.syllabus !== $('syllabus').value;
    state.course.name = $('course-name').value;
    state.course.syllabus = $('syllabus').value;
    state.course.reviewed = false;
    state.course.confirmed = false;
    showCoursePreview();
    showCourseContext();
    persist();
  }
  function initializeCourse() {
    const saved = state.course;
    state.course = {
      name: typeof saved?.name === 'string' ? saved.name.slice(0, 160) : SAMPLE_TITLE,
      syllabus: typeof saved?.syllabus === 'string' ? saved.syllabus.slice(0, 12000) : SAMPLE_SYLLABUS,
      step: [0, 1, 2].includes(saved?.step) ? saved.step : 0,
      reviewed: saved?.reviewed === true,
      confirmed: saved?.confirmed === true && saved?.reviewed === true && typeof saved?.name === 'string' && !!saved.name.trim()
    };
    $('course-name').value = state.course.name;
    $('syllabus').value = state.course.syllabus;
    $('sample-syllabus-text').textContent = SAMPLE_SYLLABUS;
    for (const [index, module] of SAMPLE_MODULES.entries()) {
      const card = node('article', undefined, 'card');
      card.append(node('span', `Módulo ${index + 1} · muestra fija`, 'tag pale'), node('h3', module.title), node('p', 'FRAGMENTO DEL SÍLABO DE EJEMPLO', 'eyebrow'), node('blockquote', module.text));
      $('course-module-list').append(card);
    }
    showCoursePreview();
    showCourseContext();
    courseStep(state.course.step, false);
  }
  function readPrep() {
    return { moduleId: $('module').value, grade: $('grade').value, duration: Number($('duration').value), context: $('context').value };
  }
  function capturePrep() { state.prep = readPrep(); persist(); }
  function showModule() {
    const module = modules.find(item => item.id === $('module').value);
    $('module-title').textContent = module ? module.title : 'Selecciona un módulo';
    $('module-text').textContent = module ? module.text : '';
  }
  function captureLesson() {
    const lesson = state.drafts[state.current];
    if (!lesson) return;
    lesson.title = $('lesson-title').value;
    lesson.objective = $('objective').value;
    lesson.assessment = $('assessment').value;
    for (const phase of phases) lesson[phase] = { text: $(phase).value, minutes: Number($(phase + '-minutes').value) };
    lesson.localDirty = true;
    persist();
    showTotal(lesson);
    $('lesson-state').textContent = 'Cambios sin guardar';
  }
  function showTotal(lesson) {
    const total = phases.reduce((sum, phase) => sum + lesson[phase].minutes, 0);
    $('time-total').textContent = `Tiempo planificado: ${total} de ${lesson.duration} minutos. ${total === lesson.duration ? 'Los tiempos coinciden.' : 'Ajusta los tiempos antes de guardar.'}`;
    $('time-total').classList.toggle('warning', total !== lesson.duration);
  }
  function showLesson() {
    const lesson = state.drafts[state.current];
    $('review-empty').hidden = !!lesson;
    $('lesson-form').hidden = !lesson;
    if (!lesson) return;
    $('lesson-title').value = lesson.title;
    $('objective').value = lesson.objective;
    $('assessment').value = lesson.assessment;
    for (const phase of phases) {
      $(phase).value = lesson[phase].text;
      $(phase + '-minutes').value = lesson[phase].minutes;
    }
    $('lesson-meta').textContent = `${lesson.grade} · ${lesson.duration} minutos · ${lesson.moduleTitle}`;
    $('lesson-state').textContent = lesson.localDirty ? 'Cambios sin guardar' : lesson.status === 'saved' ? 'Sesión guardada' : 'Borrador guardado';
    $('provenance').textContent = (lesson.provenance === 'demo' ? DEMO : 'Propuesta creada con IA de Amazon Bedrock') + '. Revisa la pertinencia, los datos y el lenguaje antes de usarla.';
    showTotal(lesson);
  }
  function go(view, focus = true) {
    currentView = view;
    for (const name of ['course', 'prepare', 'review', 'portfolio']) $(name).hidden = name !== view;
    document.querySelectorAll('[data-view]').forEach(button => {
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    clearError();
    if (view === 'review') showLesson();
    if (view === 'portfolio') loadPortfolio();
    if (focus) $(view + '-title').focus();
  }
  function date(timestamp) {
    return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(timestamp * 1000));
  }
  function renderSessions() {
    const container = $('sessions-list');
    container.replaceChildren();
    if (!sessions.length) {
      const empty = node('div', undefined, 'card empty');
      empty.append(node('span', '↗', 'empty-icon'), node('h3', 'Un portafolio que crece contigo'), node('p', 'Aún no tienes sesiones. Genera una propuesta, revísala y guarda una reflexión después de llevarla al aula.'), action('Preparar mi primera clase →', () => go('prepare'), 'primary'));
      container.append(empty);
      return;
    }
    for (const lesson of sessions) {
      const card = node('article', undefined, 'session-record');
      if (lesson.id === state.activePortfolio) card.classList.add('selected');
      const content = node('div');
      content.append(node('span', lesson.status === 'saved' ? 'Sesión guardada' : 'Borrador por revisar', 'tag'), node('h3', lesson.title), node('p', `${lesson.grade} · ${lesson.duration} min · ${date(lesson.createdAt)} · ${lesson.provenance === 'demo' ? 'Ejemplo, no IA' : 'Propuesta con IA'}`));
      if (state.drafts[lesson.id]?.localDirty) content.append(node('p', 'Hay cambios locales sin guardar. Se conservarán al abrir.'));
      const actions = node('div', undefined, 'record-actions');
      actions.append(action('Editar sesión', () => {
        if (!state.drafts[lesson.id]?.localDirty) state.drafts[lesson.id] = structuredCopy(lesson);
        state.current = lesson.id;
        persist();
        go('review');
      }), action('Añadir evidencia', () => selectEvidence(lesson), ''));
      card.append(content, actions);
      container.append(card);
    }
  }
  function structuredCopy(value) { return JSON.parse(JSON.stringify(value)); }
  async function loadPortfolio() {
    const request = ++portfolioRequest;
    $('portfolio-loading').hidden = false;
    $('refresh').disabled = true;
    try {
      const result = await api('/sessions');
      if (request !== portfolioRequest) return;
      sessions = result.sessions;
      renderSessions();
      const selected = sessions.find(lesson => lesson.id === state.activePortfolio);
      if (selected) selectEvidence(selected, false);
      else $('evidence-panel').hidden = true;
    } catch (error) { if (currentView === 'portfolio') fail(error); }
    finally { if (request === portfolioRequest) { $('portfolio-loading').hidden = true; $('refresh').disabled = false; } }
  }
  async function selectEvidence(lesson, focus = true) {
    const request = ++evidenceRequest;
    state.activePortfolio = lesson.id;
    persist();
    renderSessions();
    $('evidence-panel').hidden = false;
    $('evidence-session').textContent = lesson.title;
    $('evidence-text').value = state.evidenceDrafts[lesson.id] || '';
    $('evidence-list').replaceChildren(node('p', 'Cargando evidencias…', 'help'));
    if (focus) $('evidence-text').focus();
    try {
      const result = await api(`/sessions/${lesson.id}/evidence`);
      if (request !== evidenceRequest || state.activePortfolio !== lesson.id) return;
      renderEvidence(result.evidence);
    } catch (error) {
      if (request === evidenceRequest) {
        $('evidence-list').replaceChildren(action('Reintentar carga de evidencias', () => selectEvidence(lesson, false)));
        fail(error);
      }
    }
  }
  function renderEvidence(records) {
    const container = $('evidence-list');
    container.replaceChildren();
    if (!records.length) container.append(node('p', 'Todavía no hay evidencias para esta sesión. Tu primera reflexión aparecerá aquí.', 'help'));
    for (const record of records) {
      const article = node('article', undefined, 'evidence-record');
      const timestamp = node('time', date(record.createdAt));
      timestamp.dateTime = new Date(record.createdAt * 1000).toISOString();
      article.append(timestamp, node('p', record.text));
      container.append(article);
    }
  }
  async function boot() {
    clearError();
    busy($('generate'), true, 'Cargando…');
    try {
      const [config, result] = await Promise.all([api('/config'), api('/modules')]);
      modules = result.modules;
      $('mode').textContent = config.mode === 'demo' ? DEMO : 'IA real: Amazon Bedrock · revisa siempre la propuesta';
      generateLabel = config.mode === 'demo' ? 'Generar propuesta de ejemplo →' : 'Generar sesión con IA →';
      $('team').textContent = config.team;
      $('module').replaceChildren(...modules.map(module => { const option = node('option', module.title); option.value = module.id; return option; }));
      $('module').disabled = false;
      if (state.prep) {
        $('module').value = modules.some(module => module.id === state.prep.moduleId) ? state.prep.moduleId : modules[0].id;
        $('grade').value = state.prep.grade;
        $('duration').value = state.prep.duration;
        $('context').value = state.prep.context;
      }
      showModule();
      showLesson();
      busy($('generate'), false, generateLabel);
    } catch (error) {
      $('mode').textContent = 'Modo no disponible: no se pudo conectar con el servidor.';
      fail(error, true);
      $('generate').textContent = 'Servicio no disponible';
    }
  }
  document.querySelectorAll('[data-view], [data-go]').forEach(button => button.addEventListener('click', () => go(button.dataset.view || button.dataset.go)));
  $('course-name').addEventListener('input', captureCourse);
  $('syllabus').addEventListener('input', captureCourse);
  $('course-next').addEventListener('click', () => {
    if (!$('course-name').reportValidity() || !$('course-name').value.trim()) { $('course-name').focus(); return; }
    courseStep(1);
  });
  $('course-back-details').addEventListener('click', () => courseStep(0));
  $('course-back-syllabus').addEventListener('click', () => courseStep(1));
  $('course-preview').addEventListener('click', () => { showCoursePreview(); courseStep(2); });
  $('course-confirm').addEventListener('click', () => {
    if (!state.course.name.trim()) return;
    state.course.reviewed = true;
    state.course.confirmed = true;
    persist();
    showCourseContext();
    go('prepare');
    if (storageAvailable) notice('Módulos de ejemplo confirmados. El curso permanece solo en este navegador.');
  });
  $('retry').addEventListener('click', boot);
  $('refresh').addEventListener('click', loadPortfolio);
  $('prepare-form').addEventListener('input', capturePrep);
  $('module').addEventListener('change', () => { showModule(); capturePrep(); });
  $('lesson-form').addEventListener('input', captureLesson);
  $('evidence-text').addEventListener('input', () => {
    if (state.activePortfolio) { state.evidenceDrafts[state.activePortfolio] = $('evidence-text').value; persist(); }
  });
  $('prepare-form').addEventListener('submit', async event => {
    event.preventDefault();
    clearError();
    capturePrep();
    busy($('generate'), true, 'Generando sesión…');
    notice(storageAvailable
      ? 'Generando tu sesión; esto puede tardar unos segundos. Conservamos el contexto en este navegador.'
      : 'Generando tu sesión; esto puede tardar unos segundos. El contexto permanece en esta pestaña.');
    try {
      const lesson = await api('/sessions/generate', 'POST', state.prep);
      state.drafts[lesson.id] = lesson;
      state.current = lesson.id;
      persist();
      go('review');
      notice('Propuesta lista y borrador guardado. Revísala antes de usarla.');
    } catch (error) { fail(error); }
    finally { busy($('generate'), false, generateLabel); }
  });
  $('lesson-form').addEventListener('submit', async event => {
    event.preventDefault();
    clearError();
    captureLesson();
    const draft = state.drafts[state.current];
    if (phases.reduce((sum, phase) => sum + draft[phase].minutes, 0) !== draft.duration) {
      fail(new Error(`La suma de inicio, desarrollo y cierre debe ser ${draft.duration} minutos.`));
      $('opening-minutes').focus();
      return;
    }
    const identifier = state.current;
    const snapshot = JSON.stringify(draft);
    busy($('save-lesson'), true, 'Guardando…');
    try {
      const saved = await api(`/sessions/${identifier}`, 'PUT', draft);
      // Preserve edits made while the save request was in flight.
      if (JSON.stringify(state.drafts[identifier]) === snapshot) state.drafts[identifier] = saved;
      else state.drafts[identifier].status = 'saved';
      persist();
      if (state.current === identifier) showLesson();
      notice(state.drafts[identifier].localDirty ? 'Se guardó la versión enviada. Hay cambios posteriores pendientes de guardar.' : 'Sesión guardada. Cuando la lleves al aula, añade una evidencia en el portafolio.');
    } catch (error) { fail(error); }
    finally { busy($('save-lesson'), false, 'Guardar sesión ✓'); }
  });
  $('evidence-form').addEventListener('submit', async event => {
    event.preventDefault();
    clearError();
    const identifier = state.activePortfolio;
    const text = $('evidence-text').value;
    busy($('save-evidence'), true, 'Guardando…');
    try {
      await api(`/sessions/${identifier}/evidence`, 'POST', { text });
      if (state.evidenceDrafts[identifier] === text) delete state.evidenceDrafts[identifier];
      persist();
      if (state.activePortfolio === identifier) {
        $('evidence-text').value = state.evidenceDrafts[identifier] || '';
        const selected = sessions.find(lesson => lesson.id === identifier);
        if (selected) await selectEvidence(selected, false);
      }
      notice('Evidencia guardada y vinculada a tu sesión.');
    } catch (error) { fail(error); }
    finally { busy($('save-evidence'), false, 'Guardar evidencia'); }
  });
  window.addEventListener('beforeunload', event => {
    const dirty = courseDirty || Object.values(state.drafts).some(lesson => lesson.localDirty) || Object.values(state.evidenceDrafts).some(Boolean);
    if (!storageAvailable && dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  restore();
  const returning = !!(state.prep || state.current || state.course?.confirmed);
  initializeCourse();
  go(returning ? 'prepare' : 'course', false);
  boot();
})();
