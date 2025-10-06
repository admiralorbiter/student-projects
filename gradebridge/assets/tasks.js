
/* Kanban + task logic for GradeBridge Project Hub */
(function(){
  const STATE_KEY = 'gb.taskState';

  function el(tag, attrs={}, ...children){
    const node = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs||{})){
      if (k === 'class') node.className = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.substring(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children){
      if (c == null) continue;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }

  function saveState(map){
    localStorage.setItem(STATE_KEY, JSON.stringify(map));
  }
  function loadState(){
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
  }
  function mergeState(tasks, state){
    return tasks.map(t => state[t.id] ? {...t, ...state[t.id]} : t);
  }

  function renderTaskCard(t){
    const card = el('div', {class:'card task mb-2', draggable:'true', 'data-id':t.id, 'data-epic':t.epic});
    const body = el('div', {class:'card-body p-2'});
    const h = el('div', {class:'d-flex justify-content-between align-items-start'});
    const title = el('div', {class:'fw-semibold'}, `[${t.id}] ${t.title}`);
    const badges = el('div', {class:'d-flex gap-1 flex-wrap'});
    badges.append(
      el('span', {class:'badge text-bg-light border'}, 'Epic ', el('span',{class:'badge rounded-pill ms-1 badge-epic'}, t.epic)),
      el('span', {class:'badge text-bg-light border'}, 'Sprint ', el('span',{class:'badge rounded-pill ms-1 badge-sprint'}, String(t.sprint)))
    );
    h.append(title, badges);

    const meta = el('div', {class:'small text-muted mt-1'},
      `Assignee: ${t.assignee || 'Unassigned'} • Est: ${t.estimate || 1} pts • Due: ${t.due || 'TBD'}`
    );

    const desc = el('div', {class:'mt-1'}, t.description || '');
    const deps = (t.deps && t.deps.length)
      ? el('div', {class:'small mt-2'}, el('span', {class:'text-muted'}, 'Depends on: '), t.deps.join(', '))
      : null;

    const controls = el('div', {class:'mt-2 d-flex gap-2 align-items-center flex-wrap'},
      el('button', {class:'btn btn-sm btn-outline-secondary', onClick:()=>showTaskModal(t.id)}, 'Details'),
      el('span', {class:'badge text-bg-secondary'}, t.tags?.join(' • ') || '')
    );

    body.append(h, meta, desc);
    if (deps) body.append(deps);
    body.append(controls);
    card.append(body);

    // Drag & Drop
    card.addEventListener('dragstart', (e)=>{
      e.dataTransfer.setData('text/plain', t.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('opacity-50');
    });
    card.addEventListener('dragend', ()=> card.classList.remove('opacity-50'));

    return card;
  }

  function setupDnD(columnEl){
    columnEl.addEventListener('dragover', (e)=>{
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!columnEl.querySelector('.task-drag-placeholder')) {
        columnEl.append(el('div',{class:'task-drag-placeholder'}));
      }
    });
    columnEl.addEventListener('dragleave', ()=>{
      const ph = columnEl.querySelector('.task-drag-placeholder');
      if (ph) ph.remove();
    });
    columnEl.addEventListener('drop', (e)=>{
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const status = columnEl.dataset.status;
      moveTask(id, status);
      const ph = columnEl.querySelector('.task-drag-placeholder');
      if (ph) ph.remove();
    });
  }

  function moveTask(id, newStatus){
    const state = loadState();
    state[id] = {...(state[id]||{}), status:newStatus};
    saveState(state);
    hydrateBoard();
  }

  function hydrateBoard(){
    const columns = {
      'Backlog': document.getElementById('colBacklog'),
      'In Progress': document.getElementById('colInProgress'),
      'Review': document.getElementById('colReview'),
      'Done': document.getElementById('colDone'),
    };
    for (const k of Object.keys(columns)) columns[k].innerHTML = '';

    // Filters
    const assignee = document.getElementById('filterAssignee')?.value || '';
    const sprint = document.getElementById('filterSprint')?.value || '';
    const epic = document.getElementById('filterEpic')?.value || '';
    const text = document.getElementById('filterText')?.value || '';

    const filtered = window.__tasksMerged.filter(t=>{
      if (assignee && (t.assignee||'') !== assignee) return false;
      if (sprint && String(t.sprint) !== sprint) return false;
      if (epic && (t.epic||'') !== epic) return false;
      if (text && !(`${t.id} ${t.title} ${t.description}`.toLowerCase().includes(text.toLowerCase()))) return false;
      return true;
    });

    filtered.forEach(t=>{
      const col = columns[t.status || 'Backlog'] || columns['Backlog'];
      col.append(renderTaskCard(t));
    });

    // Stats
    const counters = ['Backlog','In Progress','Review','Done'].map(s=>({
      s, n: filtered.filter(t=> (t.status||'Backlog')===s).length
    }));
    const elStats = document.getElementById('kanbanStats');
    if (elStats) {
      elStats.innerHTML = counters.map(c=>`<span class="badge text-bg-light border me-1">${c.s}: ${c.n}</span>`).join('');
    }
  }

  function populateFilters(tasks){
    // Fill filter selects
    const uniq = (arr)=> Array.from(new Set(arr.filter(Boolean))).sort();
    const assignees = uniq(tasks.map(t=>t.assignee));
    const sprints = uniq(tasks.map(t=>String(t.sprint)));
    const epics = uniq(tasks.map(t=>t.epic));

    const fill = (id, values, placeholder) => {
      const sel = document.getElementById(id); if (!sel) return;
      sel.innerHTML = `<option value="">${placeholder}</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
    };
    fill('filterAssignee', assignees, 'All assignees');
    fill('filterSprint', sprints, 'All sprints');
    fill('filterEpic', epics, 'All epics');
  }

  function showTaskModal(id){
    const t = window.__tasksMerged.find(x=>x.id===id);
    if (!t) return;
    const m = document.getElementById('taskModal');
    m.querySelector('.modal-title').textContent = `[${t.id}] ${t.title}`;
    m.querySelector('#taskMeta').innerHTML = `
      <span class="badge text-bg-light border me-1">Epic <span class="badge ms-1 badge-epic">${t.epic}</span></span>
      <span class="badge text-bg-light border me-1">Sprint <span class="badge ms-1 badge-sprint">${t.sprint}</span></span>
      <span class="badge text-bg-light border me-1">Est ${t.estimate||1} pts</span>
      <span class="badge text-bg-light border me-1">Due ${t.due||'TBD'}</span>
    `;
    m.querySelector('#taskDesc').textContent = t.description || '';
    const deps = t.deps?.length ? t.deps.join(', ') : 'None';
    m.querySelector('#taskDeps').textContent = deps;
    const statusSel = m.querySelector('#taskStatus');
    statusSel.value = t.status || 'Backlog';
    const assigneeSel = m.querySelector('#taskAssignee');
    assigneeSel.value = t.assignee || '';
    const notes = JSON.parse(localStorage.getItem('gb.taskNotes')||'{}');
    m.querySelector('#taskNotes').value = notes[t.id] || '';
    const modal = new bootstrap.Modal(m);
    modal.show();
    // Save button
    m.querySelector('#taskSaveBtn').onclick = ()=>{
      const state = loadState();
      state[t.id] = {...(state[t.id]||{}), status: statusSel.value, assignee: assigneeSel.value};
      saveState(state);
      const notesMap = JSON.parse(localStorage.getItem('gb.taskNotes')||'{}');
      notesMap[t.id] = m.querySelector('#taskNotes').value || '';
      localStorage.setItem('gb.taskNotes', JSON.stringify(notesMap));
      modal.hide();
      hydrateBoard();
    };
  }

  async function initKanban(){
    const res = await fetch('data/tasks.json');
    const data = await res.json();
    const state = loadState();
    const merged = mergeState(data.tasks, state);
    window.__tasksMerged = merged;

    populateFilters(merged);
    ['filterAssignee','filterSprint','filterEpic','filterText'].forEach(id=>{
      const el = document.getElementById(id);
      el?.addEventListener('input', hydrateBoard);
    });

    // Setup DnD columns
    ['colBacklog','colInProgress','colReview','colDone']
      .forEach(id=> setupDnD(document.getElementById(id)));

    hydrateBoard();

    // Export CSV
    document.getElementById('btnExportCSV')?.addEventListener('click', ()=>{
      const rows = [['ID','Title','Epic','Sprint','Status','Assignee','Estimate','Due','Dependencies','Tags']];
      window.__tasksMerged.forEach(t=>{
        rows.push([t.id, t.title, t.epic, t.sprint, t.status||'Backlog', t.assignee||'', t.estimate||1, t.due||'', (t.deps||[]).join(';'), (t.tags||[]).join(';')]);
      });
      const csv = rows.map(r=> r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gradebridge_tasks.csv';
      a.click();
    });

    // Populate assignee options in modal
    const assignees = Array.from(new Set(merged.map(t=>t.assignee).filter(Boolean))).sort();
    const sel = document.getElementById('taskAssignee');
    if (sel) {
      sel.innerHTML = '<option value="">Unassigned</option>' + assignees.map(a=>`<option>${a}</option>`).join('');
    }
  }

  // Initialize if on tasks page
  document.addEventListener('DOMContentLoaded', ()=>{
    if (document.getElementById('kanbanBoard')) initKanban();
  });

  // Expose for modal
  window.showTaskModal = showTaskModal;

})();
