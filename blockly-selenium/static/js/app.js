import { Editor } from './editor.js';
import { sound } from './sound.js';
import { confetti } from './confetti.js';

const $ = sel => document.querySelector(sel);
const STORE = 'blockbots.workspace';
// Slider position -> pause between steps (seconds).
const SPEEDS = [[1.5, '🐢'], [0.8, '🐌'], [0.4, '🐇'], [0.15, '🐆'], [0, '🚀']];

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

// Served by server.py, everything is same-origin. On the becomeaiengg.com project
// page the editor is opened with ?runner=/blockly-runner (the hosted runner behind
// nginx); only the run socket goes there and tests are kept in this browser.
const RUNNER = new URLSearchParams(location.search).get('runner') || '';
// "hosted": a shared server runs the tests (the becomeaiengg.com page, or a runner started with
// BLOCKBOTS_SERVER=1 serving this page itself). Then tests stay in this browser and files download.
let hosted = !!RUNNER;
const runnerOrigin = new URL(RUNNER || '/', location.href).href.replace(/\/$/, '');
const socketURL = path => runnerOrigin.replace(/^http/, 'ws') + path;

const editor = new Editor({
  rail: $('#rail'),
  flyout: $('#flyout'),
  search: $('#search'),
  canvas: $('#canvas'),
  world: $('#world'),
  sizer: $('#sizer'),
  trash: $('#trash'),
  menu: $('#menu'),
  onChange: autosave,
  onVariables: () => renderWatch(),
});

let ws = null;
let running = false;
let notes = 0;

function autosave() {
  store.set(STORE, JSON.stringify({ name: $('#name').value, scripts: editor.scripts, variables: editor.variables }));
}

// ---------- robot + diary ----------

const MOUTHS = {
  happy: 'M46 66 Q60 82 74 66',
  sad: 'M46 76 Q60 64 74 76',
  thinking: 'M50 71 L70 71',
  idle: 'M48 68 Q60 76 72 68',
};

function say(text, mood = 'idle') {
  const bubble = $('#bubble');
  bubble.textContent = text;
  bubble.classList.remove('pulse');
  void bubble.offsetWidth;
  bubble.classList.add('pulse');
  const robot = $('#robot');
  robot.dataset.mood = mood;
  robot.querySelector('.mouth').setAttribute('d', MOUTHS[mood] || MOUTHS.idle);
}

function log(icon, text, cls = '') {
  const li = document.createElement('li');
  li.className = cls;
  li.innerHTML = `<span class="ico"></span><span class="txt"></span>`;
  li.querySelector('.ico').textContent = icon;
  li.querySelector('.txt').textContent = text;
  $('#log').append(li);
  li.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return li;
}

function logShot({ name, url, src, file }) {
  const li = log('📸', `Picture: ${name}`, 'shot');
  const a = document.createElement('a');
  a.href = src || runnerOrigin + url;
  a.download = file || '';
  a.title = 'Click to save the picture';
  a.innerHTML = `<img alt="">`;
  a.querySelector('img').src = a.href;
  li.querySelector('.txt').append(a);
}

// The hosted runner's browser is hidden; it sends a picture after every step.
function showFrame({ src, url, title }) {
  $('#live').hidden = false;
  $('#live-img').src = src;
  $('#live-img').hidden = false;
  $('#live-empty').hidden = true;
  $('#live-url').textContent = url || '';
  $('#live-url').title = title || '';
}

function logDownload({ name, mime, data }) {
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
  a.download = name;
  a.click();
  const li = log('💾', 'Downloaded ', 'shot');
  const again = el('a', null, name);
  again.href = a.href;
  again.download = name;
  li.querySelector('.txt').append(again);
}

// ---------- scraped data ----------

const scraped = new Map(); // name -> value, for the current run

