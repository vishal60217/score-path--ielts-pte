let content=null;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function show(view){
  $$(".view").forEach(x=>x.classList.remove("active"));
  const el=$("#"+view); if(el) el.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}
document.addEventListener("click",e=>{
  const v=e.target.closest("[data-view]"); if(v){show(v.dataset.view); if(v.dataset.view==="courses")renderLessons(); if(v.dataset.view==="live")renderClasses(); if(v.dataset.view==="tests")renderTest(); if(v.dataset.view==="dashboard")loadDashboard();}
});
async function api(url,opt={}){const r=await fetch(url,{headers:{"Content-Type":"application/json"},...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Something went wrong");return d}
async function init(){
  $("#year").textContent=new Date().getFullYear();
  content=await api("/api/content"); renderLessons(); renderClasses(); renderTest(); updateAccount();
  $$(".subscribe").forEach(b=>b.onclick=()=>subscribe(b.dataset.plan));
}
function renderLessons(){
  $("#lessonGrid").innerHTML=(content?.lessons||[]).map(l=>`<article class="lesson"><p class="eyebrow">${l.course} • ${l.skill}</p><h3>${l.title}</h3><p>${l.body}</p><button class="secondary" onclick="openLesson('${l.id}')">Open lesson</button></article>`).join("");
}
function openLesson(id){const l=content.lessons.find(x=>x.id===id);openModal(`<p class="eyebrow">${l.course} • ${l.skill}</p><h2>${l.title}</h2><p>${l.body}</p><div class="notice">Tip: practise this skill regularly and review your errors after every test.</div>`)}
function renderClasses(){
  $("#classGrid").innerHTML=(content?.classes||[]).map(c=>`<article class="class-card"><p class="eyebrow">${c.type}</p><h3>${c.title}</h3><p><b>${c.date}</b><br>${c.time}</p>${c.link?`<a class="primary" href="${c.link}" target="_blank" rel="noopener">Join class</a>`:`<span class="meta">Meeting link will appear when published.</span>`}</article>`).join("");
}
function renderTest(){
  const qs=[...(content?.questions||[])];
  $("#testBox").innerHTML=qs.map((q,i)=>`<div class="test-q"><b>${i+1}. ${q.prompt}</b>${q.options.map((o,j)=>`<label><input type="radio" name="${q.id}" value="${j}"> ${o}</label>`).join("")}</div>`).join("")+`<button class="primary" onclick="submitTest()">Submit test</button><div id="testResult"></div>`;
}
async function submitTest(){
  const answers={}; (content.questions||[]).forEach(q=>{const x=document.querySelector(`input[name="${q.id}"]:checked`);if(x)answers[q.id]=Number(x.value)});
  try{const d=await api("/api/test/submit",{method:"POST",body:JSON.stringify({answers})});$("#testResult").innerHTML=`<p class="result">Score: ${d.score}/${d.total} (${d.percent}%)</p>`}catch(e){openLogin();$("#testResult").innerHTML=`<div class="notice">${e.message}</div>`}
}
async function updateAccount(){
  const d=await api("/api/me");
  $("#accountBtn").textContent=d.user?"Dashboard":"Login";
  $("#accountBtn").onclick=()=>d.user?(show("dashboard"),loadDashboard()):openLogin();
}
async function loadDashboard(){
  try{
    const d=await api("/api/dashboard");
    $("#dash").innerHTML=`<div class="dash-grid"><div class="dash-card"><b>Student</b><h3>${d.user.name}</h3><p>${d.user.email}</p></div><div class="dash-card"><b>Access</b><h3>${d.subscription?d.subscription.plan:"Not subscribed"}</h3><p>${d.subscription?`Expires ${new Date(d.subscription.expiresAt).toLocaleDateString()}`:"Choose a plan to unlock paid access."}</p></div><div class="dash-card"><b>Learning</b><h3>${d.lessons.length} lessons</h3><p>IELTS + PTE</p></div></div><button class="secondary" onclick="logout()">Log out</button>`;
  }catch(e){openLogin()}
}
function openLogin(){openModal(`<h2>Student login</h2><div class="field"><label>Email</label><input id="loginEmail" type="email"></div><div class="field"><label>Password</label><input id="loginPass" type="password"></div><button class="primary" onclick="login()">Login</button><p class="meta">New student? <a href="#" onclick="openRegister();return false">Create an account</a></p>`)}
function openRegister(){openModal(`<h2>Create account</h2><div class="field"><label>Name</label><input id="regName"></div><div class="field"><label>Email</label><input id="regEmail" type="email"></div><div class="field"><label>Password (6+ characters)</label><input id="regPass" type="password"></div><button class="primary" onclick="register()">Create account</button><p class="meta">Already registered? <a href="#" onclick="openLogin();return false">Login</a></p>`)}
async function login(){try{await api("/api/login",{method:"POST",body:JSON.stringify({email:$("#loginEmail").value,password:$("#loginPass").value})});closeModal();await updateAccount();show("dashboard");loadDashboard()}catch(e){alert(e.message)}}
async function register(){try{await api("/api/register",{method:"POST",body:JSON.stringify({name:$("#regName").value,email:$("#regEmail").value,password:$("#regPass").value})});closeModal();await updateAccount();show("dashboard");loadDashboard()}catch(e){alert(e.message)}}
async function logout(){await api("/api/logout",{method:"POST"});await updateAccount();show("home")}
async function subscribe(plan){
  try{
    const d=await api("/api/subscribe",{method:"POST",body:JSON.stringify({plan})});
    if(d.mode==="razorpay"){
      const rzp=new Razorpay({key:d.keyId,amount:d.amount,currency:d.currency,name:"ScorePath",description:plan==="monthly"?"ScorePath Monthly":"ScorePath 3 Months",order_id:d.orderId,handler:async response=>{
        try{await api("/api/payment/verify",{method:"POST",body:JSON.stringify({...response,plan})});alert("Payment successful. Your access is active.");await updateAccount();show("dashboard");loadDashboard()}catch(e){alert(e.message)}
      }});
      rzp.open();
    }
  }catch(e){
    const d=await api("/api/me");
    if(!d.user) openLogin(); else alert(e.message);
  }
}
function openModal(html){$("#modalBody").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
init().catch(e=>console.error(e));
