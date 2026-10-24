'use strict';
/* Vice City — خادم المتجر والموقع (بدون أي مكتبات خارجية) — تشغيل: node server.js */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const PUB = __dirname; /* كل الملفات في نفس المجلد (بدون مجلدات فرعية) */
const DB_FILE = path.join(__dirname, 'db.json');
const PUBLIC_FILES = new Set(['index.html', 'admin.html', 'app.js', 'admin.js', 'fx.js', 'style.css', 'rules.json', 'logo.png']);
const UPLOAD_RE = /^up-[a-f0-9]+\.(png|jpg|webp|gif)$/;
const PERMS = ['products', 'orders', 'users', 'settings'];
const STATUSES = ['new', 'processing', 'done', 'cancelled'];
const uid = () => crypto.randomBytes(8).toString('hex');

/* ---------- كلمات المرور ---------- */
function hash(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function verify(pw, stored) {
  const [s, h] = stored.split(':');
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, s, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const DUMMY = hash('dummy-password');

/* ---------- قاعدة البيانات (ملف JSON) ---------- */
let db;
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function init() {
  if (fs.existsSync(DB_FILE)) { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); return; }
  const pw = process.env.OWNER_PASSWORD || crypto.randomBytes(7).toString('base64url');
  const now = Date.now();
  db = {
    settings: {
      serverName: 'Vice City',
      tagline: 'مدينة لا تنام… رول بلاي عربي بمستوى آخر',
      about: 'Vice City سيرفر رول بلاي عربي يقدّم تجربة واقعية متكاملة: عصابات ومنظمات، شرطة ونظام قضائي، وظائف واقتصاد، وإدارة تتابع كل صغيرة وكبيرة لتبقى التجربة عادلة وممتعة للجميع.',
      discord: '',
      connectIp: '',
      currency: 'ر.س',
      checkoutNote: 'بعد إرسال الطلب سيتواصل معك فريق الإدارة عبر الديسكورد الرسمي لإتمام الدفع والتسليم.',
      stats: '25|أقصى عدد لأعضاء العصابة\n3|الحد الأقصى للرهائن\n15|دقيقة مدة الرهن'
    },
    users: [{ id: uid(), username: 'owner', name: 'المالك', role: 'owner', perms: PERMS.slice(), disabled: false, password: hash(pw), createdAt: now }],
    products: [
      { id: uid(), name: 'باقة VIP برونزية', description: 'منتج تجريبي — احذفه أو عدّله من لوحة التحكم.', price: 25, category: 'باقات', image: '', active: true, featured: true, createdAt: now },
      { id: uid(), name: 'باقة VIP ذهبية', description: 'منتج تجريبي — احذفه أو عدّله من لوحة التحكم.', price: 60, category: 'باقات', image: '', active: true, featured: true, createdAt: now + 1 },
      { id: uid(), name: 'تغيير الاسم', description: 'منتج تجريبي — احذفه أو عدّله من لوحة التحكم.', price: 15, category: 'خدمات', image: '', active: true, featured: false, createdAt: now + 2 }
    ],
    orders: []
  };
  save();
  console.log('\n==============================================');
  console.log(' تم إنشاء حساب المالك لأول مرة');
  console.log('  اسم المستخدم : owner');
  console.log('  كلمة المرور  : ' + pw);
  console.log(' غيّر كلمة المرور فوراً من لوحة التحكم > حسابي');
  console.log('==============================================\n');
}
init();

/* ---------- أدوات ---------- */
const err = (status, message) => Object.assign(new Error(message), { status });
const str = (v, max, req) => {
  v = typeof v === 'string' ? v.trim() : '';
  if (req && !v) throw err(400, 'حقل مطلوب ناقص');
  return v.slice(0, max);
};
const has = (u, p) => u.role === 'owner' || (u.perms || []).includes(p);
const pub = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, perms: u.role === 'owner' ? PERMS : u.perms, disabled: !!u.disabled, createdAt: u.createdAt });
function json(res, code, obj, headers = {}) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(b);
}
function readBody(req, limit = 8e6) {
  return new Promise((ok, no) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { no(err(413, 'الحجم كبير جداً')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { no(err(400, 'بيانات غير صالحة')); } });
    req.on('error', no);
  });
}
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(a => a[0]).map(a => [a[0], a.slice(1).join('=')]));
const sessions = new Map();
function getUser(req) {
  const t = cookies(req).vc_sid, s = t && sessions.get(t);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(t); return null; }
  const u = db.users.find(x => x.id === s.uid);
  if (!u || u.disabled) { sessions.delete(t); return null; }
  return u;
}
const hits = new Map();
function limit(key, max, ms) {
  const now = Date.now(); let h = hits.get(key);
  if (!h || h.reset < now) h = { n: 0, reset: now + ms };
  h.n++; hits.set(key, h);
  if (h.n > max) throw err(429, 'محاولات كثيرة، حاول لاحقاً');
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.reset < n) hits.delete(k); for (const [k, v] of sessions) if (v.exp < n) sessions.delete(k); }, 6e5).unref();

