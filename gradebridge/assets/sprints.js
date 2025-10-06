
/* Sprints planner for GradeBridge Project Hub */
(function(){
  async function loadJSON(url){ const r=await fetch(url); return r.json(); }

  function renderTimeline(container, settings){
    const start = new Date(settings.projectStart);
    const num = settings.numSprints || 4;
    const weeks = settings.sprintWeeks || 3;

    const wrapper = document.createElement('div');
    wrapper.className = 'row g-3';

    for (let i=0; i<num; i++){
      const s = new Date(start.getTime());
      s.setDate(s.getDate() + i * weeks * 7);
      const e = new Date(s.getTime());
      e.setDate(e.getDate() + weeks * 7 - 1);

      const id = i+1;
      const col = document.createElement('div');
      col.className = 'col-12 col-md-6 col-lg-4';

      const card = document.createElement('div');
      card.className = 'card h-100';
      const body = document.createElement('div');
      body.className = 'card-body';

      const h = document.createElement('h5');
      h.className = 'card-title';
      h.textContent = `Sprint ${id} (${s.toLocaleDateString()} – ${e.toLocaleDateString()})`;
      const goals = document.createElement('div');
      goals.className = 'small text-muted mb-2';
      goals.textContent = `Length: ${weeks} weeks • Theme: see goals below`;

      const list = document.createElement('ul');
      list.className = 'small';
      list.id = `goals-${id}`;

      body.append(h, goals, list);
      card.append(body);
      col.append(card);
      wrapper.append(col);
    }

    container.innerHTML = '';
    container.append(wrapper);
  }

  function hydrateGoals(tasks){
    // Compute sprint goals from tasks with "isGoal" tag or epic leads
    const goalsBySprint = {};
    tasks.forEach(t=>{
      if (!goalsBySprint[t.sprint]) goalsBySprint[t.sprint] = new Set();
      if ((t.tags||[]).includes('Goal')) goalsBySprint[t.sprint].add(t.title);
    });
    for (const [sprint, set] of Object.entries(goalsBySprint)){
      const ul = document.getElementById(`goals-${sprint}`);
      if (!ul) continue;
      if (!set.size) {
        const li = document.createElement('li');
        li.textContent = 'See sprint backlog below.';
        ul.append(li);
      } else {
        Array.from(set).forEach(g=>{
          const li = document.createElement('li'); li.textContent = g; ul.append(li);
        });
      }
    }
  }

  function renderSprintBacklogs(container, tasks){
    const groups = {};
    tasks.forEach(t=>{
      if (!groups[t.sprint]) groups[t.sprint] = [];
      groups[t.sprint].push(t);
    });

    const acc = document.createElement('div');
    acc.className = 'accordion';
    let idx = 0;
    Object.keys(groups).sort((a,b)=>Number(a)-Number(b)).forEach(s=>{
      const list = groups[s].sort((a,b)=> (a.epic||'').localeCompare(b.epic||'') || a.id.localeCompare(b.id));
      const item = document.createElement('div');
      item.className = 'accordion-item';
      const hdrId = `sbh${++idx}`;
      item.innerHTML = `
        <h2 class="accordion-header" id="h${hdrId}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#c${hdrId}" aria-expanded="false" aria-controls="c${hdrId}">
            Sprint ${s} Backlog (${list.length} items)
          </button>
        </h2>
        <div id="c${hdrId}" class="accordion-collapse collapse" aria-labelledby="h${hdrId}">
          <div class="accordion-body">
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead>
                  <tr><th>ID</th><th>Title</th><th>Epic</th><th>Assignee</th><th>Est</th><th>Depends</th><th>Status</th></tr>
                </thead>
                <tbody id="tbody-${hdrId}"></tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      acc.append(item);
      const tbody = item.querySelector(`#tbody-${hdrId}`);
      list.forEach(t=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge text-bg-light border">${t.id}</span></td>
          <td>${t.title}</td>
          <td><span class="badge rounded-pill badge-epic">${t.epic}</span></td>
          <td>${t.assignee||''}</td>
          <td>${t.estimate||1}</td>
          <td>${(t.deps||[]).join(', ')||'-'}</td>
          <td><span class="badge ${t.status==='Done'?'text-bg-success': (t.status==='In Progress'?'text-bg-primary': (t.status==='Review'?'text-bg-warning':'text-bg-secondary'))}">${t.status||'Backlog'}</span></td>
        `;
        tbody.append(tr);
      });
    });
    container.append(acc);
  }

  async function init(){
    const settings = await loadJSON('data/settings.json').catch(()=>({projectStart:'2025-10-06', sprintWeeks:3, numSprints:5}));
    renderTimeline(document.getElementById('sprintTimeline'), settings);

    const data = await loadJSON('data/tasks.json');
    const state = JSON.parse(localStorage.getItem('gb.taskState') || '{}');
    const merged = data.tasks.map(t=> state[t.id] ? {...t, ...state[t.id]} : t);
    hydrateGoals(merged);
    renderSprintBacklogs(document.getElementById('sprintBacklogs'), merged);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
