require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = process.env.VERCEL ? path.join("/tmp", "scorepath-db.json") : path.join(DATA_DIR, "db.json");

if (!process.env.VERCEL) { fs.mkdirSync(DATA_DIR, { recursive: true }); }

const seed = {
  users: [],
  sessions: {},
  subscriptions: [],
  classes: [
    {id:"ielts-speaking", title:"IELTS Speaking Masterclass", type:"IELTS", date:"Every Monday", time:"7:00 PM", link:""},
    {id:"pte-speaking", title:"PTE Speaking & Fluency", type:"PTE", date:"Every Wednesday", time:"7:00 PM", link:""},
    {id:"writing", title:"Writing Task Workshop", type:"IELTS + PTE", date:"Every Friday", time:"7:00 PM", link:""}
  ],
  lessons: [
    {id:"ielts-reading-1", course:"IELTS", skill:"Reading", title:"Reading: Skimming & Scanning", body:"Learn to identify keywords, paragraph purpose, and exact locations of answers. Practice reading the question first, then scanning for names, numbers, dates and distinctive terms."},
    {id:"ielts-listening-1", course:"IELTS", skill:"Listening", title:"Listening: Predict Before You Listen", body:"Underline key words, predict the type of answer, and watch for corrections or distractors. Check spelling, grammar and word limits before submitting."},
    {id:"ielts-writing-1", course:"IELTS", skill:"Writing", title:"Writing Task 2: Clear Essay Structure", body:"Use a direct introduction, logically developed body paragraphs and a concise conclusion. Each paragraph should have one controlling idea supported by explanation or an example."},
    {id:"ielts-speaking-1", course:"IELTS", skill:"Speaking", title:"Speaking: Fluency & Development", body:"Answer directly, extend your ideas, give reasons/examples, and use natural linking language. Focus on communication rather than memorising scripts."},
    {id:"pte-reading-1", course:"PTE", skill:"Reading", title:"Reading: Fill in the Blanks Strategy", body:"Read the whole sentence for meaning and grammar, then compare collocations and word forms. Eliminate options that do not fit the surrounding structure."},
    {id:"pte-listening-1", course:"PTE", skill:"Listening", title:"Listening: Note the Main Idea", body:"Listen for the topic, speaker purpose and key details. Take short notes rather than trying to write every word."},
    {id:"pte-speaking-1", course:"PTE", skill:"Speaking", title:"Speaking: Read Aloud & Repeat Sentence", body:"Maintain steady pace and clear pronunciation. Avoid restarting repeatedly; prioritise accurate content and smooth delivery."},
    {id:"pte-writing-1", course:"PTE", skill:"Writing", title:"Writing: Summarise Written Text", body:"Identify the central idea and key supporting point, then combine them into one grammatically complete sentence within the required format."}
  ],
  questions: [
    {id:"q1", test:"IELTS Quick Test", skill:"Reading", prompt:"Choose the best word: The research was _____ because it used data from several independent sources.", options:["credible","credibly","credibility","credit"], answer:0},
    {id:"q2", test:"IELTS Quick Test", skill:"Listening", prompt:"Which answer best completes the phrase? The meeting has been _____ until Friday.", options:["postponed","postponing","postpone","postponement"], answer:0},
    {id:"q3", test:"PTE Quick Test", skill:"Reading", prompt:"Choose the best option: The new policy will have a significant _____ on small businesses.", options:["affect","effect","effective","effectively"], answer:1},
    {id:"q4", test:"PTE Quick Test", skill:"Writing", prompt:"Which is the strongest academic sentence?", options:["People say technology is good.","Technology can improve access to education when it is implemented effectively.","Technology is very very useful.","I think tech is awesome."], answer:1}
  ]
};

function loadDB(){
  if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(seed,null,2));
  try { return JSON.parse(fs.readFileSync(DB_FILE,"utf8")); } catch(e){ return JSON.parse(JSON.stringify(seed)); }
}
function saveDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
let db = loadDB();

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.get("/app.js", (req,res)=>res.sendFile(path.join(__dirname,"app.js")));
app.get("/styles.css", (req,res)=>res.sendFile(path.join(__dirname,"styles.css")));

function hashPassword(password, salt=crypto.randomBytes(16).toString("hex")){
  return {salt, hash:crypto.scryptSync(password,salt,64).toString("hex")};
}
function verifyPassword(password, stored){
  if(!stored || !stored.salt || !stored.hash) return false;
  const hash=crypto.scryptSync(password,stored.salt,64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(stored.hash,"hex"));
}
function makeSession(userId){
  const token=crypto.randomBytes(32).toString("hex");
  db.sessions[token]={userId,expires:Date.now()+1000*60*60*24*30};
  saveDB(db);
  return token;
}
function userFromReq(req){
  const raw=req.headers.cookie||"";
  const m=raw.match(/scorepath_session=([^;]+)/);
  if(!m) return null;
  const s=db.sessions[m[1]];
  if(!s || s.expires<Date.now()) return null;
  return db.users.find(u=>u.id===s.userId)||null;
}
function requireUser(req,res,next){
  const u=userFromReq(req); if(!u) return res.status(401).json({error:"Please log in."});
  req.user=u; next();
}
function requireAdmin(req,res,next){
  const u=userFromReq(req);
  if(!u || u.role!=="admin") return res.status(403).json({error:"Admin access required."});
  req.user=u; next();
}
function activeSub(userId){
  return db.subscriptions.find(s=>s.userId===userId && s.status==="active" && new Date(s.expiresAt)>new Date());
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"ScorePath"}));
app.get("/api/content",(req,res)=>res.json({lessons:db.lessons, classes:db.classes, pricing:[
  {id:"monthly",name:"Monthly",price:200,days:30},
  {id:"quarterly",name:"3 Months",price:500,days:90}
]}));
app.get("/api/me",(req,res)=>{
  const u=userFromReq(req);
  if(!u) return res.json({user:null});
  const sub=activeSub(u.id);
  res.json({user:{id:u.id,name:u.name,email:u.email,role:u.role},subscription:sub||null});
});

