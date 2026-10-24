(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const dt = t => new Date(t).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
  const PERM = { products: ['المنتجات', 'إضافة وتعديل وحذف المنتجات ورفع الصور'], orders: ['الطلبات', 'عرض الطلبات وتغيير حالتها'], users: ['المستخدمون', 'إنشاء وإدارة حسابات الأدمن وصلاحياتهم'], settings: ['إعدادات الموقع', 'تعديل النصوص ومعلومات السيرفر'] };
  const ST = { new: 'جديد', processing: 'قيد المعالجة', done: 'مكتمل', cancelled: 'ملغي' };
  let me = null, page = 'home', cache = {}, settings = {};

  async function api(path, method = 'GET', body) {
    const r = await fetch('/api/' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : (method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : (method !== 'GET' && method !== 'DELETE' ? '{}' : undefined) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && me) { me = null; render(); }
    if (!r.ok) throw new Error(d.error || 'حدث خطأ');
    return d;
  }
  function toast(m, t) { const e = document.createElement('div'); e.className = 'toast ' + (t || ''); e.textContent = m; $('#toasts').append(e); setTimeout(() => { e.style.transition = '.4s'; e.style.opacity = 0; setTimeout(() => e.remove(), 400); }, 3000); }
  const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, 'err'); } };
  const can = p => me && (me.role === 'owner' || me.perms.includes(p));

  /* ---------- modal ---------- */
  function openModal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.add('show'); $('#overlay').classList.add('show'); }
  function closeModal() { $('#modal').classList.remove('show'); $('#overlay').classList.remove('show'); }
  $('#overlay').onclick = closeModal; $('#modal').addEventListener('pointerdown', e => { if (e.target === $('#modal')) closeModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  function confirmBox(msg, ok) {
    openModal(`<h3>تأكيد</h3><p class="sub">${esc(msg)}</p><div style="display:flex;gap:10px"><button class="btn btn-danger" id="cYes" style="flex:1">نعم، متأكد</button><button class="btn btn-ghost" id="cNo">إلغاء</button></div>`);
    $('#cNo').onclick = closeModal; $('#cYes').onclick = guard(async () => { await ok(); closeModal(); });
  }

  /* ---------- boot / login ---------- */
  async function boot() { try { me = (await api('me')).user; } catch { me = null; } render(); }
  function render() {
    if (!me) return loginView();
    const nav = [['home', '📊', 'نظرة عامة', true], ['products', '🛍️', 'المنتجات', can('products')], ['orders', '📦', 'الطلبات', can('orders')], ['users', '👥', 'المستخدمون', can('users')], ['settings', '⚙️', 'إعدادات الموقع', can('settings')], ['account', '🔐', 'حسابي', true]].filter(n => n[3]);
    if (!nav.find(n => n[0] === page)) page = 'home';
    $('#root').innerHTML = `<div class="app">
      <aside class="side" id="side"><a class="brand" href="/"><img src="/logo.png" alt=""><b>Vice City</b></a>
        <nav>${nav.map(([k, i, t]) => `<button data-p="${k}" class="${k === page ? 'on' : ''}"><span>${i}</span>${t}<span class="nb hidden" id="nb-${k}"></span></button>`).join('')}</nav>
        <div class="me"><div><b>${esc(me.name)}</b><small>${me.role === 'owner' ? '👑 المالك' : 'أدمن'} · <bdi dir="ltr">@${esc(me.username)}</bdi></small></div>
          <div style="display:flex;gap:8px"><a class="btn btn-ghost btn-sm" href="/" style="flex:1">الموقع</a><button class="btn btn-danger btn-sm" id="logout">خروج</button></div></div></aside>
      <main class="main"><div class="mobile-top"><button class="icon-btn" id="sideBtn"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><b>لوحة التحكم</b></div><div id="view"></div></main></div>`;
    $('#side').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { page = b.dataset.p; $('#side').classList.remove('open'); render(); } };
    $('#sideBtn').onclick = () => $('#side').classList.toggle('open');
    $('#logout').onclick = guard(async () => { await api('logout', 'POST'); me = null; render(); });
    ({ home: homeView, products: productsView, orders: ordersView, users: usersView, settings: settingsView, account: accountView })[page]();
    if (can('orders')) api('admin/orders').then(o => { const n = o.filter(x => x.status === 'new').length, b = $('#nb-orders'); if (b && n) { b.textContent = n; b.classList.remove('hidden'); } }).catch(() => { });
  }
  function loginView() {
    $('#root').innerHTML = `<div class="login-wrap"><div class="card login" data-tilt="5"><div class="glare"></div><img src="/logo.png" alt=""><h1>لوحة تحكم Vice City</h1><p class="sub">سجّل الدخول لإدارة المتجر والموقع</p>
      <form id="lf"><div class="field"><label>اسم المستخدم</label><input name="u" required autocomplete="username" dir="ltr" autofocus></div>
      <div class="field"><label>كلمة المرور</label><input name="p" type="password" required autocomplete="current-password" dir="ltr"></div>
      <div class="msg-err" id="le"></div><button class="btn btn-primary" style="width:100%" data-magnetic>دخول</button></form></div></div>`;
    $('#lf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), b = e.target.querySelector('button'); b.disabled = true;
      try { me = (await api('login', 'POST', { username: f.get('u'), password: f.get('p') })).user; page = 'home'; render(); }
      catch (er) { $('#le').textContent = er.message; b.disabled = false; }
    };
  }
  const head = (t, extra = '') => `<div class="topbar"><h2>${t}</h2><div>${extra}</div></div>`;

  /* ---------- home ---------- */
  async function homeView() {
    $('#view').innerHTML = head('نظرة عامة') + '<div class="kpis" id="kp"></div><div id="rc"></div>';
    const o = await api('admin/overview').catch(() => ({}));
    const k = []; if (o.products != null) k.push(['المنتجات', o.products]); if (o.ordersNew != null) k.push(['طلبات جديدة', o.ordersNew], ['كل الطلبات', o.ordersTotal], ['إيرادات مكتملة', num(o.revenue)]); if (o.users != null) k.push(['الحسابات', o.users]);
    $('#kp').innerHTML = k.map(([t, v]) => `<div class="card kpi" data-tilt="8"><div class="glare"></div><small>${t}</small><b>${v}</b></div>`).join('');
    if (o.recent) $('#rc').innerHTML = `<div class="card panel-box"><h3>آخر الطلبات</h3>${o.recent.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${o.recent.map(r => `<tr><td>${r.number}</td><td>${esc(r.customer.name)}</td><td>${num(r.total)}</td><td><span class="st ${r.status}">${ST[r.status]}</span></td><td>${dt(r.createdAt)}</td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--mut)">لا توجد طلبات بعد.</p>'}</div>`;
    FX.observe();
  }

  /* ---------- products ---------- */
  async function productsView() {
    $('#view').innerHTML = head('المنتجات', '<button class="btn btn-primary" id="addP" data-magnetic>+ منتج جديد</button>') + '<div class="card panel-box"><div id="pt"></div></div>';
    $('#addP').onclick = () => productForm();
    const list = cache.products = await api('admin/products');
    $('#pt').innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>الصورة</th><th>الاسم</th><th>القسم</th><th>السعر</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map(p => `<tr>
      <td>${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="" referrerpolicy="no-referrer">` : '<img class="thumb" src="/logo.png" style="padding:10px;opacity:.5" alt="">'}</td>
      <td><b>${esc(p.name)}</b>${p.featured ? ' ⭐' : ''}<div style="color:var(--mut);font-size:.85rem;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.description)}</div></td>
      <td>${esc(p.category)}</td><td>${num(p.price)}</td><td><span class="st ${p.active ? 'on' : 'off'}">${p.active ? 'ظاهر' : 'مخفي'}</span></td>
      <td><div class="acts"><button class="btn btn-ghost btn-sm" data-e="${p.id}">تعديل</button><button class="btn btn-danger btn-sm" data-d="${p.id}">حذف</button></div></td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--mut);text-align:center;padding:30px">لا توجد منتجات. اضغط "منتج جديد" للبدء.</p>';
    $('#pt').onclick = e => {
      const ed = e.target.closest('[data-e]'), de = e.target.closest('[data-d]');
      if (ed) productForm(list.find(p => p.id === ed.dataset.e));
      if (de) confirmBox('حذف هذا المنتج نهائياً؟', async () => { await api('admin/products/' + de.dataset.d, 'DELETE'); toast('تم الحذف', 'ok'); productsView(); });
    };
  }
  function productForm(p) {
    const isNew = !p; p = p || { name: '', description: '', price: '', category: 'عام', image: '', active: true, featured: false };
    const cats = [...new Set((cache.products || []).map(x => x.category))];
    let img = p.image;
    openModal(`<h3>${isNew ? 'منتج جديد' : 'تعديل المنتج'}</h3><p class="sub">أدخل بيانات المنتج وصورته.</p>
      <form id="pf"><div class="field"><label>صورة المنتج</label>
        <label class="uploader" id="up"><div id="upv">${img ? `<img src="${esc(img)}" alt="">` : '📷 اسحب صورة هنا أو اضغط للاختيار<br><small>PNG / JPG / WEBP / GIF — حتى 4MB</small>'}</div><input type="file" id="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
        <input id="imgUrl" placeholder="أو الصق رابط صورة (https://...)" dir="ltr" value="${img && img.startsWith('https') ? esc(img) : ''}"></div>
      <div class="field"><label>اسم المنتج *</label><input name="name" required maxlength="80" value="${esc(p.name)}"></div>
      <div class="field"><label>الشرح</label><textarea name="description" maxlength="1200">${esc(p.description)}</textarea></div>
      <div class="row"><div class="field"><label>السعر *</label><input name="price" type="number" min="0" step="0.01" required value="${esc(p.price)}" dir="ltr"></div>
      <div class="field"><label>القسم</label><input name="category" list="cl" maxlength="30" value="${esc(p.category)}"><datalist id="cl">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
      <div style="display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap"><label class="switch"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><i></i>ظاهر في المتجر</label><label class="switch"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}><i></i>منتج مميّز ⭐</label></div>
      <div class="msg-err" id="pe"></div><div style="display:flex;gap:10px"><button class="btn btn-primary" style="flex:1">حفظ</button><button type="button" class="btn btn-ghost" id="pc">إلغاء</button></div></form>`);
    $('#pc').onclick = closeModal;
    const show = () => { $('#upv').innerHTML = img ? `<img src="${esc(img)}" alt="">` : '📷 اسحب صورة هنا أو اضغط للاختيار'; };
    const upload = file => new Promise((ok, no) => {
      if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return no(new Error('صيغة الصورة غير مدعومة'));
      if (file.size > 4e6) return no(new Error('الصورة أكبر من 4MB'));
      const fr = new FileReader(); fr.onload = () => api('admin/upload', 'POST', { dataUrl: fr.result }).then(d => ok(d.url), no); fr.onerror = () => no(new Error('تعذّرت قراءة الملف')); fr.readAsDataURL(file);
    });
    const pick = guard(async f => { $('#upv').textContent = 'جاري الرفع...'; try { img = await upload(f); $('#imgUrl').value = ''; show(); } catch (e) { show(); throw e; } });
    $('#file').onchange = e => pick(e.target.files[0]);
    const up = $('#up'); ['dragover', 'dragenter'].forEach(ev => up.addEventListener(ev, e => { e.preventDefault(); up.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => up.addEventListener(ev, e => { e.preventDefault(); up.classList.remove('drag'); }));
    up.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
    $('#imgUrl').oninput = e => { const v = e.target.value.trim(); if (/^https:\/\//.test(v)) { img = v; show(); } else if (!v) { img = ''; show(); } };
    $('#pf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      const body = { name: f.get('name'), description: f.get('description'), price: f.get('price'), category: f.get('category'), image: img, active: f.has('active'), featured: f.has('featured') };
      try { await api('admin/products' + (isNew ? '' : '/' + p.id), isNew ? 'POST' : 'PUT', body); closeModal(); toast('تم الحفظ ✓', 'ok'); productsView(); } catch (er) { $('#pe').textContent = er.message; }
    };
  }

  /* ---------- orders ---------- */
  async function ordersView() {
    $('#view').innerHTML = head('الطلبات', `<select id="sf" class="field" style="padding:9px 14px;border-radius:12px;background:var(--card);border:1px solid var(--line)"><option value="">كل الحالات</option>${Object.entries(ST).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`) + '<div id="ol"></div>';
    const all = await api('admin/orders');
    const draw = () => {
      const f = $('#sf').value, L = all.filter(o => !f || o.status === f);
      $('#ol').innerHTML = L.length ? L.map(o => `<div class="card order-card"><div class="oh"><b>طلب #${o.number}</b><span class="st ${o.status}">${ST[o.status]}</span></div>
        <div class="meta"><span>👤 ${esc(o.customer.name)}</span><span dir="ltr">💬 ${esc(o.customer.discord)}</span>${o.customer.gameId ? `<span dir="ltr">🎮 ${esc(o.customer.gameId)}</span>` : ''}<span>🕒 ${dt(o.createdAt)}</span></div>
        <div class="order-items">${o.items.map(i => `<div>• ${esc(i.name)} × ${i.qty} — ${num(i.price * i.qty)}</div>`).join('')}</div>
        ${o.note ? `<p style="margin-top:8px;color:var(--mut)">📝 ${esc(o.note)}</p>` : ''}
        <div class="oh" style="margin:12px 0 0"><b>الإجمالي: ${num(o.total)}</b><div class="acts">${Object.entries(ST).filter(([k]) => k !== o.status).map(([k, v]) => `<button class="btn btn-ghost btn-sm" data-o="${o.id}" data-s="${k}">${v}</button>`).join('')}<button class="btn btn-danger btn-sm" data-x="${o.id}">حذف</button></div></div></div>`).join('') : '<div class="card panel-box" style="text-align:center;color:var(--mut)">لا توجد طلبات.</div>';
    };
    draw(); $('#sf').onchange = draw;
    $('#ol').onclick = e => {
      const s = e.target.closest('[data-s]'), x = e.target.closest('[data-x]');
      if (s) guard(async () => { await api('admin/orders/' + s.dataset.o, 'PUT', { status: s.dataset.s }); ordersView(); })();
      if (x) confirmBox('حذف الطلب نهائياً؟', async () => { await api('admin/orders/' + x.dataset.x, 'DELETE'); ordersView(); });
    };
  }

  /* ---------- users ---------- */
  function permsHtml(sel) {
    return `<div class="perms">${Object.entries(PERM).filter(([k]) => can(k)).map(([k, [t, d]]) => `<label class="perm switch"><input type="checkbox" name="perm" value="${k}" ${sel.includes(k) ? 'checked' : ''}><i></i><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>`;
  }
  async function usersView() {
    $('#view').innerHTML = head('المستخدمون والصلاحيات', '<button class="btn btn-primary" id="addU" data-magnetic>+ حساب أدمن</button>') + '<div class="card panel-box"><div id="ut"></div></div>';
    $('#addU').onclick = () => userForm();
    const list = await api('admin/users');
    $('#ut').innerHTML = `<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الصلاحيات</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map(u => `<tr><td><b>${esc(u.name)}</b></td><td dir="ltr" style="text-align:right">@${esc(u.username)}</td><td>${u.role === 'owner' ? '👑 مالك' : 'أدمن'}</td>
      <td>${u.role === 'owner' ? 'كل الصلاحيات' : (u.perms.map(p => PERM[p][0]).join('، ') || '—')}</td><td><span class="st ${u.disabled ? 'off' : 'on'}">${u.disabled ? 'موقوف' : 'نشط'}</span></td>
      <td>${u.role === 'owner' ? '' : `<div class="acts"><button class="btn btn-ghost btn-sm" data-e="${u.id}">تعديل</button><button class="btn btn-danger btn-sm" data-d="${u.id}">حذف</button></div>`}</td></tr>`).join('')}</tbody></table></div>`;
    $('#ut').onclick = e => {
      const ed = e.target.closest('[data-e]'), de = e.target.closest('[data-d]');
      if (ed) userForm(list.find(u => u.id === ed.dataset.e));
      if (de) confirmBox('حذف هذا الحساب نهائياً؟', async () => { await api('admin/users/' + de.dataset.d, 'DELETE'); toast('تم الحذف', 'ok'); usersView(); });
    };
  }
  function userForm(u) {
    const isNew = !u; u = u || { name: '', username: '', perms: [], disabled: false };
    openModal(`<h3>${isNew ? 'حساب أدمن جديد' : 'تعديل: ' + esc(u.name)}</h3><p class="sub">حدّد ما يستطيع هذا الحساب فعله داخل اللوحة. لا يمكنك منح صلاحية لا تملكها.</p>
      <form id="uf">${isNew ? `<div class="field"><label>اسم المستخدم (إنجليزي) *</label><input name="username" required pattern="[A-Za-z0-9_.\\-]{3,24}" dir="ltr" autocomplete="off"></div>` : ''}
      <div class="field"><label>الاسم الظاهر *</label><input name="name" required maxlength="40" value="${esc(u.name)}"></div>
      <div class="field"><label>${isNew ? 'كلمة المرور * (8 أحرف فأكثر)' : 'كلمة مرور جديدة (اتركها فارغة بدون تغيير)'}</label><input name="password" type="password" ${isNew ? 'required' : ''} minlength="8" dir="ltr" autocomplete="new-password"></div>
      <div class="field"><label>الصلاحيات</label>${permsHtml(u.perms)}</div>
      ${isNew ? '' : `<label class="switch" style="margin-bottom:16px"><input type="checkbox" name="disabled" ${u.disabled ? 'checked' : ''}><i></i>إيقاف الحساب</label>`}
      <div class="msg-err" id="ue"></div><div style="display:flex;gap:10px"><button class="btn btn-primary" style="flex:1">حفظ</button><button type="button" class="btn btn-ghost" id="uc">إلغاء</button></div></form>`);
    $('#uc').onclick = closeModal;
    $('#uf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), perms = f.getAll('perm');
      const body = { name: f.get('name'), perms };
      if (isNew) { body.username = f.get('username'); body.password = f.get('password'); } else { body.disabled = f.has('disabled'); if (f.get('password')) body.password = f.get('password'); }
      try { await api('admin/users' + (isNew ? '' : '/' + u.id), isNew ? 'POST' : 'PUT', body); closeModal(); toast('تم الحفظ ✓', 'ok'); usersView(); } catch (er) { $('#ue').textContent = er.message; }
    };
  }

  /* ---------- settings ---------- */
  async function settingsView() {
    $('#view').innerHTML = head('إعدادات الموقع') + '<div class="card panel-box"><form id="sf2"></form></div>';
    settings = await api('admin/settings');
    const F = (k, l, ta, ph, ltr) => `<div class="field"><label>${l}</label>${ta ? `<textarea name="${k}" placeholder="${esc(ph || '')}">${esc(settings[k])}</textarea>` : `<input name="${k}" value="${esc(settings[k])}" placeholder="${esc(ph || '')}" ${ltr ? 'dir="ltr"' : ''}>`}</div>`;
    $('#sf2').innerHTML = `<div class="row">${F('serverName', 'اسم السيرفر')}${F('currency', 'رمز العملة')}</div>${F('tagline', 'الشعار النصي (يظهر في الواجهة)')}${F('about', 'نبذة عن السيرفر', 1)}
      <div class="row">${F('discord', 'رابط الديسكورد (https://...)', 0, 'https://discord.gg/...', 1)}${F('connectIp', 'عنوان الاتصال بالسيرفر', 0, 'connect 1.2.3.4', 1)}</div>
      ${F('checkoutNote', 'ملاحظة تظهر عند إتمام الطلب', 1)}${F('stats', 'الإحصائيات (سطر لكل رقم بصيغة: الرقم|الوصف)', 1, '25|عضو')}
      <button class="btn btn-primary" data-magnetic>حفظ الإعدادات</button>`;
    $('#sf2').onsubmit = guard(async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); await api('admin/settings', 'PUT', f); toast('تم حفظ الإعدادات ✓', 'ok'); });
  }

  /* ---------- account ---------- */
  function accountView() {
    $('#view').innerHTML = head('حسابي') + `<div class="card panel-box" style="max-width:520px"><h3>تغيير كلمة المرور</h3><form id="pw">
      <div class="field"><label>كلمة المرور الحالية</label><input name="c" type="password" required dir="ltr" autocomplete="current-password"></div>
      <div class="field"><label>كلمة المرور الجديدة (8 أحرف فأكثر)</label><input name="n" type="password" required minlength="8" dir="ltr" autocomplete="new-password"></div>
      <div class="msg-err" id="pe2"></div><button class="btn btn-primary">تحديث</button></form></div>`;
    $('#pw').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      try { await api('me/password', 'POST', { current: f.get('c'), next: f.get('n') }); e.target.reset(); $('#pe2').textContent = ''; toast('تم تغيير كلمة المرور ✓', 'ok'); } catch (er) { $('#pe2').textContent = er.message; }
    };
  }

  boot();
})();