const okImage = v => { v = typeof v === 'string' ? v.trim() : ''; return /^\/up-[a-f0-9]+\.(png|jpg|webp|gif)$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v) ? v.slice(0, 500) : ''; };
function cleanProduct(b) {
  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0 || price > 1e6) throw err(400, 'السعر غير صحيح');
  return {
    name: str(b.name, 80, true), description: str(b.description, 1200), price: Math.round(price * 100) / 100,
    category: str(b.category, 30) || 'عام', image: okImage(b.image), active: b.active !== false, featured: !!b.featured
  };
}
function cleanPerms(list, creator) {
  return (Array.isArray(list) ? list : []).filter(p => PERMS.includes(p) && has(creator, p)).filter((p, i, a) => a.indexOf(p) === i);
}
const SET_KEYS = { serverName: 40, tagline: 160, about: 1500, discord: 200, connectIp: 80, currency: 12, checkoutNote: 400, stats: 400 };

/* ---------- الـ API ---------- */
async function api(req, res, p) {
  const m = req.method;
  if (m !== 'GET') {
    if (!/application\/json/.test(req.headers['content-type'] || '')) throw err(415, 'نوع غير مدعوم');
    const o = req.headers.origin; if (o && new URL(o).host !== req.headers.host) throw err(403, 'طلب مرفوض');
  }
  const body = m === 'GET' || m === 'DELETE' ? {} : await readBody(req);
  const user = getUser(req);
  const need = perm => { if (!user) throw err(401, 'يجب تسجيل الدخول'); if (perm && !has(user, perm)) throw err(403, 'لا تملك صلاحية لهذا الإجراء'); return user; };
  const ip = req.socket.remoteAddress || '';

  if (p === '/api/public' && m === 'GET') {
    return json(res, 200, { settings: db.settings, products: db.products.filter(x => x.active).sort((a, b) => (b.featured - a.featured) || b.createdAt - a.createdAt) });
  }
  if (p === '/api/orders' && m === 'POST') {
    limit('ord:' + ip, 6, 6e5);
    const items = [];
    for (const it of (Array.isArray(body.items) ? body.items : []).slice(0, 40)) {
      const pr = db.products.find(x => x.id === it.id && x.active); const qty = Math.floor(+it.qty);
      if (!pr || !(qty >= 1 && qty <= 99)) continue;
      items.push({ id: pr.id, name: pr.name, price: pr.price, qty });
    }
    if (!items.length) throw err(400, 'السلة فارغة');
    const order = {
      id: uid(), number: (db.orders.reduce((a, o) => Math.max(a, o.number || 0), 1000)) + 1, createdAt: Date.now(), status: 'new',
      customer: { name: str(body.name, 60, true), discord: str(body.discord, 60, true), gameId: str(body.gameId, 40) }, note: str(body.note, 400),
      items, total: Math.round(items.reduce((a, i) => a + i.price * i.qty, 0) * 100) / 100
    };
    db.orders.push(order); save();
    return json(res, 201, { ok: true, number: order.number });
  }
  if (p === '/api/login' && m === 'POST') {
    limit('login:' + ip, 8, 6e5);
    const u = db.users.find(x => x.username.toLowerCase() === str(body.username, 40).toLowerCase());
    const pw = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    let good = false;
    try { good = u ? verify(pw, u.password) : (verify(pw, DUMMY), false); } catch { }
    if (!u || !good) throw err(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
    if (u.disabled) throw err(403, 'هذا الحساب موقوف');
    const t = crypto.randomBytes(32).toString('hex');
    sessions.set(t, { uid: u.id, exp: Date.now() + 6048e5 });
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return json(res, 200, { user: pub(u) }, { 'Set-Cookie': `vc_sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}` });
  }
  if (p === '/api/logout' && m === 'POST') {
    const t = cookies(req).vc_sid; if (t) sessions.delete(t);
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'vc_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (p === '/api/me' && m === 'GET') return json(res, 200, { user: user ? pub(user) : null });
  if (p === '/api/me/password' && m === 'POST') {
    need(); limit('pw:' + user.id, 6, 6e5);
    if (!verify(String(body.current || ''), user.password)) throw err(400, 'كلمة المرور الحالية غير صحيحة');
    const n = String(body.next || ''); if (n.length < 8 || n.length > 100) throw err(400, 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف');
    user.password = hash(n); save();
    return json(res, 200, { ok: true });
  }

  if (p === '/api/admin/overview' && m === 'GET') {
    need();
    const o = {};
    if (has(user, 'products')) o.products = db.products.length;
    if (has(user, 'orders')) {
      o.ordersNew = db.orders.filter(x => x.status === 'new').length; o.ordersTotal = db.orders.length;
      o.revenue = db.orders.filter(x => x.status === 'done').reduce((a, x) => a + x.total, 0);
      o.recent = db.orders.slice(-5).reverse();
    }
    if (has(user, 'users')) o.users = db.users.length;
    return json(res, 200, o);
  }
  if (p === '/api/admin/settings') {
    need('settings');
    if (m === 'GET') return json(res, 200, db.settings);
    if (m === 'PUT') { for (const [k, max] of Object.entries(SET_KEYS)) if (k in body) db.settings[k] = str(body[k], max, k === 'serverName'); save(); return json(res, 200, db.settings); }
  }
  if (p === '/api/admin/upload' && m === 'POST') {
    need('products'); limit('up:' + user.id, 60, 6e5);
    const mt = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dataUrl || ''));
    if (!mt) throw err(400, 'صيغة الصورة غير مدعومة');
    const buf = Buffer.from(mt[2], 'base64'); if (buf.length > 4e6) throw err(413, 'الصورة أكبر من 4MB');
    const name = 'up-' + uid() + '.' + (mt[1] === 'jpeg' ? 'jpg' : mt[1]);
    fs.writeFileSync(path.join(__dirname, name), buf);
    return json(res, 201, { url: '/' + name });
  }
  if (p === '/api/admin/products' && (m === 'GET' || m === 'POST')) {
    need('products');
    if (m === 'GET') return json(res, 200, db.products.slice().sort((a, b) => b.createdAt - a.createdAt));
    const pr = { id: uid(), createdAt: Date.now(), ...cleanProduct(body) }; db.products.push(pr); save(); return json(res, 201, pr);
  }
  if (p === '/api/admin/orders' && m === 'GET') { need('orders'); return json(res, 200, db.orders.slice().reverse()); }
  if (p === '/api/admin/users' && m === 'GET') { need('users'); return json(res, 200, db.users.map(pub)); }
  if (p === '/api/admin/users' && m === 'POST') {
    need('users');
    const username = str(body.username, 24, true);
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) throw err(400, 'اسم المستخدم: 3-24 حرفاً إنجليزياً أو أرقام');
    if (db.users.some(x => x.username.toLowerCase() === username.toLowerCase())) throw err(409, 'اسم المستخدم مستخدم مسبقاً');
    const pw = String(body.password || ''); if (pw.length < 8 || pw.length > 100) throw err(400, 'كلمة المرور لا تقل عن 8 أحرف');
    const u = { id: uid(), username, name: str(body.name, 40) || username, role: 'admin', perms: cleanPerms(body.perms, user), disabled: false, password: hash(pw), createdAt: Date.now() };
    db.users.push(u); save(); return json(res, 201, pub(u));
  }

  const mm = p.match(/^\/api\/admin\/(products|orders|users)\/([a-f0-9]+)$/);
  if (mm) {
    const [, kind, id] = mm; need(kind);
    const list = db[kind], i = list.findIndex(x => x.id === id);
    if (i < 0) throw err(404, 'غير موجود');
    const item = list[i];
    if (m === 'PUT') {
      if (kind === 'products') Object.assign(item, cleanProduct(body));
      else if (kind === 'orders') { if (!STATUSES.includes(body.status)) throw err(400, 'حالة غير صالحة'); item.status = body.status; }
      else {
        if (item.role === 'owner') throw err(403, 'لا يمكن تعديل حساب المالك من هنا');
        if (user.role !== 'owner' && !item.perms.every(x => has(user, x))) throw err(403, 'لا يمكنك تعديل حساب يملك صلاحيات أعلى من صلاحياتك');
        if ('name' in body) item.name = str(body.name, 40, true);
        if ('perms' in body) item.perms = [...new Set([...item.perms.filter(x => !has(user, x)), ...cleanPerms(body.perms, user)])];
        if ('disabled' in body) { item.disabled = !!body.disabled; if (item.disabled) for (const [k, s] of sessions) if (s.uid === item.id) sessions.delete(k); }
        if (body.password) { const pw = String(body.password); if (pw.length < 8 || pw.length > 100) throw err(400, 'كلمة المرور لا تقل عن 8 أحرف'); item.password = hash(pw); for (const [k, s] of sessions) if (s.uid === item.id) sessions.delete(k); }
      }
      save(); return json(res, 200, kind === 'users' ? pub(item) : item);
    }
    if (m === 'DELETE') {
      if (kind === 'users') { if (item.role === 'owner' || item.id === user.id) throw err(403, 'لا يمكن حذف هذا الحساب'); if (user.role !== 'owner' && !item.perms.every(x => has(user, x))) throw err(403, 'لا يمكنك حذف حساب يملك صلاحيات أعلى من صلاحياتك'); for (const [k, s] of sessions) if (s.uid === item.id) sessions.delete(k); }
      if (kind === 'products' && UPLOAD_RE.test(item.image.slice(1)) && !list.some(x => x !== item && x.image === item.image)) fs.unlink(path.join(__dirname, item.image.slice(1)), () => { });
      list.splice(i, 1); save(); return json(res, 200, { ok: true });
    }
  }
  throw err(404, 'غير موجود');
}

/* ---------- الملفات الثابتة ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serve(req, res, p) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'غير مسموح' });
  if (p === '/admin' || p === '/admin/') p = '/admin.html';
  if (p === '/') p = '/index.html';
  const name = p.slice(1);
  if (!PUBLIC_FILES.has(name) && !UPLOAD_RE.test(name)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 — الصفحة غير موجودة'); }
  const f = path.join(PUB, name);
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 — الصفحة غير موجودة'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': UPLOAD_RE.test(name) ? 'public, max-age=2592000' : 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
}

http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.startsWith('/api/')) await api(req, res, p); else serve(req, res, p);
  } catch (e) {
    if (e.status) return json(res, e.status, { error: e.message });
    console.error(e); json(res, 500, { error: 'خطأ في الخادم' });
  }
}).listen(PORT, () => console.log(`Vice City شغّال على: http://localhost:${PORT}   |   لوحة التحكم: http://localhost:${PORT}/admin`));
