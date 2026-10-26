// The block workspace: palette, drag & drop, snapping and run highlights.
//
// Model: scripts = [{ id, x, y, blocks: [block, ...] }]
//        block   = { id, type, fields: { name: value }, children?: [block, ...] }
// The DOM is rebuilt from the model after every structural change; field edits
// write straight into the model.
//
// Variables: a white box whose whole value is "{name}" is drawn as a variable
// pill, and the runner fills it in. Chips in the palette's 📦 box (and pills
// already in blocks) can be dragged onto any white box.

import { BLOCKS, CAT, CATEGORIES, cloneBlock, newBlock, uid } from './blocks.js';
import { sound } from './sound.js';

const SNAP_X = 70;
const SNAP_Y = 40;
const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5];
const AUTO_SIZE = CSS.supports('field-sizing', 'content');

const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function* walk(list, owner) {
  yield { list, owner };
  for (const b of list) if (b.children) yield* walk(b.children, b);
}

const PILL = /^\{(\w+)\}$/;
export const varName = s => String(s || '').trim().replace(/\W+/g, '_').replace(/^_+|_+$/g, '');

export class Editor {
  constructor({ rail, flyout, search, canvas, world, sizer, trash, menu, onChange, onVariables }) {
    Object.assign(this, { rail, flyout, search, canvas, world, sizer, trash, menu, onChange, onVariables });
    this.scripts = [];
    this.variables = [];
    this.history = [];
    this.zoom = 1;
    this.locked = false;
    this.drag = null;
    this.indicator = h('div', 'snap-indicator');
    document.body.append(this.indicator);

    this.buildPalette();
    document.addEventListener('pointerdown', e => this.onPointerDown(e));
    canvas.addEventListener('contextmenu', e => this.onContextMenu(e));
    document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) menu.hidden = true; });
    canvas.addEventListener('scroll', () => { if (this.drag) this.drag.slots = this.collectSlots(this.drag.blocks); });
    new ResizeObserver(() => this.fitWorld()).observe(canvas);
  }

  // ---------- public API ----------

  load(scripts, variables = []) {
    this.scripts = (scripts || []).filter(s => s.blocks?.length);
    this.variables = [...new Set(variables.map(varName).filter(Boolean))];
    this.renderVarBox();
    this.render();
  }

  // ---------- variables ----------

  addVariable(raw) {
    const name = varName(raw);
    if (name && !this.variables.includes(name)) {
      this.variables.push(name);
      this.renderVarBox();
      this.render(); // so every variable dropdown on the canvas offers the new one
      this.onVariables?.();
    }
    return name;
  }

  // Every variable the blocks mention, so a variable appears as soon as a block names it.
  usedVariables() {
    const used = new Set();
    for (const { list } of this.lists()) {
      for (const b of list) {
        const def = BLOCKS[b.type];
        for (const f of def ? def.parts.filter(p => typeof p === 'object') : []) {
          const value = b.fields[f.name];
          if (f.kind === 'var' && value) used.add(varName(value));
          if (typeof value === 'string') for (const m of value.matchAll(/\{(\w+)\}/g)) used.add(m[1]);
        }
      }
    }
    return used;
  }

  syncVariables() {
    const before = this.variables.length;
    for (const name of this.usedVariables()) if (!this.variables.includes(name)) this.variables.push(name);
    if (this.variables.length !== before) {
      this.renderVarBox();
      this.onVariables?.();
    }
  }

  renderVarBox() {
    const box = this.flyout.querySelector('.var-chips');
    if (!box) return;
    box.replaceChildren(...this.variables.map(name => {
      const chip = h('span', 'var-chip');
      chip.dataset.var = name;
      chip.title = 'Drag me into a white box in any block';
      chip.append(h('span', null, name), h('button', 'x', '×'));
      chip.querySelector('.x').title = 'Delete this variable';
      return chip;
    }));
    if (!this.variables.length) box.append(h('span', 'var-hint', 'No variables yet. Make one, or use a block that saves into one.'));
  }

  deleteVariable(name) {
    if (this.usedVariables().has(name)) {
      sound.oops();
      alert(`"${name}" is still used in some blocks. Remove it from those blocks first.`);
      return;
    }
    this.variables = this.variables.filter(v => v !== name);
    sound.trash();
    this.renderVarBox();
    this.render();
    this.onVariables?.();
    this.onChange();
  }

  // Which block field does this input / pill belong to?
  fieldOf(el) {
    const found = this.find(el.closest('.block')?.dataset.id);
    return found && { block: found.list[found.index], name: el.dataset.field };
  }

  // Drag a variable chip (from the palette) or pill (already in a block) onto a white box.
  dragVariable(e, name, fromEl) {
    const start = { x: e.clientX, y: e.clientY };
    const source = fromEl && this.fieldOf(fromEl);
    let float = null, target = null;
    const move = ev => {
      if (!float) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        float = h('div', 'var-float', name);
        document.body.append(float);
        document.body.classList.add('dragging');
        sound.pick();
      }
      float.style.left = ev.clientX + 'px';
      float.style.top = ev.clientY + 'px';
      const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.world .f-text, .world .f-num, .world .f-var');
      if (t !== target) {
        target?.classList.remove('var-target');
        target = t;
        target?.classList.add('var-target');
        if (target) sound.hover();
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!float) return;
      float.remove();
      document.body.classList.remove('dragging');
      target?.classList.remove('var-target');
      const dest = target && this.fieldOf(target);
      if (!dest && !source) return sound.drop();
      this.snapshot();
      if (source && !(dest && dest.block === source.block && dest.name === source.name)) source.block.fields[source.name] = '';
      if (dest) dest.block.fields[dest.name] = `{${name}}`;
      dest ? sound.snap() : sound.trash();
      this.render();
      this.onChange();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  snapshot() {
    this.history.push(JSON.stringify(this.scripts));
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    if (!this.history.length || this.locked) return false;
    this.scripts = JSON.parse(this.history.pop());
    this.render();
    this.onChange();
    return true;
  }

  clear() {
    this.snapshot();
    this.scripts = [{ id: uid(), x: 40, y: 30, blocks: [newBlock('start')] }];
    this.render();
    this.onChange();
  }

  lock(on) {
    this.locked = on;
    this.canvas.classList.toggle('locked', on);
  }

  setZoom(dir) {
    const i = ZOOMS.indexOf(this.zoom);
    this.zoom = dir === 0 ? 1 : ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + dir))];
    this.fitWorld();
  }

  cleanUp() {
    this.snapshot();
    let y = 30;
    const sorted = [...this.scripts].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const s of sorted) {
      const el = this.world.querySelector(`[data-sid="${s.id}"]`);
      s.x = 40;
      s.y = y;
      y += (el ? el.offsetHeight : 60) + 40;
    }
    this.scripts = sorted;
    this.render();
    this.onChange();
  }

  clearStatus() {
    this.world.querySelectorAll('.block').forEach(el => el.classList.remove('running', 'pass', 'fail', 'stopped'));
    this.world.querySelectorAll('.badge, .why').forEach(el => el.remove());
  }

  setStatus(id, status, text) {
    const el = this.world.querySelector(`.block[data-id="${CSS.escape(id || '')}"]`);
    if (!el) return;
    const row = el.querySelector(':scope > .row');
    el.classList.remove('running', 'pass', 'fail', 'stopped');
    row.querySelectorAll(':scope > .badge, :scope > .why').forEach(x => x.remove());
    el.classList.add(status);
    if (status === 'running') {
      // Restart the bounce animation even when a block runs twice in a loop.
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
    if (status === 'pass' || status === 'fail') row.append(h('span', 'badge', status === 'pass' ? '✓' : '✗'));
    if (status === 'fail' && text) row.append(h('span', 'why', text));
  }

  // ---------- rendering ----------

  render() {
    this.world.replaceChildren();
    for (const s of this.scripts) {
      const el = h('div', 'script');
      el.dataset.sid = s.id;
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      if (s.blocks[0]?.type !== 'start') {
        el.classList.add('loose');
        el.title = 'This stack is not under a 🚀 Start block, so it will not run';
      }
      el.append(this.renderStack(s.blocks));
      this.world.append(el);
    }
    this.fitWorld();
    this.syncVariables();
  }

  fitWorld() {
    let w = 0, ht = 0;
    for (const el of this.world.children) {
      w = Math.max(w, el.offsetLeft + el.offsetWidth);
      ht = Math.max(ht, el.offsetTop + el.offsetHeight);
    }
    const z = this.zoom;
    w = Math.max(w + 400, this.canvas.clientWidth / z);
    ht = Math.max(ht + 400, this.canvas.clientHeight / z);
    this.world.style.width = w + 'px';
    this.world.style.height = ht + 'px';
    this.world.style.transform = `scale(${z})`;
    this.sizer.style.width = w * z + 'px';
    this.sizer.style.height = ht * z + 'px';
  }

  renderStack(list) {
    const st = h('div', 'stack');
    for (const b of list) st.append(this.renderBlock(b));
    return st;
  }

  renderBlock(b) {
    const def = BLOCKS[b.type];
    const el = h('div', 'block');
    el.dataset.id = b.id;
    const row = h('div', 'row');
    el.append(row);
    if (!def) {
      el.classList.add('unknown');
      row.append(h('span', 'lbl', `❓ unknown block "${b.type}"`));
      return el;
    }
    const cat = CAT[def.cat];
    el.classList.add(def.shape);
    el.style.setProperty('--c', cat.color);
    el.style.setProperty('--d', cat.dark);
    if (cat.text) el.style.setProperty('--t', cat.text);
    el.title = def.tip || '';
    if (def.shape === 'hat') row.append(h('span', 'hat-icon', '🚀'));
    for (const part of def.parts) {
      row.append(typeof part === 'string' ? h('span', 'lbl', part) : this.renderField(b, part));
    }
    if (def.shape === 'c') {
      const body = h('div', 'c-body');
      body.append(h('div', 'c-arm'), this.renderStack(b.children || (b.children = [])));
      el.append(body, h('div', 'c-foot'));
    }
    return el;
  }

  renderField(b, f) {
    if (!(f.name in b.fields)) b.fields[f.name] = f.value;
    if (f.kind === 'var') return this.renderVarSelect(b, f);
    if (f.kind === 'file') return this.renderFilePicker(b, f);
    const pill = typeof b.fields[f.name] === 'string' && b.fields[f.name].match(PILL);
    if (pill && (f.kind === 'text' || f.kind === 'number')) {
      const el = h('span', 'f-var');
      el.dataset.field = f.name;
      el.dataset.var = pill[1];
      el.title = 'Drag me somewhere else, or × to remove';
      el.append(h('span', null, pill[1]), h('button', 'x', '×'));
      return el;
    }
    if (f.kind === 'select') {
      const sel = h('select', 'f-sel');
      for (const [label, value] of f.options) {
        const o = h('option', null, label);
        o.value = value;
        sel.append(o);
      }
      sel.value = b.fields[f.name];
      sel.addEventListener('focus', () => this.snapshot());
      sel.addEventListener('change', () => { b.fields[f.name] = sel.value; sound.click(); this.onChange(); });
      return sel;
    }
    const input = h('input', f.kind === 'number' ? 'f-num' : 'f-text');
    input.value = b.fields[f.name];
    input.dataset.field = f.name;
    input.spellcheck = false;
    if (f.kind === 'number') input.inputMode = 'decimal';
    // Browsers with `field-sizing: content` size the box to its text in CSS.
    const fit = AUTO_SIZE ? () => {} : () => {
      input.style.width = `calc(${Math.max(f.kind === 'number' ? 1 : 3, input.value.length) * 1.1}ch + 24px)`;
    };
    fit();
    input.addEventListener('focus', () => this.snapshot());
    input.addEventListener('input', () => { b.fields[f.name] = input.value; fit(); this.onChange(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    return input;
  }

  renderVarSelect(b, f) {
    const sel = h('select', 'f-sel f-varsel');
    const current = varName(b.fields[f.name]);
    for (const name of new Set([...this.variables, current].filter(Boolean))) {
      const o = h('option', null, `📦 ${name}`);
      o.value = name;
      sel.append(o);
    }
    const make = h('option', null, '➕ new variable…');
    make.value = '__new';
    sel.append(make);
    sel.value = current;
    sel.addEventListener('focus', () => this.snapshot());
    sel.addEventListener('change', () => {
      if (sel.value === '__new') {
        const name = this.addVariable(prompt('Name your new variable (letters, numbers and _):', '') || '');
        if (!name) { sel.value = current; return; }
        b.fields[f.name] = name;
        this.render();
      } else {
        b.fields[f.name] = sel.value;
      }
      sound.click();
      this.onChange();
    });
    return sel;
  }

  renderFilePicker(b, f) {
    const picked = b.fields[f.name];
    const btn = h('button', 'f-file', picked?.name ? `📄 ${picked.name}` : '📁 choose a file');
    btn.title = 'CSV, Excel (.xlsx), JSON or text';
    btn.addEventListener('click', () => {
      const input = h('input');
      input.type = 'file';
      input.accept = '.csv,.tsv,.xlsx,.xlsm,.json,.txt';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { sound.oops(); alert('Please pick a file smaller than 3 MB.'); return; }
        const reader = new FileReader();
        reader.onload = () => {
          this.snapshot();
          b.fields[f.name] = { name: file.name, data: reader.result.split(',')[1] };
          sound.snap();
          this.render();
          this.onChange();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
    return btn;
  }

  buildPalette() {
    const sections = [];
    for (const cat of CATEGORIES) {
      const btn = h('button', 'cat');
      btn.style.setProperty('--c', cat.color);
      btn.innerHTML = `<span class="dot">${cat.icon}</span><span>${cat.name}</span>`;
      btn.addEventListener('click', () => {
        sound.click();
        this.search.value = '';
        this.filter('');
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      this.rail.append(btn);

      const section = h('section', 'pal-section');
      section.dataset.cat = cat.id;
      const title = h('h3', null, `${cat.icon} ${cat.name}`);
      title.style.color = cat.dark;
      section.append(title);
      if (cat.id === 'vars') {
        const box = h('div', 'var-box');
        const make = h('button', 'var-make', '➕ Make a variable');
        make.addEventListener('click', () => {
          const name = this.addVariable(prompt('Name your new variable (letters, numbers and _):', '') || '');
          if (name) { sound.snap(); this.onChange(); }
        });
        box.append(make, h('div', 'var-chips'));
        section.append(box);
      }
      for (const def of Object.values(BLOCKS).filter(d => d.cat === cat.id)) {
        const item = h('div', 'pal-item');
        const el = this.renderBlock(newBlock(def.type));
        el.dataset.type = def.type;
        item.dataset.search = [def.type, cat.name, ...def.parts.filter(p => typeof p === 'string')].join(' ').toLowerCase();
        item.append(el);
        section.append(item);
      }
      this.flyout.append(section);
      sections.push([section, btn]);
    }
    const markActive = () => {
      let active = sections[0];
      for (const pair of sections) if (pair[0].offsetTop - this.flyout.offsetTop <= this.flyout.scrollTop + 20) active = pair;
      sections.forEach(([, b]) => b.classList.toggle('active', b === active[1]));
    };
    this.flyout.addEventListener('scroll', markActive);
    markActive();
    this.search.addEventListener('input', () => this.filter(this.search.value));
  }

  filter(q) {
    q = q.trim().toLowerCase();
    for (const sec of this.flyout.querySelectorAll('.pal-section')) {
      let any = false;
      for (const item of sec.querySelectorAll('.pal-item')) {
        const show = !q || item.dataset.search.includes(q);
        item.hidden = !show;
        any ||= show;
      }
      sec.hidden = !any;
    }
  }

  // ---------- model lookups ----------

  *lists() {
    for (const s of this.scripts) yield* walk(s.blocks, s);
  }

  find(id) {
    for (const { list, owner } of this.lists()) {
      const index = list.findIndex(b => b.id === id);
      if (index >= 0) return { list, index, owner };
    }
    return null;
  }

  scriptOf(blockEl) {
    const sid = blockEl.closest('.script')?.dataset.sid;
    return this.scripts.find(s => s.id === sid);
  }

  // ---------- drag & drop ----------

  onPointerDown(e) {
    if (e.button !== 0 || this.locked) return;

    // Variables: × buttons, palette chips and pills inside blocks.
    const x = e.target.closest('.var-chip .x, .f-var .x');
    if (x) {
      e.preventDefault();
      const chip = x.parentElement;
      if (chip.classList.contains('var-chip')) return this.deleteVariable(chip.dataset.var);
      const field = this.fieldOf(chip);
      this.snapshot();
      field.block.fields[field.name] = '';
      sound.click();
      this.render();
      return this.onChange();
    }
    const varEl = e.target.closest('.flyout .var-chip, .world .f-var');
    if (varEl) {
      e.preventDefault();
      return this.dragVariable(e, varEl.dataset.var, varEl.classList.contains('f-var') ? varEl : null);
    }

    const blockEl = e.target.closest('.block');
    if (!blockEl) return;
    const fromPalette = !!blockEl.closest('.flyout');
    if (!fromPalette && !blockEl.closest('.world')) return;
    if (!fromPalette && e.target.closest('input, select, .f-file')) return;
    e.preventDefault();
    document.activeElement?.blur?.();

    const start = { x: e.clientX, y: e.clientY };
    const move = ev => {
      if (!this.drag && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 5) this.startDrag(blockEl, fromPalette, start);
      if (this.drag) this.moveDrag(ev);
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (this.drag) this.endDrag(ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  startDrag(blockEl, fromPalette, start) {
    const rect = blockEl.getBoundingClientRect();
    // Grab offset in unscaled block pixels, so it stays under the pointer at any zoom.
    const scale = fromPalette ? 1 : this.zoom;
    const grab = { x: (start.x - rect.left) / scale, y: (start.y - rect.top) / scale };

    this.snapshot();
    let blocks;
    if (fromPalette) {
      blocks = [newBlock(blockEl.dataset.type)];
    } else {
      const { list, index } = this.find(blockEl.dataset.id);
      blocks = list.splice(index); // the block and everything under it travel together
      this.scripts = this.scripts.filter(s => s.blocks.length);
      this.render();
    }

    const float = h('div', 'drag-float');
    float.append(this.renderStack(blocks));
    float.style.transform = `scale(${this.zoom})`;
    document.body.append(float);
    document.body.classList.add('dragging');
    this.drag = { blocks, float, grab, fromPalette, target: null, doomed: false };
    this.drag.slots = this.collectSlots(blocks);
    sound.pick();
  }

  // Every place the dragged stack could attach, in viewport pixels.
  collectSlots(blocks) {
    const isHat = blocks[0].type === 'start';
    const slots = [];
    const elOf = id => this.world.querySelector(`.block[data-id="${id}"]`);
    for (const s of this.scripts) {
      for (const { list, owner } of walk(s.blocks, s)) {
        const top = owner === s;
        if (isHat && !top) continue;
        if (top) {
          if (list[0].type !== 'start') {
            const r = elOf(list[0].id).getBoundingClientRect();
            slots.push({ list, index: 0, x: r.left, y: r.top, above: true, script: s });
          }
          if (isHat) continue;
        } else {
          const r = elOf(owner.id).querySelector(':scope > .c-body > .stack').getBoundingClientRect();
          slots.push({ list, index: 0, x: r.left, y: r.top });
        }
        list.forEach((b, i) => {
          const r = elOf(b.id).getBoundingClientRect();
          slots.push({ list, index: i + 1, x: r.left, y: r.bottom });
        });
      }
    }
    return slots;
  }

  moveDrag(ev) {
    const d = this.drag;
    const x = ev.clientX - d.grab.x * this.zoom;
    const y = ev.clientY - d.grab.y * this.zoom;
    d.float.style.left = x + 'px';
    d.float.style.top = y + 'px';

    const paletteRight = this.flyout.getBoundingClientRect().right;
    const tr = this.trash.getBoundingClientRect();
    const overTrash = ev.clientX < paletteRight ||
      (ev.clientX > tr.left - 20 && ev.clientX < tr.right + 20 && ev.clientY > tr.top - 20 && ev.clientY < tr.bottom + 20);
    if (overTrash !== d.doomed) {
      d.doomed = overTrash;
      d.float.classList.toggle('doomed', overTrash);
      this.trash.classList.toggle('open', overTrash);
    }

    let best = null;
    if (!overTrash) {
      const bottom = y + d.float.getBoundingClientRect().height;
      let bestDist = Infinity;
      for (const s of d.slots) {
        const dx = Math.abs(x - s.x);
        const dy = Math.abs((s.above ? bottom : y) - s.y);
        if (dx < SNAP_X * this.zoom && dy < SNAP_Y * this.zoom && dx + dy * 2 < bestDist) {
          bestDist = dx + dy * 2;
          best = s;
        }
      }
    }
    if (best !== d.target) {
      d.target = best;
      if (best) sound.hover();
    }
    const ind = this.indicator;
    ind.classList.toggle('show', !!best);
    if (best) {
      ind.style.left = best.x + 'px';
      ind.style.top = best.y - 3 + 'px';
      ind.style.width = Math.max(120, d.float.getBoundingClientRect().width * 0.7) + 'px';
      ind.style.setProperty('--c', CAT[BLOCKS[d.blocks[0].type].cat].color);
    }
  }

  endDrag(ev) {
    const d = this.drag;
    this.drag = null;
    const fr = d.float.getBoundingClientRect();
    d.float.remove();
    this.indicator.classList.remove('show');
    this.trash.classList.remove('open');
    document.body.classList.remove('dragging');

    let landed = d.blocks[0].id;
    if (d.doomed) {
      if (d.fromPalette) this.history.pop();
      sound.trash();
      this.poof(ev.clientX, ev.clientY);
      landed = null;
    } else if (d.target) {
      const t = d.target;
      t.list.splice(t.index, 0, ...d.blocks);
      if (t.above) t.script.y = Math.max(0, t.script.y - fr.height / this.zoom);
      sound.snap();
    } else {
      const wr = this.world.getBoundingClientRect();
      this.scripts.push({
        id: uid(),
        x: Math.max(0, Math.round((fr.left - wr.left) / this.zoom)),
        y: Math.max(0, Math.round((fr.top - wr.top) / this.zoom)),
        blocks: d.blocks,
      });
      sound.drop();
    }
    this.render();
    if (landed) this.world.querySelector(`.block[data-id="${landed}"]`)?.classList.add('pop');
    this.onChange();
  }

  poof(x, y) {
    for (let i = 0; i < 8; i++) {
      const p = h('div', 'poof', ['✨', '💨', '⭐'][i % 3]);
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      const a = (i / 8) * Math.PI * 2;
      p.style.setProperty('--dx', Math.cos(a) * 60 + 'px');
      p.style.setProperty('--dy', Math.sin(a) * 60 + 'px');
      document.body.append(p);
      setTimeout(() => p.remove(), 600);
    }
  }

  // ---------- right-click menu ----------

  onContextMenu(e) {
    e.preventDefault();
    if (this.locked) return;
    const blockEl = e.target.closest('.world .block');
    const items = blockEl
      ? [
          ['📄 Duplicate', () => this.duplicate(blockEl)],
          ['🗑️ Delete block', () => this.remove(blockEl)],
        ]
      : [
          ['🧹 Clean up blocks', () => this.cleanUp()],
          ['↶ Undo', () => this.undo()],
        ];
    this.menu.replaceChildren(...items.map(([label, fn]) => {
      const b = h('button', null, label);
      b.addEventListener('click', () => { this.menu.hidden = true; sound.click(); fn(); });
      return b;
    }));
    this.menu.style.left = e.clientX + 'px';
    this.menu.style.top = e.clientY + 'px';
    this.menu.hidden = false;
  }

  duplicate(blockEl) {
    this.snapshot();
    const { list, index } = this.find(blockEl.dataset.id);
    const copy = cloneBlock(list[index]);
    const wr = this.world.getBoundingClientRect();
    const r = blockEl.getBoundingClientRect();
    this.scripts.push({
      id: uid(),
      x: Math.round((r.left - wr.left) / this.zoom) + 30,
      y: Math.round((r.top - wr.top) / this.zoom) + 30,
      blocks: [copy],
    });
    this.render();
    this.world.querySelector(`.block[data-id="${copy.id}"]`)?.classList.add('pop');
    this.onChange();
  }

  remove(blockEl) {
    this.snapshot();
    const r = blockEl.getBoundingClientRect();
    const { list, index } = this.find(blockEl.dataset.id);
    list.splice(index, 1);
    this.scripts = this.scripts.filter(s => s.blocks.length);
    sound.trash();
    this.poof(r.left + r.width / 2, r.top + r.height / 2);
    this.render();
    this.onChange();
  }
}