app.post("/api/register",(req,res)=>{
  const {name,email,password}=req.body||{};
  if(!name || !email || !password || password.length<6) return res.status(400).json({error:"Enter name, valid email and a password of at least 6 characters."});
  const normalized=email.trim().toLowerCase();
  if(db.users.some(u=>u.email===normalized)) return res.status(409).json({error:"An account with this email already exists."});
  const p=hashPassword(password);
  const user={id:crypto.randomUUID(),name:name.trim(),email:normalized,password:p,role:"student",createdAt:new Date().toISOString()};
  db.users.push(user);
  const token=makeSession(user.id);
  res.setHeader("Set-Cookie",`scorepath_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
  saveDB(db);
  res.json({ok:true});
});
app.post("/api/login",(req,res)=>{
  const {email,password}=req.body||{};
  const u=db.users.find(x=>x.email===(email||"").trim().toLowerCase());
  if(!u || !verifyPassword(password||"",u.password)) return res.status(401).json({error:"Incorrect email or password."});
  const token=makeSession(u.id);
  res.setHeader("Set-Cookie",`scorepath_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
  res.json({ok:true});
});
app.post("/api/logout",(req,res)=>{
  const raw=req.headers.cookie||""; const m=raw.match(/scorepath_session=([^;]+)/);
  if(m){ delete db.sessions[m[1]]; saveDB(db); }
  res.setHeader("Set-Cookie","scorepath_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ok:true});
});

app.post("/api/subscribe",requireUser,async(req,res)=>{
  const plan=req.body?.plan;
  const config = plan==="monthly"
    ? {name:"ScorePath Monthly",amount:20000,days:30,planId:process.env.RAZORPAY_MONTHLY_PLAN_ID}
    : plan==="quarterly" ? {name:"ScorePath 3 Months",amount:50000,days:90,planId:process.env.RAZORPAY_QUARTERLY_PLAN_ID}
    : null;
  if(!config) return res.status(400).json({error:"Invalid plan."});

  if(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET){
    try{
      const rz=new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
      const order=await rz.orders.create({amount:config.amount,currency:"INR",receipt:`sp_${Date.now()}`,notes:{userId:req.user.id,plan}});
      return res.json({mode:"razorpay",keyId:process.env.RAZORPAY_KEY_ID,orderId:order.id,amount:order.amount,currency:order.currency,plan});
    }catch(e){ return res.status(502).json({error:"Payment setup is not available yet. Please try again later."}); }
  }
  res.status(503).json({error:"Online payment is not configured yet. Add your Razorpay keys in the hosting environment first."});
});

app.post("/api/payment/verify",requireUser,(req,res)=>{
  const {razorpay_order_id,razorpay_payment_id,razorpay_signature,plan}=req.body||{};
  if(!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({error:"Payment verification is not configured."});
  const payload=`${razorpay_order_id}|${razorpay_payment_id}`;
  const expected=crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update(payload).digest("hex");
  if(expected!==razorpay_signature) return res.status(400).json({error:"Payment verification failed."});
  const days=plan==="monthly"?30:90;
  const sub={id:crypto.randomUUID(),userId:req.user.id,plan,status:"active",provider:"razorpay",paymentId:razorpay_payment_id,startsAt:new Date().toISOString(),expiresAt:new Date(Date.now()+days*86400000).toISOString()};
  db.subscriptions.push(sub); saveDB(db); res.json({ok:true,subscription:sub});
});

app.get("/api/dashboard",requireUser,(req,res)=>{
  const sub=activeSub(req.user.id);
  res.json({user:{name:req.user.name,email:req.user.email},subscription:sub||null,lessons:db.lessons,classes:db.classes});
});
app.post("/api/test/submit",requireUser,(req,res)=>{
  const answers=req.body?.answers||{};
  let score=0,total=db.questions.length;
  db.questions.forEach(q=>{ if(Number(answers[q.id])===q.answer) score++; });
  res.json({score,total,percent:Math.round(score/total*100)});
});

app.get("/api/admin/stats",requireAdmin,(req,res)=>{
  res.json({users:db.users.filter(u=>u.role==="student").length,subscriptions:db.subscriptions.filter(s=>s.status==="active").length,lessons:db.lessons.length,classes:db.classes.length});
});
app.post("/api/admin/class",requireAdmin,(req,res)=>{
  const {title,type,date,time,link}=req.body||{};
  if(!title) return res.status(400).json({error:"Title required."});
  const c={id:crypto.randomUUID(),title,type:type||"IELTS + PTE",date:date||"",time:time||"",link:link||""};
  db.classes.push(c); saveDB(db); res.json({ok:true,class:c});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));

module.exports = app;

if (require.main === module) {
  app.listen(PORT,()=>console.log(`ScorePath running on port ${PORT}`));
}
