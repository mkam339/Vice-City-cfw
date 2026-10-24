(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  let S = {}, products = [], cat = 'الكل', term = '', cart = {};
  const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
  cart = LS.get('vc_cart', {});

  function toast(msg, type) {
    const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; $('#toasts').append(t);
    setTimeout(() => { t.style.transition = '.4s'; t.style.opacity = 0; setTimeout(() => t.remove(), 400); }, 2800);
  }

  /* ---------- header ---------- */
  const nav = $('#nav');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 30), { passive: true });
  $('#burger').onclick = () => $('#links').classList.toggle('open');
  $('#links').addEventListener('click', e => { if (e.target.tagName === 'A') $('#links').classList.remove('open'); });
  const secs = ['home', 'about', 'store', 'rules'].map(id => document.getElementById(id));
  addEventListener('scroll', () => {
    let cur = 'home'; for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * .4) cur = s.id;
    document.querySelectorAll('.links a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
  }, { passive: true });
  $('#yr').textContent = new Date().getFullYear();

  /* ---------- load ---------- */
  async function load() {
    try {
      const r = await fetch('/api/public'); const d = await r.json(); S = d.settings; products = d.products;
    } catch { toast('تعذّر تحميل البيانات', 'err'); }
    applySettings(); buildCats(); renderProducts(); renderCart();
  }
  function applySettings() {
    document.querySelectorAll('.s-name').forEach(e => e.textContent = S.serverName || 'Vice City');
    document.title = (S.serverName || 'Vice City') + ' — سيرفر رول بلاي عربي';
    $('#tagline').textContent = S.tagline || ''; $('#aboutText').textContent = S.about || '';
    if (S.discord && /^https:\/\//.test(S.discord)) { const b = $('#discordBtn'); b.href = S.discord; b.classList.remove('hidden'); }
    if (S.connectIp) { $('#ipText').textContent = S.connectIp; $('#ipChip').classList.remove('hidden'); }
    const st = (S.stats || '').split('\n').map(l => l.split('|')).filter(a => a.length >= 2 && a[1].trim());
    $('#stats').innerHTML = st.map(([n, l]) => { const v = parseFloat(n); return `<div class="card stat reveal" data-tilt="6"><div class="glare"></div><b ${isFinite(v) ? `data-count="${v}"` : ''}>${esc(n.trim())}</b><span>${esc(l.trim())}</span></div>`; }).join('');
    FX.observe();
  }
  $('#ipChip').onclick = () => { navigator.clipboard?.writeText(S.connectIp).then(() => toast('تم نسخ عنوان الاتصال ✓', 'ok'), () => { }); };

  const FEATS = [
    ['🕶️', 'عصابات ومنظمات', 'أنشئ منظمتك، وسّع نفوذك، وادخل في نزاعات وحروب منظمة بقوانين واضحة وعادلة.'],
    ['🚓', 'شرطة ونظام قضائي', 'قطاع أمني متكامل: مداهمات بأوامر رسمية، تفاوض، محاكم وأحكام وفق أنظمة معتمدة.'],
    ['💼', 'اقتصاد ووظائف', 'وظائف متنوعة وسرقات ومهام وأعمال حرة تبني بها شخصيتك وثروتك داخل المدينة.'],
    ['🎭', 'رول بلاي واقعي', 'قوانين NLR وRDM وVDM والميتا جيمنج تحمي القصة وتحافظ على واقعية كل موقف.'],
    ['🛡️', 'إدارة عادلة', 'الشكاوى تُراجَع بالأدلة المصوّرة والصوت، والقرارات مبنية على القوانين لا على الأهواء.'],
    ['🛒', 'متجر رسمي', 'باقات وخدمات تدعم استمرار السيرفر وتطوره، مع طلب سريع وتسليم عبر الإدارة.']
  ];
  $('#features').innerHTML = FEATS.map(([i, t, d]) => `<div class="card feat reveal" data-tilt="9"><div class="glare"></div><div class="ico">${i}</div><h3>${t}</h3><p>${d}</p></div>`).join('');

  /* ---------- store ---------- */
  function buildCats() {
    const cats = ['الكل', ...new Set(products.map(p => p.category))];
    if (!cats.includes(cat)) cat = 'الكل';
    $('#cats').innerHTML = cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  }
  $('#cats').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c; buildCats(); renderProducts(); };
  $('#q').oninput = e => { term = e.target.value.trim().toLowerCase(); renderProducts(); };
  function thumb(p) { return p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer">` : `<div class="ph"><img src="/logo.png" alt=""></div>`; }
  function renderProducts() {
    const list = products.filter(p => (cat === 'الكل' || p.category === cat) && (!term || (p.name + ' ' + p.description).toLowerCase().includes(term)));
    $('#products').innerHTML = list.length ? list.map(p => `
      <article class="card prod reveal" data-tilt="7"><div class="glare"></div>
        <div class="img">${thumb(p)}<span class="tag">${esc(p.category)}</span>${p.featured ? '<span class="tag feat-tag">⭐ مميّز</span>' : ''}</div>
        <div class="body"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>
          <div class="foot"><div class="price">${num(p.price)}<small>${esc(S.currency || '')}</small></div><button class="btn btn-primary btn-sm" data-add="${esc(p.id)}">+ أضف للسلة</button></div></div>
      </article>`).join('') : '<div class="empty">لا توجد منتجات مطابقة حالياً.</div>';
    FX.observe($('#products'));
  }
  $('#products').onclick = e => { const b = e.target.closest('[data-add]'); if (!b) return; add(b.dataset.add); };

  /* ---------- cart ---------- */
  const save = () => LS.set('vc_cart', cart);
  function add(id, d = 1) {
    if (!products.find(p => p.id === id)) return;
    cart[id] = Math.max(0, Math.min(99, (cart[id] || 0) + d)); if (!cart[id]) delete cart[id];
    save(); renderCart(); if (d > 0) toast('أضيف إلى السلة ✓', 'ok');
  }
  function lines() { return Object.entries(cart).map(([id, q]) => ({ p: products.find(x => x.id === id), q })).filter(l => l.p); }
  function renderCart() {
    for (const id of Object.keys(cart)) if (!products.find(p => p.id === id)) delete cart[id];
    const L = lines(), count = L.reduce((a, l) => a + l.q, 0), total = L.reduce((a, l) => a + l.q * l.p.price, 0);
    const bc = $('#cartCount'); bc.textContent = count; bc.classList.toggle('hidden', !count);
    $('#cartTotal').textContent = num(total) + ' ' + (S.currency || '');
    $('#checkoutBtn').disabled = !count;
    $('#cartItems').innerHTML = L.length ? L.map(({ p, q }) => `
      <div class="ci"><div class="th">${p.image ? `<img src="${esc(p.image)}" alt="" referrerpolicy="no-referrer">` : '<img class="ph" src="/logo.png" alt="">'}</div>
        <div class="m"><b>${esc(p.name)}</b><span>${num(p.price)} ${esc(S.currency || '')}</span>
          <div class="qty"><button data-d="1" data-id="${esc(p.id)}">+</button><span>${q}</span><button data-d="-1" data-id="${esc(p.id)}">−</button></div></div>
        <button class="icon-btn" data-rm="${esc(p.id)}" aria-label="حذف"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/></svg></button></div>`).join('')
      : '<div class="empty" style="grid-column:auto">السلة فارغة 🛒</div>';
  }
  $('#cartItems').onclick = e => {
    const q = e.target.closest('[data-d]'), r = e.target.closest('[data-rm]');
    if (q) add(q.dataset.id, +q.dataset.d); if (r) { delete cart[r.dataset.rm]; save(); renderCart(); }
  };
  const openCart = v => { $('#drawer').classList.toggle('show', v); $('#overlay').classList.toggle('show', v); };
  $('#cartBtn').onclick = () => openCart(true); $('#closeCart').onclick = () => openCart(false);
  $('#overlay').onclick = () => { openCart(false); closeModal(); };
  addEventListener('keydown', e => { if (e.key === 'Escape') { openCart(false); closeModal(); } });

  /* ---------- checkout ---------- */
  function closeModal() { $('#modal').classList.remove('show'); if (!$('#drawer').classList.contains('show')) $('#overlay').classList.remove('show'); }
  $('#modal').addEventListener('pointerdown', e => { if (e.target === $('#modal')) closeModal(); });
  $('#checkoutBtn').onclick = () => {
    const L = lines(); if (!L.length) return;
    const total = L.reduce((a, l) => a + l.q * l.p.price, 0), saved = LS.get('vc_cust', {});
    $('#modalBox').innerHTML = `<h3>إتمام الطلب</h3><p class="sub">${esc(S.checkoutNote || '')}</p>
      <form id="ckForm" autocomplete="off">
        <div class="row"><div class="field"><label>اسمك *</label><input name="name" required maxlength="60" value="${esc(saved.name || '')}"></div>
        <div class="field"><label>يوزر الديسكورد *</label><input name="discord" required maxlength="60" value="${esc(saved.discord || '')}" dir="ltr"></div></div>
        <div class="field"><label>رقم الهوية داخل اللعبة (اختياري)</label><input name="gameId" maxlength="40" value="${esc(saved.gameId || '')}" dir="ltr"></div>
        <div class="field"><label>ملاحظات (اختياري)</label><textarea name="note" maxlength="400"></textarea></div>
        <div class="tot" style="display:flex;justify-content:space-between;font-weight:900;font-size:1.15rem;margin-bottom:14px"><span>الإجمالي (${L.length} منتج)</span><span>${num(total)} ${esc(S.currency || '')}</span></div>
        <div class="msg-err" id="ckErr"></div>
        <div style="display:flex;gap:10px"><button class="btn btn-primary" style="flex:1" type="submit">تأكيد الطلب</button><button class="btn btn-ghost" type="button" id="ckCancel">إلغاء</button></div>
      </form>`;
    $('#modal').classList.add('show'); $('#overlay').classList.add('show');
    $('#ckCancel').onclick = closeModal;
    $('#ckForm').onsubmit = async ev => {
      ev.preventDefault(); const f = new FormData(ev.target), btn = ev.target.querySelector('[type=submit]'); btn.disabled = true;
      const body = { name: f.get('name'), discord: f.get('discord'), gameId: f.get('gameId'), note: f.get('note'), items: Object.entries(cart).map(([id, qty]) => ({ id, qty })) };
      try {
        const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), d = await r.json();
        if (!r.ok) throw new Error(d.error || 'حدث خطأ');
        LS.set('vc_cust', { name: body.name, discord: body.discord, gameId: body.gameId }); cart = {}; save(); renderCart(); openCart(false);
        $('#modalBox').innerHTML = `<div class="success"><div class="big">✓</div><h3>تم استلام طلبك!</h3><p class="sub">رقم طلبك: <b style="color:#f0abfc">#${d.number}</b><br>احتفظ بالرقم وسيتواصل معك فريق الإدارة قريباً عبر الديسكورد.</p><button class="btn btn-primary" id="okBtn">تمام</button></div>`;
        $('#okBtn').onclick = closeModal;
      } catch (er) { $('#ckErr').textContent = er.message; btn.disabled = false; }
    };
  };

  /* ---------- rules ---------- */
  let R = {}, tab = 'basic', rterm = '', allOpen = false;
  fetch('/rules.json').then(r => r.json()).then(d => { R = d; buildTabs(); renderRules(); }).catch(() => { $('#ruleList').innerHTML = '<div class="empty">تعذّر تحميل القوانين</div>'; });
  function buildTabs() {
    $('#tabs').innerHTML = Object.entries(R).map(([k, v]) => `<button class="tab ${k === tab ? 'on' : ''}" data-t="${k}">${esc(v.title)}</button>`).join('');
  }
  $('#tabs').onclick = e => { const b = e.target.closest('.tab'); if (!b) return; tab = b.dataset.t; buildTabs(); renderRules(); };
  $('#rq').oninput = e => { rterm = e.target.value.trim(); renderRules(); };
  const norm = s => s.replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
  function hl(text) {
    const t = esc(text); if (!rterm) return t;
    const nt = norm(text), nq = norm(rterm); if (!nq || nt.length !== text.length) { return t; }
    let out = '', i = 0, j;
    while ((j = nt.indexOf(nq, i)) >= 0) { out += esc(text.slice(i, j)) + '<span class="hl">' + esc(text.slice(j, j + nq.length)) + '</span>'; i = j + nq.length; }
    return out + esc(text.slice(i));
  }
  function renderRules() {
    const match = it => norm([it.title, ...it.body].join(' ')).includes(norm(rterm));
    const src = rterm ? Object.entries(R).flatMap(([k, v]) => v.items.filter(match).map(it => ({ it, sec: v.title }))) : (R[tab]?.items || []).map(it => ({ it, sec: '' }));
    $('#ruleList').innerHTML = src.length ? src.map(({ it, sec }) => {
      const flat = !it.title && it.body.length === 1, secTag = sec ? `<small style="color:var(--p3);font-weight:800">${esc(sec)}</small>` : '';
      if (flat) return `<div class="card rule flat"><button class="head" tabindex="-1"><span class="num">${esc(it.n)}</span><span class="t">${secTag}${hl(it.body[0])}</span></button></div>`;
      const first = it.title || it.body[0] || '';
      return `<div class="card rule ${allOpen || rterm ? 'open' : ''}"><button class="head"><span class="num">${esc(it.n)}</span>
        <span class="t">${secTag}${it.title ? hl(it.title) : hl(first.length > 90 ? first.slice(0, 90) + '…' : first)}${it.title ? `<small class="pv">${esc(it.body[0] || '')}</small>` : ''}</span>
        <svg class="chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="panel"><div><div class="in">${it.body.map(b => `<p>${hl(b)}</p>`).join('')}</div></div></div></div>`;
    }).join('') : '<div class="empty">لا توجد نتائج مطابقة.</div>';
    $('#toggleAll').textContent = allOpen ? 'إغلاق الكل' : 'فتح الكل';
    $('#tabs').classList.toggle('hidden', !!rterm);
  }
  $('#ruleList').onclick = e => { const h = e.target.closest('.head'); if (h && !h.parentElement.classList.contains('flat')) h.parentElement.classList.toggle('open'); };
  $('#toggleAll').onclick = () => { allOpen = !allOpen; document.querySelectorAll('#ruleList .rule').forEach(r => r.classList.toggle('open', allOpen)); $('#toggleAll').textContent = allOpen ? 'إغلاق الكل' : 'فتح الكل'; };

  load();
})();