function download(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function toCSV(name, value) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = value?.columns
    ? [value.columns, ...value.rows]
    : [[name], ...(Array.isArray(value) ? value : [value]).map(v => [v])];
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n'); // BOM so Excel keeps emoji
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function preview(kind, value) {
  if (kind === 'table') {
    const wrap = el('div', 'scr-table');
    const table = el('table');
    const head = el('tr');
    value.columns.forEach(c => head.append(el('th', null, c)));
    table.append(head);
    for (const row of value.rows.slice(0, 8)) {
      const tr = el('tr');
      row.forEach(c => tr.append(el('td', null, c)));
      table.append(tr);
    }
    wrap.append(table);
    if (value.rows.length > 8) wrap.append(el('div', 'scr-more', `…and ${value.rows.length - 8} more rows`));
    return wrap;
  }
  if (kind === 'list') {
    const ol = el('ol', 'scr-list');
    value.slice(0, 10).forEach(v => ol.append(el('li', null, v)));
    if (value.length > 10) ol.append(el('li', 'scr-more', `…and ${value.length - 10} more`));
    return ol;
  }
  const div = el('div', 'scr-text', String(value));
  div.title = String(value);
  return div;
}

// ---------- 📦 Variables box (live values while a test runs) ----------

const watched = new Map(); // name -> value from the current run

function shortValue(value) {
  if (value?.columns) return `table · ${value.rows.length} rows`;
  if (Array.isArray(value)) return `list · ${value.length}: ${value.slice(0, 3).join(', ')}${value.length > 3 ? '…' : ''}`;
  return String(value);
}

function renderWatch() {
  const names = [...new Set([...editor.variables, ...watched.keys()])];
  $('#watch').hidden = !names.length;
  $('#watch-list').replaceChildren(...names.map(name => {
    const row = el('div', 'watch-row');
    const has = watched.has(name);
    const value = el('span', 'watch-value' + (has ? '' : ' empty'), has ? shortValue(watched.get(name)) : 'not set yet');
    value.title = has ? JSON.stringify(watched.get(name)) : '';
    row.append(el('span', 'watch-name', name), value);
    return row;
  }));
}

function updateWatch({ name, value }) {
  watched.set(name, value);
  renderWatch();
  const row = [...$('#watch-list').children].find(r => r.firstChild.textContent === name);
  row?.classList.remove('flash');
  void row?.offsetWidth;
  row?.classList.add('flash');
}

function askUser({ question }) {
  sound.hover();
  say(`❓ ${question}`, 'thinking');
  const answer = prompt(question) ?? '';
  ws?.send(JSON.stringify({ action: 'answer', text: answer }));
}

function logScraped({ name, kind, value }) {
  scraped.set(name, value);
  const li = log('🕸️', '', 'scraped');
  const head = el('div', 'scr-head');
  const btn = el('button', null, '⬇ CSV');
  btn.title = 'Download as a spreadsheet';
  btn.onclick = () => { sound.click(); download(`${name}.csv`, toCSV(name, value), 'text/csv'); };
  const size = kind === 'table' ? `${value.rows.length} rows` : kind === 'list' ? `${value.length} items` : 'text';
  head.append(el('b', null, `{${name}}`), el('span', 'scr-kind', size), btn);
  li.querySelector('.txt').append(head, preview(kind, value));
}

function logFile({ name, url, path }) {
  const li = log('💾', 'Saved ', 'shot');
  if (!url) {  // saved into a folder of your choice: show where
    li.querySelector('.txt').append(el('code', null, path));
    return;
  }
  const a = el('a', null, name);
  a.href = runnerOrigin + url;
  a.target = '_blank';
  a.title = path;
  li.querySelector('.txt').append(a);
}

function logScrapedSummary() {
  if (!scraped.size) return;
  const li = log('📦', `You scraped ${scraped.size} thing${scraped.size > 1 ? 's' : ''}. `, 'info');
  const btn = el('button', 'inline-btn', '⬇ Download all (JSON)');
  btn.onclick = () => {
    sound.click();
    download(`${$('#name').value.trim() || 'scraped'}.json`, JSON.stringify(Object.fromEntries(scraped), null, 2), 'application/json');
  };
  li.querySelector('.txt').append(btn);
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- running ----------

function run() {
  if (running) return;
  const scripts = editor.scripts.filter(s => s.blocks[0]?.type === 'start').map(s => s.blocks);
  if (!scripts.length) {
    sound.oops();
    say('Snap your blocks under a 🚀 "when Run is clicked" block first!', 'sad');
    $('#rail .cat').classList.add('nudge');
    setTimeout(() => $('#rail .cat').classList.remove('nudge'), 1600);
    return;
  }
  running = true;
  notes = 0;
  scraped.clear();
  watched.clear();
  renderWatch();
  // Locally the robot's browser is a real window; the little one is only for the website or hidden mode.
  $('#live').hidden = !hosted;
  $('#live-url').textContent = '⏳ starting Chrome...';
  editor.clearStatus();
  editor.lock(true);
  document.body.classList.add('running');
  $('#log').replaceChildren();
  log('🏁', 'Starting the test...', 'info');
  say('Here we go! Watch me work 👀', 'thinking');
  sound.start();

  let opened = false;
  ws = new WebSocket(socketURL('/ws/run'));
  ws.onopen = () => {
    opened = true;
    ws.send(JSON.stringify({
      action: 'run',
      scripts,
      delay: SPEEDS[$('#speed').value][0],
      keepOpen: $('#keep-open').checked,
    }));
  };
  ws.onmessage = e => handle(JSON.parse(e.data));
  ws.onclose = () => {
    if (!running) return;
    if (!opened && hosted) $('#runner').hidden = false;
    finish({
      ok: false,
      text: opened
        ? 'I lost touch with the runner. Is it still running?'
        : hosted
          ? "The test robot on the server isn't answering right now. Please try again in a minute."
          : `I can't reach the runner at ${runnerOrigin}. Is "python server.py" still running?`,
    });
  };
}

function stop() {
  if (!running || !ws) return;
  ws.send(JSON.stringify({ action: 'stop' }));
  say('Stopping...', 'thinking');
}

function handle(ev) {
  switch (ev.event) {
    case 'log':
      log('💡', ev.text, 'info');
      break;
    case 'step':
      editor.setStatus(ev.id, ev.status, ev.text);
      if (ev.status === 'pass') {
        sound.step(notes++);
        log(ev.text?.startsWith('💬') ? '🤖' : '✅', ev.text?.replace(/^💬 /, '') || 'Done');
        if (ev.text?.startsWith('💬')) say(ev.text.replace(/^💬 /, ''), 'happy');
      } else if (ev.status === 'fail' && ev.text) {
        log('❌', ev.text, 'fail');
      }
      break;
    case 'screenshot':
      logShot(ev);
      break;
    case 'scraped':
      logScraped(ev);
      break;
    case 'file':
      logFile(ev);
      break;
    case 'download':
      logDownload(ev);
      break;
    case 'var':
      updateWatch(ev);
      break;
    case 'ask':
      askUser(ev);
      break;
    case 'frame':
      showFrame(ev);
      break;
    case 'done':
      finish(ev);
      break;
  }
}

function finish({ ok, stopped, text }) {
  running = false;
  editor.lock(false);
  document.body.classList.remove('running');
  try { ws?.close(); } catch {}
  logScrapedSummary();
  if (ok) {
    sound.win();
    confetti();
    log('🏆', text, 'win');
    say(`Woohoo! ${text} 🎉`, 'happy');
  } else if (stopped) {
    sound.click();
    log('⏹️', 'Stopped.', 'info');
    say('Okay, I stopped. Press Run to try again!', 'idle');
  } else {
    sound.fail();
    log('😵', 'The test failed.', 'fail');
    say(`Oops! ${text}`, 'sad');
  }
}

// ---------- saving & loading ----------

function loadTest(test) {
  editor.snapshot();
  editor.load(test.scripts, test.variables);
  $('#name').value = test.name || 'My Test';
  editor.clearStatus();
  autosave();
}

async function save() {
  const name = $('#name').value.trim() || 'My Test';
  const res = await fetch(`/api/tests/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scripts: editor.scripts, variables: editor.variables }),
  });
  if (res.ok) {
    sound.snap();
    toast(`Saved "${(await res.json()).saved}" 💾`);
  } else {
    sound.oops();
    toast('Could not save 😕');
  }
}

async function openDialog() {
  const list = $('#test-list');
  list.replaceChildren();
  $('#dialog-title').textContent = '📂 Open a test';
  const names = await fetch('/api/tests').then(r => r.json()).catch(() => []);
  if (!names.length) list.innerHTML = '<li class="empty">No saved tests yet. Press 💾 Save to keep one!</li>';
  for (const name of names) {
    const li = document.createElement('li');
    const open = document.createElement('button');
    open.className = 'open-test';
    open.textContent = `🧩 ${name}`;
    open.onclick = async () => {
      const test = await fetch(`/api/tests/${encodeURIComponent(name)}`).then(r => r.json());
      loadTest(test);
      sound.snap();
      $('#dialog').close();
      say(`Loaded "${name}". Press ▶ Run!`, 'happy');
    };
    const del = document.createElement('button');
    del.className = 'del-test';
    del.title = 'Delete';
    del.textContent = '🗑️';
    del.onclick = async () => {
      if (!confirm(`Delete "${name}" forever?`)) return;
      await fetch(`/api/tests/${encodeURIComponent(name)}`, { method: 'DELETE' });
      sound.trash();
      li.remove();
    };
    li.append(open, del);
    list.append(li);
  }
  $('#dialog').showModal();
}

function exportTest() {
  const name = $('#name').value.trim() || 'my-test';
  download(`${name}.json`, JSON.stringify({ name, scripts: editor.scripts, variables: editor.variables }, null, 2), 'application/json');
}

async function examplesDialog() {
  const examples = await fetch('examples/index.json').then(r => r.json()).catch(() => []);
  const list = $('#test-list');
  list.replaceChildren();
  $('#dialog-title').textContent = '🧪 Example tests';
  for (const ex of examples) {
    const li = document.createElement('li');
    const btn = el('button', 'open-test');
    btn.append(el('span', null, `${ex.icon} ${ex.name}`), el('small', null, ex.about));
    btn.onclick = async () => {
      loadTest(await fetch(`examples/${ex.file}`).then(r => r.json()));
      sound.snap();
      $('#dialog').close();
      say(`Loaded "${ex.name}". Press ▶ Run!`, 'happy');
    };
    li.append(btn);
    list.append(li);
  }
  $('#dialog').showModal();
}

function importTest(file) {
  file.text().then(t => {
    loadTest(JSON.parse(t));
    sound.snap();
    toast('Imported! 📥');
  }).catch(() => { sound.oops(); toast('That file is not a Block Bots test 😕'); });
}

// ---------- wiring ----------

$('#run').onclick = run;
$('#stop').onclick = stop;
$('#save').onclick = save;
$('#open').onclick = () => { sound.click(); openDialog(); };
$('#examples').onclick = () => { sound.click(); examplesDialog(); };
$('#new').onclick = () => { sound.click(); editor.clear(); $('#name').value = 'My Test'; autosave(); say('A fresh start! Drag blocks from the left ✨'); };
$('#export').onclick = exportTest;
$('#import').onclick = () => $('#import-file').click();
$('#import-file').onchange = e => { if (e.target.files[0]) importTest(e.target.files[0]); e.target.value = ''; };
$('#undo').onclick = () => { if (editor.undo()) sound.click(); };
$('#cleanup').onclick = () => { sound.click(); editor.cleanUp(); };
$('#zoom-in').onclick = () => { sound.click(); editor.setZoom(1); };
$('#zoom-out').onclick = () => { sound.click(); editor.setZoom(-1); };
$('#zoom-reset').onclick = () => { sound.click(); editor.setZoom(0); };
$('#clear-log').onclick = () => { $('#log').replaceChildren(); editor.clearStatus(); };
$('#close-dialog').onclick = () => $('#dialog').close();
$('#name').oninput = autosave;

const muteBtn = $('#mute');
const showMute = () => { muteBtn.textContent = sound.muted ? '🔇' : '🔊'; };
muteBtn.onclick = () => { sound.toggle(); showMute(); };
showMute();

const speed = $('#speed');
const showSpeed = () => { $('#speed-icon').textContent = SPEEDS[speed.value][1]; };
speed.value = store.get('blockbots.speed') ?? 2;
speed.oninput = () => { showSpeed(); store.set('blockbots.speed', speed.value); };
showSpeed();

const keepOpen = $('#keep-open');
keepOpen.checked = store.get('blockbots.keepOpen') === '1';
keepOpen.onchange = () => { sound.click(); store.set('blockbots.keepOpen', keepOpen.checked ? '1' : '0'); };

const toggleBig = () => {
  sound.click();
  const big = $('#live').classList.toggle('big');
  $('#live-zoom').textContent = big ? '✕' : '⤢';
  $('#live-zoom').title = big ? 'Make it small again' : 'Make it bigger';
};
$('#live-zoom').onclick = toggleBig;
$('#live-img').onclick = toggleBig;

// ---------- runner status (website only) ----------
// The chip only appears when the server's test robot isn't answering.

function pingRunner() {
  return new Promise(resolve => {
    let sock;
    // Resolves to the runner's reply ({ event: 'pong', server }) or false.
    const done = reply => { clearTimeout(timer); try { sock.close(); } catch {} resolve(reply); };
    const timer = setTimeout(() => done(false), 4000);
    try {
      sock = new WebSocket(socketURL('/ws/ping'));
      sock.onmessage = e => done(JSON.parse(e.data));
      sock.onerror = () => done(false);
    } catch {
      done(false);
    }
  });
}

async function checkRunner() {
  if (running) return;
  const ok = !!(await pingRunner());
  $('#runner').hidden = ok;
  return ok;
}

$('#runner').onclick = async () => {
  sound.click();
  toast((await checkRunner()) ? 'The robot is back! Press ▶ Run 🎉' : 'Still offline. Please try again in a minute.');
};

document.addEventListener('keydown', e => {
  const typing = e.target.closest?.('input, select, textarea');
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (editor.undo()) sound.click(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); hosted ? toast('Your test is saved in this browser automatically 💾') : save(); }
  else if (e.key === 'Escape' && running) stop();
});

// ---------- start up ----------

(async function init() {
  if (!hosted) hosted = !!(await pingRunner())?.server; // runner serving this page in server mode
  if (hosted) {
    $('#save').hidden = true;
    $('#open').hidden = true;
    $('#keep-open').closest('label').hidden = true; // the server's browser always closes after a run
    $('#live').hidden = false;
    checkRunner();
    setInterval(checkRunner, 30000);
  }
  let saved = null;
  try { saved = JSON.parse(store.get(STORE)); } catch {}
  if (saved?.scripts?.length) {
    editor.load(saved.scripts, saved.variables);
    $('#name').value = saved.name || 'My Test';
    say('Welcome back! Press ▶ Run to test, or drag in more blocks.');
    return;
  }
  try {
    const demo = await fetch('examples/playground-demo.json').then(r => (r.ok ? r.json() : Promise.reject()));
    editor.load(demo.scripts, demo.variables);
    $('#name').value = demo.name;
  } catch {
    editor.clear();
  }
  autosave();
  say("Hi, I'm Bolt! 👋 Drag blocks to tell me what to do in the browser, then press ▶ Run.");
})();
