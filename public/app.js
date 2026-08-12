async function loadTables() {
  const status = document.getElementById('status');
  const tbody = document.querySelector('#tables tbody');
  try {
    status.textContent = 'جلب الجداول...';
    const auth = JSON.parse(localStorage.getItem('proacc_auth') || 'null');
    const headers = auth && auth.token ? { 'Authorization': 'Bearer ' + auth.token } : {};
    const data = await fetchJson('/tables', { headers });
    tbody.innerHTML = '';
    data.tables.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.TABLE_SCHEMA}</td><td>${t.TABLE_NAME}</td><td><button class="view" data-schema="${t.TABLE_SCHEMA}" data-table="${t.TABLE_NAME}">عرض</button></td>`;
      tbody.appendChild(tr);
    });
    status.textContent = `تم التحميل: ${data.tables.length} جدولاً`;
  } catch (err) {
    status.textContent = 'خطأ: ' + err.message;
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) {
    let errorMessage = res.statusText || 'خطأ في الاتصال';
    try {
      const parsed = JSON.parse(text);
      errorMessage = parsed.error || parsed.message || errorMessage;
    } catch (e) {
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  return text ? JSON.parse(text) : {};
}

window.addEventListener('DOMContentLoaded', () => {
  // apply persisted UI state
  const state = JSON.parse(localStorage.getItem('proacc_ui') || '{}');
  const sidebar = document.getElementById('sidebar');
  if (state.collapsed) sidebar && sidebar.classList.add('collapsed');
  if (state.primary) document.documentElement.style.setProperty('--primary', state.primary);
  if (state.logoText) {
    const lt = document.getElementById('logo-text');
    if (lt) lt.textContent = state.logoText;
  }

  // show login if needed
  const auth = JSON.parse(localStorage.getItem('proacc_auth') || 'null');
  const loginPanel = document.getElementById('login-panel');
  const userArea = document.getElementById('user-area');
  function setUserArea(user) {
    if (!user) {
      userArea.innerHTML = 'المستخدم';
      return;
    }
    userArea.innerHTML = `${user.fullName || user.username} <button id="logout-btn" class="icon-btn" title="خروج">⎋</button>`;
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn && logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('proacc_auth');
      setUserArea(null);
      if (loginPanel) loginPanel.setAttribute('aria-hidden', 'false');
    });
  }
  if (!auth || !auth.token) {
    if (loginPanel) loginPanel.setAttribute('aria-hidden', 'false');
  } else {
    setUserArea(auth.user);
  }

  // Search/filter functionality
  const searchInput = document.getElementById('search');
  searchInput && searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#tables tbody tr').forEach(tr => {
      const name = tr.children[1].textContent.toLowerCase();
      tr.style.display = name.includes(q) ? '' : 'none';
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById('refresh');
  refreshBtn && refreshBtn.addEventListener('click', () => loadTables());

  // Delegate click for view buttons
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('view')) {
      const schema = e.target.getAttribute('data-schema');
      const table = e.target.getAttribute('data-table');
      await showTableDetails(schema, table);
    }
  });

  // Nav item clicks (switch views)
  document.querySelectorAll('.nav-item').forEach(a => a.addEventListener('click', async (ev) => {
    ev.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    a.classList.add('active');
    const route = a.getAttribute('data-route');
    const tablesCard = document.querySelector('.card');
    const details = document.getElementById('details');
    const accountsCard = document.getElementById('accounts-card');
    if (route === 'accounts') {
      if (tablesCard) tablesCard.style.display = 'none';
      if (details) details.style.display = 'none';
      if (accountsCard) { accountsCard.style.display = ''; await loadAccounts(); }
    } else if (route === 'tables') {
      if (accountsCard) accountsCard.style.display = 'none';
      if (details) details.style.display = '';
      if (tablesCard) tablesCard.style.display = '';
    } else {
      // default — show tables
      if (accountsCard) accountsCard.style.display = 'none';
      if (details) details.style.display = '';
      if (tablesCard) tablesCard.style.display = '';
    }
  }));

  // Sidebar toggle
  const toggleBtn = document.getElementById('toggle-sidebar');
  toggleBtn && toggleBtn.addEventListener('click', () => {
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    const collapsed = sidebar.classList.contains('collapsed');
    const s = JSON.parse(localStorage.getItem('proacc_ui') || '{}');
    s.collapsed = collapsed;
    localStorage.setItem('proacc_ui', JSON.stringify(s));
  });

  // Settings panel
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsClose = document.getElementById('settings-close');
  const settingsSave = document.getElementById('settings-save');
  settingsBtn && settingsBtn.addEventListener('click', () => {
    if (!settingsPanel) return;
    settingsPanel.setAttribute('aria-hidden', 'false');
    const primaryInput = document.getElementById('setting-primary');
    const logoInput = document.getElementById('setting-logo');
    const s = JSON.parse(localStorage.getItem('proacc_ui') || '{}');
    if (s.primary && primaryInput) primaryInput.value = s.primary;
    if (s.logoText && logoInput) logoInput.value = s.logoText;
  });
  settingsClose && settingsClose.addEventListener('click', () => {
    settingsPanel && settingsPanel.setAttribute('aria-hidden', 'true');
  });
  settingsSave && settingsSave.addEventListener('click', () => {
    const primary = document.getElementById('setting-primary').value;
    const logo = document.getElementById('setting-logo').value;
    document.documentElement.style.setProperty('--primary', primary);
    const lt = document.getElementById('logo-text');
    if (lt) lt.textContent = logo;
    const s = JSON.parse(localStorage.getItem('proacc_ui') || '{}');
    s.primary = primary; s.logoText = logo;
    localStorage.setItem('proacc_ui', JSON.stringify(s));
    settingsPanel && settingsPanel.setAttribute('aria-hidden', 'true');
  });

  // close settings on backdrop click
  settingsPanel && settingsPanel.addEventListener('click', (ev) => {
    if (ev.target === settingsPanel) settingsPanel.setAttribute('aria-hidden', 'true');
  });

  // Login handlers
  const loginSubmit = document.getElementById('login-submit');
  const loginError = document.getElementById('login-error');
  loginSubmit && loginSubmit.addEventListener('click', async () => {
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    try {
      loginError.style.display = 'none';
      const r = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('proacc_auth', JSON.stringify({ token: data.token, user: data.user }));
      if (loginPanel) loginPanel.setAttribute('aria-hidden', 'true');
      setUserArea(data.user);
      loadTables();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.style.display = '';
    }
  });

  // close login on backdrop click
  loginPanel && loginPanel.addEventListener('click', (ev) => {
    if (ev.target === loginPanel) loginPanel.setAttribute('aria-hidden', 'true');
  });

});

async function showTableDetails(schema, table) {
  const title = document.getElementById('details-title');
  const area = document.getElementById('details-area');
  title.style.display = '';
  title.textContent = `محتوى ${schema}.${table}`;
  area.textContent = 'جلب الصفوف...';
  try {
    const auth = JSON.parse(localStorage.getItem('proacc_auth') || 'null');
    const headers = auth && auth.token ? { 'Authorization': 'Bearer ' + auth.token } : {};
    const data = await fetchJson(`/table/${schema}/${table}`, { headers });
    if (!data.rows || data.rows.length === 0) {
      area.textContent = 'لا توجد صفوف لعرضها.';
      return;
    }
    // Build table
    const tbl = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    Object.keys(data.rows[0]).forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    const tbody = document.createElement('tbody');
    data.rows.forEach(r => {
      const tr = document.createElement('tr');
      Object.values(r).forEach(v => {
        const td = document.createElement('td');
        td.textContent = v === null ? 'NULL' : v.toString();
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    area.innerHTML = '';
    area.appendChild(tbl);
  } catch (err) {
    area.textContent = 'خطأ: ' + err.message;
  }
}

async function loadCategories() {
  if (window._accountCategories) return window._accountCategories;
  try {
    const auth = JSON.parse(localStorage.getItem('proacc_auth') || 'null');
    const headers = auth && auth.token ? { 'Authorization': 'Bearer ' + auth.token } : {};
    const res = await fetch('/categories', { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data.categories) return [];
    window._accountCategories = data.categories;
    return data.categories;
  } catch (err) {
    console.warn('Could not load categories:', err.message || err);
    return [];
  }
}

async function loadAccounts() {
  const status = document.getElementById('accounts-status');
  const tbody = document.querySelector('#accounts-table tbody');
  try {
    status.textContent = 'جلب دليل الحسابات...';
    const auth = JSON.parse(localStorage.getItem('proacc_auth') || 'null');
    const headers = auth && auth.token ? { 'Authorization': 'Bearer ' + auth.token } : {};
    const data = await fetchJson('/accounts', { headers });
    if (!data.accounts || data.accounts.length === 0) {
      status.textContent = 'لا توجد حسابات.';
      tbody.innerHTML = '';
      return;
    }
    // build header
    const cols = Object.keys(data.accounts[0]);
    const thead = document.querySelector('#accounts-table thead');
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');
    cols.forEach(c => { const th = document.createElement('th'); th.textContent = c; headerRow.appendChild(th); });
    // actions column
    const thActions = document.createElement('th'); thActions.textContent = 'إجراءات'; headerRow.appendChild(thActions);
    thead.appendChild(headerRow);
    tbody.innerHTML = '';
    data.accounts.forEach(row => {
      const tr = document.createElement('tr');
      cols.forEach(c => { const td = document.createElement('td'); const v = row[c]; td.textContent = v === null ? 'NULL' : v.toString(); tr.appendChild(td); });
      // actions
      const actTd = document.createElement('td');
      const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> تعديل'; editBtn.className = 'action-btn acct-edit';
      const delBtn = document.createElement('button'); delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> حذف'; delBtn.className = 'action-btn acct-delete danger';
      actTd.appendChild(editBtn); actTd.appendChild(delBtn);
      tr.appendChild(actTd);
      tbody.appendChild(tr);
    });
    status.textContent = `تم التحميل: ${data.accounts.length} حساباً`;
  } catch (err) {
    status.textContent = 'خطأ: ' + err.message;
  }
}

// Account modal/form logic
async function openAccountModal(mode, cols, values) {
  const panel = document.getElementById('account-modal');
  const title = document.getElementById('account-modal-title');
  const form = document.getElementById('account-form');
  const error = document.getElementById('account-error');
  form.innerHTML = '';
  error.style.display = 'none';
  title.textContent = mode === 'edit' ? 'تعديل حساب' : 'إضافة حساب';
  const categories = await loadCategories();
  const requiredFields = ['ACCID', 'ACC', 'CategID', 'Chart', 'Active'];
  const advancedButton = document.createElement('button');
  advancedButton.type = 'button';
  advancedButton.textContent = 'عرض الحقول المتقدمة';
  advancedButton.className = 'advanced-toggle';
  advancedButton.style.marginBottom = '12px';
  advancedButton.onclick = () => {
    const advancedRows = form.querySelectorAll('.field-group.advanced');
    const show = advancedRows.length > 0 && advancedRows[0].style.display === 'none';
    advancedRows.forEach(row => row.style.display = show ? 'block' : 'none');
    advancedButton.textContent = show ? 'إخفاء الحقول المتقدمة' : 'عرض الحقول المتقدمة';
  };
  form.appendChild(advancedButton);
  cols.forEach(c => {
    const isRequired = requiredFields.includes(c);
    const wrap = document.createElement('label');
    wrap.className = 'field-group';
    if (!isRequired) wrap.classList.add('advanced');
    wrap.style.display = isRequired ? 'block' : 'none';
    wrap.style.margin = '6px 0';
    wrap.appendChild(document.createTextNode(c + ': '));
    if (c === 'CategID' && categories.length > 0) {
      const select = document.createElement('select');
      select.name = c;
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.label || cat.id;
        select.appendChild(opt);
      });
      if (values && values[c] != null) select.value = values[c];
      wrap.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.name = c;
      input.placeholder = c;
      if (/^(Chart|Active)$/i.test(c)) {
        input.type = 'checkbox';
        input.checked = values && values[c] === true;
      } else if (/id$/i.test(c) || /Group|ODR|OCR/i.test(c)) {
        input.type = 'number';
        input.value = values && values[c] != null ? values[c] : '';
      } else {
        input.type = 'text';
        input.value = values && values[c] != null ? values[c] : '';
      }
      wrap.appendChild(input);
    }
    form.appendChild(wrap);
  });
  panel.setAttribute('aria-hidden', 'false');
  // save handler
  const save = document.getElementById('account-save');
  const cancel = document.getElementById('account-cancel');
  const onSave = async () => {
    const auth = JSON.parse(localStorage.getItem('proacc_auth') || 'null');
    const headers = { 'Content-Type': 'application/json' };
    if (auth && auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
    const body = {};
    form.querySelectorAll('input,select').forEach(i => {
      const name = i.name;
      if (i.type === 'checkbox') {
        body[name] = i.checked;
      } else if (i.tagName.toLowerCase() === 'select' || i.type === 'number') {
        const value = i.value;
        body[name] = value === '' ? null : Number(value);
      } else {
        body[name] = i.value === '' ? null : i.value;
      }
    });
    try {
      if (mode === 'edit') {
        const idColumn = cols.find(c => /id$/i.test(c)) || cols[0];
        const id = values[idColumn];
        const r = await fetch('/accounts/' + encodeURIComponent(id), { method: 'PUT', headers, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(await r.text());
      } else {
        const r = await fetch('/accounts', { method: 'POST', headers, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(await r.text());
      }
      panel.setAttribute('aria-hidden', 'true');
      await loadAccounts();
    } catch (e) {
      error.textContent = e.message || e;
      error.style.display = '';
    }
  };
  save.onclick = onSave;
  cancel.onclick = () => panel.setAttribute('aria-hidden', 'true');
  panel.onclick = (ev) => { if (ev.target === panel) panel.setAttribute('aria-hidden', 'true'); };
}

// add/edit/delete buttons inside accounts table
document.addEventListener('click', async (ev) => {
  if (ev.target && ev.target.classList.contains('acct-edit')) {
    const tr = ev.target.closest('tr');
    const cols = Array.from(document.querySelectorAll('#accounts-table thead th')).map(th=>th.textContent).filter(text => text !== 'إجراءات');
    const values = {};
    Array.from(tr.children).slice(0, cols.length).forEach((td,i)=> values[cols[i]] = td.textContent === 'NULL' ? null : td.textContent);
    openAccountModal('edit', cols, values);
  }
  if (ev.target && ev.target.classList.contains('acct-delete')) {
    if (!confirm('تأكيد الحذف؟')) return;
    const tr = ev.target.closest('tr');
    const cols = Array.from(document.querySelectorAll('#accounts-table thead th')).map(th=>th.textContent);
    const pk = cols.find(c=>/id$/i.test(c)) || cols[0];
    const id = tr.children[cols.indexOf(pk)].textContent;
    try {
      const auth = JSON.parse(localStorage.getItem('proacc_auth') || 'null');
      const headers = {};
      if (auth && auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
      const r = await fetch('/accounts/' + encodeURIComponent(id), { method: 'DELETE', headers });
      if (!r.ok) throw new Error(await r.text());
      await loadAccounts();
    } catch (e) {
      alert('حذف فشل: ' + (e.message||e));
    }
  }
  if (ev.target && ev.target.id === 'add-account') {
    // build cols from current table header if present, else fetch accounts to get columns
    let cols = Array.from(document.querySelectorAll('#accounts-table thead th')).map(th=>th.textContent).filter(text => text !== 'إجراءات');
    if (!cols || cols.length === 0) {
      // fetch accounts to populate
      await loadAccounts();
      cols = Array.from(document.querySelectorAll('#accounts-table thead th')).map(th=>th.textContent).filter(text => text !== 'إجراءات');
    }
    openAccountModal('add', cols, {});
  }
});
