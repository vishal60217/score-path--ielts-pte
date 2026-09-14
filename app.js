let content = null;
let adminData = null;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));

async function api(url, opt = {}) {
  const r = await fetch(url, {
    credentials: 'same-origin',
    ...opt,
    headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}

function toast(message, kind = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function show(view) {
  const target = $(`#${view}`);
  if (!target) return;
  $$('.view').forEach(x => x.classList.remove('active'));
  target.classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.body.classList.remove('menu-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'courses') renderCourses();
  if (view === 'live') renderClasses();
  if (view === 'tests') renderTest();
  if (view === 'pricing') renderPlans();
  if (view === 'dashboard') loadDashboard();
  if (view === 'admin') loadAdmin();
}

function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
window.closeModal = closeModal;

function renderCourses(filter = 'All') {
  const list = (content?.courses || []).filter(c => filter === 'All' || c.exam === filter);
  $('#courseGrid').innerHTML = list.map(c => `
    <article class="course-card">
      <div class="course-top"><span class="pill">${esc(c.exam)}</span><span>${c.lessons || 0} lessons</span></div>
      <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>
      <div class="chips">${(c.skills || []).map(s => `<span>${esc(s)}</span>`).join('')}</div>
      <div class="card-actions"><button type="button" class="secondary" data-course="${esc(c.id)}">View course</button><button type="button" class="primary" data-view="pricing">Get access</button></div>
    </article>`).join('') || '<p>No courses published yet.</p>';
}


function openCourse(id) {
  const c = (content?.courses || []).find(x => x.id === id);
  if (!c) return;
  const lessons = (content?.lessons || []).filter(l => l.courseId === id);
  openModal(`<span class="pill">${esc(c.exam)}</span><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><div class="chips">${(c.skills||[]).map(s=>`<span>${esc(s)}</span>`).join('')}</div><h3>Course lessons</h3><div class="lesson-list">${lessons.map(l=>`<button type="button" class="lesson-item" data-lesson="${esc(l.id)}"><b>${esc(l.title)}</b><span>${esc(l.skill)}</span></button>`).join('') || '<p>No lessons published yet.</p>'}</div><button type="button" class="primary" id="coursePlans">Choose membership</button>`);
  $('#coursePlans')?.addEventListener('click',()=>{closeModal();show('pricing');});
}

function renderClasses() {
  $('#classGrid').innerHTML = (content?.classes || []).map(c => `
    <article class="class-card"><span class="pill">${esc(c.exam)}</span><h3>${esc(c.title)}</h3>
    <p><b>${esc(c.date)}</b><br>${esc(c.time)} • ${esc(c.instructor)}</p>
    <p>${esc(c.description || 'Live guided practice and Q&A.')}</p>
    ${c.link ? `<a class="primary inline" href="${esc(c.link)}" target="_blank" rel="noopener">Join session</a>` : '<span class="meta">Meeting link will appear when published.</span>'}
    </article>`).join('') || '<p>No live classes published yet.</p>';
}

function renderPlans() {
  $('#pricingGrid').innerHTML = (content?.pricing || []).map(p => `
    <article class="price-card ${p.featured ? 'featured' : ''}">${p.featured ? '<div class="tag">Best value</div>' : ''}
      <h3>${esc(p.name)}</h3><div class="price">₹${Number(p.price).toLocaleString('en-IN')}<small> / ${p.days} days</small></div>
      <ul>${(p.features || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <button type="button" class="primary subscribe" data-plan="${esc(p.id)}">Choose ${esc(p.name)}</button>
    </article>`).join('') || '<p>No membership plans available.</p>';
}

function renderTest() {
  const qs = content?.questions || [];
  $('#testBox').innerHTML = qs.map((q, i) => `
    <div class="test-q"><b>${i + 1}. ${esc(q.prompt)}</b>
      ${(q.options || []).map((o, j) => `<label><input type="radio" name="${esc(q.id)}" value="${j}"> ${esc(o)}</label>`).join('')}
    </div>`).join('') + (qs.length ? '<button type="button" class="primary" id="testSubmit">Submit diagnostic</button><div id="testResult"></div>' : '<p>No questions published yet.</p>');
  $('#testSubmit')?.addEventListener('click', submitTest);
}

async function submitTest() {
  const answers = {};
  (content.questions || []).forEach(q => { const x = document.querySelector(`input[name="${CSS.escape(q.id)}"]:checked`); if (x) answers[q.id] = Number(x.value); });
  try {
    const d = await api('/api/test/submit', { method: 'POST', body: JSON.stringify({ answers }) });
    $('#testResult').innerHTML = `<div class="result"><strong>${d.score}/${d.total}</strong> — ${d.percent}%<br>${esc(d.message)}</div>`;
  } catch (e) { openLogin('Create a free account to save your diagnostic result.'); }
}

async function updateAccount() {
  const d = await api('/api/me');
  const b = $('#accountBtn');
  b.textContent = d.user ? (d.user.role === 'admin' ? 'Admin' : 'Dashboard') : 'Login';
  b.onclick = () => d.user ? show(d.user.role === 'admin' ? 'admin' : 'dashboard') : openLogin();
  $('#heroCta').textContent = d.user ? 'Open dashboard' : 'Start learning';
  $('#heroCta').onclick = () => d.user ? show('dashboard') : openRegister();
}

async function loadDashboard() {
  try {
    const d = await api('/api/dashboard');
    const s = d.subscription;
    const days = s ? Math.max(0, Math.ceil((new Date(s.expiresAt || s.expires_at) - Date.now()) / 86400000)) : 0;
    $('#dash').innerHTML = `
      <div class="dash-grid">
        <div class="dash-card"><span>Student</span><h3>${esc(d.user.name)}</h3><p>${esc(d.user.email)}</p></div>
        <div class="dash-card"><span>Membership</span><h3>${s ? esc(s.planName) : 'Free account'}</h3>
          <p>${s ? `Active • ${days} day${days === 1 ? '' : 's'} left • expires ${new Date(s.expiresAt || s.expires_at).toLocaleDateString()}` : 'Subscribe to unlock your courses.'}</p>
          <button type="button" class="secondary" data-view="pricing">${s ? 'Renew / extend' : 'Choose a plan'}</button>
        </div>
        <div class="dash-card"><span>Progress</span><h3>${d.progress.completed}/${d.progress.total}</h3><p>Lessons completed</p></div>
      </div>
      <div class="dashboard-section"><h3>Your courses</h3><div class="mini-grid">
        ${d.courses.map(c => `<div class="mini-card"><span class="pill">${esc(c.exam)}</span><h4>${esc(c.title)}</h4><p>${c.access ? '🔓 Included in your membership' : '🔒 Not included'}</p>
          ${c.access && c.firstLessonId ? `<button type="button" class="secondary" data-lesson="${esc(c.firstLessonId)}">Open first lesson</button>` : '<button type="button" class="secondary" data-view="pricing">Upgrade</button>'}</div>`).join('')}
      </div></div><button type="button" class="secondary" id="logoutBtn">Log out</button>`;
  } catch (e) { openLogin(); }
}

async function openLesson(id) {
  if (!id) return;
  try {
    const l = await api('/api/lessons/' + encodeURIComponent(id));
    openModal(`<span class="pill">${esc(l.exam)} • ${esc(l.skill)}</span><h2>${esc(l.title)}</h2><p class="lesson-body">${esc(l.body)}</p><h3>What you'll learn</h3><ul>${(l.objectives || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><button type="button" class="primary" id="completeLesson">Mark complete</button>`);
    $('#completeLesson').onclick = () => markComplete(l.id);
  } catch (e) {
    if (/log in/i.test(e.message)) openLogin();
    else if (/membership|include/i.test(e.message)) openModal(`<h2>Membership required</h2><p>${esc(e.message)}</p><button type="button" class="primary" id="viewPlans">View plans</button>`), $('#viewPlans').onclick = () => { closeModal(); show('pricing'); };
    else toast(e.message, 'error');
  }
}

async function markComplete(id) {
  try { await api('/api/progress', { method: 'POST', body: JSON.stringify({ lessonId: id }) }); closeModal(); toast('Lesson completed.', 'success'); if ($('#dashboard').classList.contains('active')) loadDashboard(); }
  catch (e) { toast(e.message, 'error'); }
}

function openLogin(note = '') { openModal(`<h2>Welcome back</h2>${note ? `<p class="notice">${esc(note)}</p>` : ''}<div class="field"><label>Email</label><input id="loginEmail" type="email" autocomplete="email"></div><div class="field"><label>Password</label><input id="loginPass" type="password" autocomplete="current-password"></div><button type="button" class="primary" id="loginSubmit">Login</button><p class="meta">New here? <a href="#" id="toRegister">Create account</a></p>`); $('#loginSubmit').onclick = login; $('#toRegister').onclick = e => { e.preventDefault(); openRegister(); }; }
function openRegister() { openModal(`<h2>Create your free account</h2><div class="field"><label>Full name</label><input id="regName" autocomplete="name"></div><div class="field"><label>Email</label><input id="regEmail" type="email" autocomplete="email"></div><div class="field"><label>Password (8+ characters)</label><input id="regPass" type="password" autocomplete="new-password"></div><button type="button" class="primary" id="registerSubmit">Create account</button><p class="meta">Already registered? <a href="#" id="toLogin">Login</a></p>`); $('#registerSubmit').onclick = register; $('#toLogin').onclick = e => { e.preventDefault(); openLogin(); }; }
async function login() { try { await api('/api/login', { method: 'POST', body: JSON.stringify({ email: $('#loginEmail').value, password: $('#loginPass').value }) }); closeModal(); await updateAccount(); show('dashboard'); } catch (e) { toast(e.message, 'error'); } }
async function register() { try { await api('/api/register', { method: 'POST', body: JSON.stringify({ name: $('#regName').value, email: $('#regEmail').value, password: $('#regPass').value }) }); closeModal(); await updateAccount(); show('dashboard'); } catch (e) { toast(e.message, 'error'); } }
async function logout() { await api('/api/logout', { method: 'POST' }); await updateAccount(); show('home'); toast('Logged out', 'success'); }

async function subscribePlan(plan) {
  try {
    const d = await api('/api/subscribe', { method: 'POST', body: JSON.stringify({ plan }) });
    if (d.mode === 'razorpay') {
      if (typeof Razorpay === 'undefined') throw new Error('Razorpay checkout could not load. Please try again or use bank/UPI payment.');
      const rzp = new Razorpay({ key: d.keyId, amount: d.amount, currency: 'INR', name: 'ScorePath', description: d.planName, order_id: d.orderId, prefill: d.prefill, theme: { color: '#17352d' }, handler: async response => {
        try { await api('/api/payment/verify', { method: 'POST', body: JSON.stringify(response) }); toast('Payment successful — membership activated.', 'success'); await updateAccount(); show('dashboard'); }
        catch (e) { toast(e.message, 'error'); }
      }, modal: { ondismiss: () => toast('Payment window closed.', 'info') } });
      rzp.open();
    } else {
      const b = d.bank || {};
      openModal(`<h2>Pay by Bank / UPI</h2><p>${esc(d.instructions)}</p><div class="bank-box">${b.bankName ? `<b>Bank:</b> ${esc(b.bankName)}<br>` : ''}${b.accountName ? `<b>Account name:</b> ${esc(b.accountName)}<br>` : ''}${b.accountNumber ? `<b>Account number:</b> ${esc(b.accountNumber)}<br>` : ''}${b.ifsc ? `<b>IFSC:</b> ${esc(b.ifsc)}<br>` : ''}${b.upiId ? `<b>UPI ID:</b> ${esc(b.upiId)}<br>` : ''}<b>Amount:</b> ₹${Number(d.amount).toLocaleString('en-IN')}</div><div class="field"><label>UTR / transaction number</label><input id="utr" inputmode="numeric"></div><button type="button" class="primary" id="manualPaid">I have paid</button>`);
      $('#manualPaid').onclick = () => submitBankPayment(plan);
    }
  } catch (e) {
    const me = await api('/api/me').catch(() => ({ user: null }));
    if (!me.user) openLogin('Create an account before purchasing.'); else toast(e.message, 'error');
  }
}

async function submitBankPayment(plan) { try { await api('/api/payment/manual', { method: 'POST', body: JSON.stringify({ plan, utr: $('#utr').value }) }); closeModal(); toast('Payment submitted. Access will activate after admin verification.', 'success'); } catch (e) { toast(e.message, 'error'); } }

function adminForm() { return `<div class="admin-tabs">${['overview','courses','lessons','plans','teachers','classes','payments','users','settings'].map(x => `<button type="button" class="secondary" data-admin-section="${x}">${x === 'classes' ? 'Live classes' : x === 'settings' ? 'Bank & settings' : x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><div id="adminWorkspace"></div>`; }
async function loadAdmin() { try { adminData = await api('/api/admin/overview'); $('#adminPanel').innerHTML = adminForm(); $$('.admin-tabs button').forEach(b => b.onclick = () => adminSection(b.dataset.adminSection)); adminSection('overview'); } catch (e) { toast(e.message, 'error'); if (/access|required/i.test(e.message)) show('home'); } }

function adminSection(s) {
  const w = $('#adminWorkspace'); if (!w) return;
  if (s === 'overview') w.innerHTML = `<div class="dash-grid">${[['Students',adminData.stats.students],['Active memberships',adminData.stats.activeSubscriptions],['Pending payments',adminData.stats.pendingPayments],['Lessons',adminData.stats.lessons],['Courses',adminData.stats.courses],['Teachers',adminData.stats.teachers]].map(x => `<div class="dash-card"><span>${x[0]}</span><h3>${x[1]}</h3></div>`).join('')}</div><div class="notice"><b>Admin controls are live.</b><br>Use the tabs to manage content, teachers, live sessions, payment verification and bank/UPI details.</div>`;
  if (s === 'payments') w.innerHTML = `<div class="admin-panel"><h3>Pending manual payments</h3>${adminData.pendingPayments.length ? adminData.pendingPayments.map(p => `<div class="admin-row"><div><b>${esc(p.userName)}</b><br>₹${p.amount} • ${esc(p.planName)}<br>UTR: ${esc(p.utr)}</div><div><button type="button" class="primary" data-approve="${p.id}">Approve</button> <button type="button" class="secondary" data-reject="${p.id}">Reject</button></div></div>`).join('') : '<p>No pending payments.</p>'}</div>`;
  if (s === 'users') w.innerHTML = `<div class="admin-panel"><h3>Registered users</h3>${(adminData.users || []).map(u => `<div class="admin-row"><div><b>${esc(u.name)}</b><br>${esc(u.email)} • ${esc(u.role)}</div><span class="meta">${u.active ? 'Active membership' : 'No active membership'}</span></div>`).join('') || '<p>No users yet.</p>'}</div>`;
  if (s === 'courses') w.innerHTML = `<div class="admin-panel"><h3>Add / edit course</h3><div class="form-grid"><input id="cId" placeholder="ID (blank = new)"><input id="cExam" placeholder="IELTS / PTE / Academic"><input id="cTitle" placeholder="Course title"><input id="cSkills" placeholder="Skills comma separated"><textarea id="cDesc" placeholder="Description"></textarea></div><button type="button" class="primary" id="saveCourse">Save course</button></div><div class="admin-panel"><h3>Published courses</h3>${adminData.courses.map(c => `<div class="admin-row"><div><b>${esc(c.title)}</b><br>${esc(c.exam)} • ${(c.skills||[]).map(esc).join(', ')}</div><div><button type="button" class="secondary" data-edit-course='${esc(JSON.stringify(c))}'>Edit</button> <button type="button" class="secondary" data-delete="course" data-id="${esc(c.id)}">Delete</button></div></div>`).join('')}</div>`;
  if (s === 'lessons') w.innerHTML = `<div class="admin-panel"><h3>Add / edit lesson</h3><div class="form-grid"><input id="lId" placeholder="ID (blank = new)"><select id="lCourse">${adminData.courses.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select><input id="lExam" placeholder="Exam"><input id="lSkill" placeholder="Skill"><input id="lTitle" placeholder="Lesson title"><textarea id="lBody" placeholder="Lesson content"></textarea><input id="lObj" placeholder="Objectives comma separated"></div><button type="button" class="primary" id="saveLesson">Save lesson</button></div><div class="admin-panel"><h3>Lessons</h3>${adminData.lessons.map(l => `<div class="admin-row"><div><b>${esc(l.title)}</b><br>${esc(l.exam)} • ${esc(l.skill)}</div><div><button type="button" class="secondary" data-edit-lesson='${esc(JSON.stringify(l))}'>Edit</button> <button type="button" class="secondary" data-delete="lesson" data-id="${esc(l.id)}">Delete</button></div></div>`).join('')}</div>`;
  if (s === 'plans') w.innerHTML = `<div class="admin-panel"><h3>Add / edit membership plan</h3><div class="form-grid"><input id="pId" placeholder="ID (blank = new)"><input id="pName" placeholder="Plan name"><input id="pPrice" type="number" placeholder="Price INR"><input id="pDays" type="number" placeholder="Days"><input id="pFeatures" placeholder="Features comma separated"><input id="pCourses" placeholder="Course IDs comma separated"><label><input id="pFeatured" type="checkbox"> Featured</label></div><button type="button" class="primary" id="savePlan">Save plan</button></div><div class="admin-panel"><h3>Plans</h3>${adminData.plans.map(p => `<div class="admin-row"><div><b>${esc(p.name)}</b> — ₹${p.price}/${p.days} days<br>${(p.courseIds||[]).join(', ')}</div><div><button type="button" class="secondary" data-edit-plan='${esc(JSON.stringify(p))}'>Edit</button> <button type="button" class="secondary" data-delete="plan" data-id="${esc(p.id)}">Delete</button></div></div>`).join('')}</div>`;
  if (s === 'teachers') w.innerHTML = `<div class="admin-panel"><h3>Add / edit teacher</h3><div class="form-grid"><input id="tId" placeholder="ID (blank = new)"><input id="tName" placeholder="Name"><input id="tPhoto" placeholder="Photo URL"><textarea id="tBio" placeholder="Bio"></textarea></div><button type="button" class="primary" id="saveTeacher">Save teacher</button></div><div class="admin-panel"><h3>Teachers</h3>${adminData.teachers.map(t => `<div class="admin-row"><div><b>${esc(t.name)}</b><br>${esc(t.bio)}</div><div><button type="button" class="secondary" data-edit-teacher='${esc(JSON.stringify(t))}'>Edit</button> <button type="button" class="secondary" data-delete="teacher" data-id="${esc(t.id)}">Delete</button></div></div>`).join('')}</div>`;
  if (s === 'classes') w.innerHTML = `<div class="admin-panel"><h3>Add / edit live class</h3><div class="form-grid"><input id="clId" placeholder="ID (blank = new)"><input id="clTitle" placeholder="Class title"><input id="clExam" placeholder="IELTS / PTE / Both"><input id="clDate" placeholder="Date"><input id="clTime" placeholder="Time"><input id="clInstructor" placeholder="Instructor"><input id="clTeacher" placeholder="Teacher ID"><input id="clLink" placeholder="Zoom / Meet link"><textarea id="clDesc" placeholder="Description"></textarea></div><button type="button" class="primary" id="saveClass">Save class</button></div><div class="admin-panel"><h3>Published classes</h3>${adminData.classes.map(c => `<div class="admin-row"><div><b>${esc(c.title)}</b><br>${esc(c.date)} • ${esc(c.time)} • ${esc(c.instructor)}</div><div><button type="button" class="secondary" data-edit-class='${esc(JSON.stringify(c))}'>Edit</button> <button type="button" class="secondary" data-delete="class" data-id="${esc(c.id)}">Delete</button></div></div>`).join('')}</div>`;
  if (s === 'settings') w.innerHTML = `<div class="admin-panel"><h3>Bank / UPI and site settings</h3><p class="meta">These details are shown to customers choosing bank/UPI payment. Never put passwords or API secrets here.</p><div class="form-grid"><input id="sBank" value="${esc(adminData.bank.bankName||'')}" placeholder="Bank name"><input id="sAccount" value="${esc(adminData.bank.accountName||'')}" placeholder="Account name"><input id="sNumber" value="${esc(adminData.bank.accountNumber||'')}" placeholder="Account number"><input id="sIfsc" value="${esc(adminData.bank.ifsc||'')}" placeholder="IFSC"><input id="sUpi" value="${esc(adminData.bank.upiId||'')}" placeholder="UPI ID"><input id="sEmail" value="${esc(adminData.bank.supportEmail||'')}" placeholder="Support email"><input id="sSite" value="${esc(adminData.bank.siteName||'ScorePath')}" placeholder="Site name"></div><button type="button" class="primary" id="saveSettings">Save settings</button></div>`;
  wireAdminSection(s);
}

function fill(map, obj) { Object.entries(map).forEach(([selector,key]) => { const el = $(selector); if (el) el.value = obj[key] ?? ''; }); }
function wireAdminSection(s) {
  $$('#adminWorkspace [data-approve]').forEach(b => b.onclick = () => approvePayment(b.dataset.approve));
  $$('#adminWorkspace [data-reject]').forEach(b => b.onclick = () => rejectPayment(b.dataset.reject));
  $$('#adminWorkspace [data-delete]').forEach(b => b.onclick = () => deleteItem(b.dataset.delete, b.dataset.id));
  $$('#adminWorkspace [data-edit-course]').forEach(b => b.onclick = () => editCourse(JSON.parse(b.dataset.editCourse)));
  $$('#adminWorkspace [data-edit-lesson]').forEach(b => b.onclick = () => editLesson(JSON.parse(b.dataset.editLesson)));
  $$('#adminWorkspace [data-edit-plan]').forEach(b => b.onclick = () => editPlan(JSON.parse(b.dataset.editPlan)));
  $$('#adminWorkspace [data-edit-teacher]').forEach(b => b.onclick = () => editTeacher(JSON.parse(b.dataset.editTeacher)));
  $$('#adminWorkspace [data-edit-class]').forEach(b => b.onclick = () => editClass(JSON.parse(b.dataset.editClass)));
  $('#saveCourse')?.addEventListener('click', saveCourse); $('#saveLesson')?.addEventListener('click', saveLesson); $('#savePlan')?.addEventListener('click', savePlan); $('#saveTeacher')?.addEventListener('click', saveTeacher); $('#saveClass')?.addEventListener('click', saveClass); $('#saveSettings')?.addEventListener('click', saveSettings);
}
function editCourse(c){fill({'#cId':'id','#cExam':'exam','#cTitle':'title','#cSkills':'skills','#cDesc':'description'},{...c,skills:(c.skills||[]).join(',')});}
function editLesson(l){fill({'#lId':'id','#lCourse':'courseId','#lExam':'exam','#lSkill':'skill','#lTitle':'title','#lBody':'body','#lObj':'objectives'},{...l,objectives:(l.objectives||[]).join(',')});}
function editPlan(p){fill({'#pId':'id','#pName':'name','#pPrice':'price','#pDays':'days','#pFeatures':'features','#pCourses':'courseIds'},{...p,features:(p.features||[]).join(','),courseIds:(p.courseIds||[]).join(',')});if($('#pFeatured'))$('#pFeatured').checked=!!p.featured;}
function editTeacher(t){fill({'#tId':'id','#tName':'name','#tPhoto':'photoUrl','#tBio':'bio'},t);}
function editClass(c){fill({'#clId':'id','#clTitle':'title','#clExam':'exam','#clDate':'date','#clTime':'time','#clInstructor':'instructor','#clTeacher':'teacherId','#clLink':'link','#clDesc':'description'},c);}
async function adminPost(url, body){try{await api(url,{method:'POST',body:JSON.stringify(body)});toast('Saved successfully','success');await loadAdmin();}catch(e){toast(e.message,'error');}}
async function saveCourse(){await adminPost('/api/admin/course',{x:{id:$('#cId').value||undefined,exam:$('#cExam').value,title:$('#cTitle').value,skills:$('#cSkills').value.split(',').map(x=>x.trim()).filter(Boolean),description:$('#cDesc').value}});}
async function saveLesson(){await adminPost('/api/admin/lesson',{x:{id:$('#lId').value||undefined,courseId:$('#lCourse').value,exam:$('#lExam').value,skill:$('#lSkill').value,title:$('#lTitle').value,body:$('#lBody').value,objectives:$('#lObj').value.split(',').map(x=>x.trim()).filter(Boolean)}});}
async function savePlan(){await adminPost('/api/admin/plan',{x:{id:$('#pId').value||undefined,name:$('#pName').value,price:Number($('#pPrice').value),days:Number($('#pDays').value),features:$('#pFeatures').value.split(',').map(x=>x.trim()).filter(Boolean),courseIds:$('#pCourses').value.split(',').map(x=>x.trim()).filter(Boolean),featured:$('#pFeatured').checked}});}
async function saveTeacher(){await adminPost('/api/admin/teacher',{x:{id:$('#tId').value||undefined,name:$('#tName').value,bio:$('#tBio').value,photoUrl:$('#tPhoto').value}});}
async function saveClass(){await adminPost('/api/admin/class',{x:{id:$('#clId').value||undefined,title:$('#clTitle').value,exam:$('#clExam').value,date:$('#clDate').value,time:$('#clTime').value,instructor:$('#clInstructor').value,teacherId:$('#clTeacher').value,link:$('#clLink').value,description:$('#clDesc').value}});}
async function saveSettings(){await adminPost('/api/admin/settings',{bankName:$('#sBank').value,accountName:$('#sAccount').value,accountNumber:$('#sNumber').value,ifsc:$('#sIfsc').value,upiId:$('#sUpi').value,supportEmail:$('#sEmail').value,siteName:$('#sSite').value});}
async function deleteItem(type,id){if(!confirm('Delete this item?'))return;try{await api(`/api/admin/${type}/${encodeURIComponent(id)}/delete`,{method:'POST'});toast('Deleted','success');await loadAdmin();}catch(e){toast(e.message,'error');}}
async function approvePayment(id){try{await api(`/api/admin/payment/${encodeURIComponent(id)}/approve`,{method:'POST'});toast('Payment approved and membership activated','success');await loadAdmin();}catch(e){toast(e.message,'error');}}
async function rejectPayment(id){try{await api(`/api/admin/payment/${encodeURIComponent(id)}/reject`,{method:'POST'});toast('Payment rejected','success');await loadAdmin();}catch(e){toast(e.message,'error');}}

Object.assign(window,{show,openCourse,openLogin,openRegister,closeModal,login,register,subscribePlan,submitBankPayment,markComplete,approvePayment,rejectPayment,adminSection,saveCourse,saveLesson,savePlan,saveTeacher,saveClass,saveSettings,deleteItem,editCourse,editLesson,editPlan,editTeacher,editClass});

document.addEventListener('click', e => {
  const view = e.target.closest('[data-view]'); if (view) { e.preventDefault(); show(view.dataset.view); return; }
  const filter = e.target.closest('[data-filter]'); if (filter) { $$('.filter').forEach(x => x.classList.remove('active')); filter.classList.add('active'); renderCourses(filter.dataset.filter); return; }
  const course = e.target.closest('[data-course]'); if (course) { e.preventDefault(); openCourse(course.dataset.course); return; }
  const lesson = e.target.closest('[data-lesson]'); if (lesson) { e.preventDefault(); openLesson(lesson.dataset.lesson); return; }
  const plan = e.target.closest('.subscribe'); if (plan) { subscribePlan(plan.dataset.plan); return; }
  if (e.target.closest('#logoutBtn')) logout();
});

$('#mobileMenu')?.addEventListener('click', () => document.body.classList.toggle('menu-open'));
$('#modal')?.addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

async function init() {
  $('#year').textContent = new Date().getFullYear();
  try { content = await api('/api/content'); renderCourses(); renderClasses(); renderTest(); renderPlans(); await updateAccount(); }
  catch (e) { console.error(e); toast(e.message || 'ScorePath could not load.', 'error'); }
  finally { setTimeout(() => $('#loading')?.classList.add('done'), 250); }
}
init();
