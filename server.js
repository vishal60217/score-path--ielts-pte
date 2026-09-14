require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DB = path.join(DATA_DIR, 'db.json');
// Neon/Vercel integrations normally expose DATABASE_URL. The fallbacks make
// the app tolerant of older Vercel Postgres/Neon environment names too.
const rawDatabaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || '';
const databaseUrl = rawDatabaseUrl.trim().replace(/^['\"]|['\"]$/g, '');
const hasPostgres = !!databaseUrl;
let pgPool = null;
if (hasPostgres) {
  const { Pool } = require('pg');
  pgPool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, keepAlive: true });
  pgPool.on('error', err => console.error('PostgreSQL pool error:', err.message));
}

const seed = {
  settings: { bankName:'', accountName:'', accountNumber:'', ifsc:'', upiId:'', supportEmail: process.env.SUPPORT_EMAIL || '', siteName:'ScorePath' },
  users: [], sessions: {}, subscriptions: [], payments: [], progress: [],
  teachers: [
    {id:'t1',name:'Add your teacher',bio:'IELTS & PTE instructor',photoUrl:''}
  ],
  classes: [
    {id:'c1',title:'IELTS Speaking Live Lab',exam:'IELTS',date:'Every Monday',time:'7:00 PM IST',instructor:'Add your teacher',teacherId:'t1',link:'',description:'Speaking practice, feedback and live Q&A.'},
    {id:'c2',title:'PTE Fluency & Pronunciation',exam:'PTE',date:'Every Wednesday',time:'7:00 PM IST',instructor:'Add your teacher',teacherId:'t1',link:'',description:'Fluency drills and exam-focused speaking practice.'},
    {id:'c3',title:'Academic Writing Workshop',exam:'Academic',date:'Every Friday',time:'7:00 PM IST',instructor:'Add your teacher',teacherId:'t1',link:'',description:'Structure, coherence, grammar and feedback.'}
  ],
  courses: [
    {id:'ielts-core',exam:'IELTS',title:'Core IELTS',description:'A complete foundation across Listening, Reading, Writing and Speaking.',skills:['Listening','Reading','Writing','Speaking'],published:true},
    {id:'pte-core',exam:'PTE',title:'Core PTE',description:'PTE-focused strategies, fluency, vocabulary and task practice.',skills:['Speaking','Writing','Reading','Listening'],published:true},
    {id:'academic',exam:'Academic',title:'Academic English',description:'Build the language needed for university study, essays and formal communication.',skills:['Academic Writing','Grammar','Vocabulary'],published:true},
    {id:'vocab-grammar',exam:'English',title:'Vocabulary & Grammar',description:'High-value vocabulary, collocations and grammar lessons for stronger English.',skills:['Vocabulary','Grammar','Collocations'],published:true}
  ],
  plans: [
    {id:'monthly',name:'Monthly',price:200,days:30,featured:false,courseIds:['ielts-core','pte-core','academic','vocab-grammar'],features:['All IELTS + PTE lessons','Academic English','Vocabulary & Grammar','Practice tests','Live class schedule','Progress tracking'],published:true},
    {id:'quarterly',name:'3 Months',price:500,days:90,featured:true,courseIds:['ielts-core','pte-core','academic','vocab-grammar'],features:['Everything in Monthly','90 days of access','Best value','Progress tracking','Live sessions'],published:true}
  ],
  lessons: [
    ['ielts-reading-1','ielts-core','IELTS','Reading','Skimming & Scanning','Read the question first. Identify keywords and scan for names, dates, numbers and distinctive terms. Then read the surrounding lines carefully before choosing an answer.',['Find answers faster','Recognise keywords and paraphrases','Avoid reading every word']],
    ['ielts-listening-1','ielts-core','IELTS','Listening','Predict Before You Listen','Underline key words and predict the type of answer. Listen for corrections, distractors and changes in meaning. Check spelling and word limits.',['Predict answer types','Handle distractors','Improve accuracy']],
    ['ielts-writing-1','ielts-core','IELTS','Writing','Task 2 Essay Structure','Use a direct introduction, focused body paragraphs and a concise conclusion. Each paragraph should have one main idea supported by explanation or an example.',['Build clear paragraphs','Improve coherence','Write directly']],
    ['ielts-speaking-1','ielts-core','IELTS','Speaking','Fluency & Development','Answer directly, extend your ideas, give reasons or examples and use natural linking language. Focus on communication rather than memorised scripts.',['Extend answers naturally','Improve fluency','Use flexible language']],
    ['pte-speaking-1','pte-core','PTE','Speaking','Read Aloud & Repeat Sentence','Keep a steady pace and clear pronunciation. Avoid restarting repeatedly. Prioritise accurate content, smooth delivery and confident rhythm.',['Improve fluency','Reduce hesitation','Use clear pronunciation']],
    ['pte-reading-1','pte-core','PTE','Reading','Fill in the Blanks Strategy','Read the whole sentence for meaning and grammar, then compare collocations and word forms. Eliminate options that do not fit the surrounding structure.',['Use collocations','Check grammar','Eliminate distractors']],
    ['pte-listening-1','pte-core','PTE','Listening','Note the Main Idea','Listen for topic, speaker purpose and key details. Take short notes rather than trying to write every word.',['Capture key ideas','Use efficient notes','Identify speaker purpose']],
    ['pte-writing-1','pte-core','PTE','Writing','Summarise Written Text','Identify the central idea and key supporting point, then combine them into one grammatically complete sentence within the required format.',['Find the central idea','Combine information','Check grammar']],
    ['academic-1','academic','Academic','Writing','Academic Paragraphs','A strong academic paragraph normally has a clear topic sentence, explanation, evidence or example, and a link back to the main point. Avoid unsupported generalisations.',['Write focused paragraphs','Support claims','Use formal tone']],
    ['academic-2','academic','Academic','Vocabulary','Academic Word Families','Learn how nouns, verbs, adjectives and adverbs change form. Check which form fits the grammar of the sentence rather than memorising isolated words.',['Recognise word families','Improve word choice','Avoid form errors']],
    ['academic-3','academic','Academic','Grammar','Complex Sentences','Use subordinate clauses, relative clauses and logical connectors to show relationships between ideas. Complexity should remain clear and accurate.',['Build complex sentences','Use connectors','Maintain clarity']],
    ['academic-4','academic','Academic','Study Skills','Paraphrasing Without Changing Meaning','Change structure, word choice and grammatical form while preserving the original meaning. Do not replace every word with a synonym blindly.',['Paraphrase safely','Avoid meaning changes','Reduce repetition']],
    ['vocab-1','vocab-grammar','English','Vocabulary','High-Value Academic Vocabulary','Build vocabulary by topic and learn words together with common collocations. Review actively by producing your own sentences.',['Learn useful vocabulary','Use collocations','Review actively']],
    ['vocab-2','vocab-grammar','English','Vocabulary','Collocations for Natural English','Collocations are words that commonly occur together, such as make a decision and conduct research. Learning them improves both accuracy and naturalness.',['Recognise collocations','Improve naturalness','Avoid literal translations']],
    ['vocab-3','vocab-grammar','English','Grammar','Tenses for Accuracy','Choose tense based on time and meaning. Pay special attention to present perfect versus past simple when describing experiences and completed events.',['Choose the right tense','Improve accuracy','Describe time clearly']],
    ['vocab-4','vocab-grammar','English','Grammar','Articles: A, An and The','Use a/an for a non-specific singular countable noun and the when the listener or reader can identify the specific thing. Learn common exceptions through examples.',['Use articles correctly','Identify specific reference','Reduce common errors']],
    ['vocab-5','vocab-grammar','English','Grammar','Subject–Verb Agreement','The verb must agree with the true subject, not a nearby noun. Watch carefully when phrases or clauses come between the subject and verb.',['Find the true subject','Avoid agreement errors','Edit sentences effectively']],
    ['vocab-6','vocab-grammar','English','Grammar','Linking Words & Coherence','Use connectors to show contrast, cause, result, addition and examples. Do not overuse them; logical relationships should remain natural.',['Show logical relationships','Improve coherence','Avoid connector overload']]
  ].map(x=>({id:x[0],courseId:x[1],exam:x[2],skill:x[3],title:x[4],body:x[5],objectives:x[6],published:true})),
  questions:[
    {id:'q1',test:'IELTS',prompt:'The research was _____ because it used data from several independent sources.',options:['credible','credibly','credibility','credit'],answer:0},
    {id:'q2',test:'IELTS',prompt:'The meeting has been _____ until Friday.',options:['postponed','postponing','postpone','postponement'],answer:0},
    {id:'q3',test:'PTE',prompt:'The new policy will have a significant _____ on small businesses.',options:['affect','effect','effective','effectively'],answer:1},
    {id:'q4',test:'PTE',prompt:'Which is the strongest academic sentence?',options:['People say technology is good.','Technology can improve access to education when it is implemented effectively.','Technology is very very useful.','I think tech is awesome.'],answer:1}
  ]
};

function clone(x){return JSON.parse(JSON.stringify(x));}
function initLocal(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
  if(!fs.existsSync(LOCAL_DB)) fs.writeFileSync(LOCAL_DB,JSON.stringify(seed,null,2));
  try{
    const d=JSON.parse(fs.readFileSync(LOCAL_DB,'utf8'));
    for(const c of d.courses||[]){c.lessons=(d.lessons||[]).filter(l=>l.courseId===c.id).length;c.firstLessonId=(d.lessons||[]).find(l=>l.courseId===c.id)?.id||'';}
    return d;
  }catch{return clone(seed);}
}
let localDb = hasPostgres ? null : initLocal();
function localSave(){fs.writeFileSync(LOCAL_DB,JSON.stringify(localDb,null,2));}

async function sql(text, params=[]){const r=await pgPool.query(text,params); return r.rows;}
async function initPostgres(){
  await sql(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_salt TEXT,password_hash TEXT,role TEXT NOT NULL DEFAULT 'student',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS teachers(id TEXT PRIMARY KEY,name TEXT NOT NULL,bio TEXT NOT NULL DEFAULT '',photo_url TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,exam TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',skills JSONB NOT NULL DEFAULT '[]',published BOOLEAN NOT NULL DEFAULT TRUE);
  CREATE TABLE IF NOT EXISTS lessons(id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,exam TEXT NOT NULL,skill TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,objectives JSONB NOT NULL DEFAULT '[]',published BOOLEAN NOT NULL DEFAULT TRUE);
  CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,name TEXT NOT NULL,price INTEGER NOT NULL,days INTEGER NOT NULL,featured BOOLEAN NOT NULL DEFAULT FALSE,course_ids JSONB NOT NULL DEFAULT '[]',features JSONB NOT NULL DEFAULT '[]',published BOOLEAN NOT NULL DEFAULT TRUE);
  CREATE TABLE IF NOT EXISTS classes(id TEXT PRIMARY KEY,title TEXT NOT NULL,exam TEXT NOT NULL,date TEXT NOT NULL DEFAULT '',time TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL,teacher_id TEXT,link TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,plan_id TEXT NOT NULL,course_ids JSONB NOT NULL DEFAULT '[]',status TEXT NOT NULL,provider TEXT NOT NULL,payment_id TEXT,starts_at TIMESTAMPTZ NOT NULL,expires_at TIMESTAMPTZ NOT NULL);
  CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,plan_id TEXT NOT NULL,amount INTEGER NOT NULL,utr TEXT UNIQUE,status TEXT NOT NULL,provider TEXT NOT NULL DEFAULT 'manual',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),approved_at TIMESTAMPTZ,approved_by TEXT);
  CREATE TABLE IF NOT EXISTS payment_orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,plan_id TEXT NOT NULL,amount INTEGER NOT NULL,provider TEXT NOT NULL,provider_order_id TEXT UNIQUE NOT NULL,status TEXT NOT NULL DEFAULT 'created',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),paid_at TIMESTAMPTZ);
  CREATE TABLE IF NOT EXISTS progress(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,lesson_id));
  CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,test TEXT NOT NULL,prompt TEXT NOT NULL,options JSONB NOT NULL DEFAULT '[]',answer INTEGER NOT NULL);`);
  // Safe migrations for databases created by an earlier ScorePath build.
  await sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE lessons ADD COLUMN IF NOT EXISTS objectives JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE lessons ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS course_ids JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS teacher_id TEXT;
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS link TEXT NOT NULL DEFAULT '';
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_by TEXT;
  `);

  const count=await sql('SELECT COUNT(*)::int AS n FROM courses');
  if(count[0].n===0){
    for(const c of seed.courses) await sql('INSERT INTO courses(id,exam,title,description,skills,published) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',[c.id,c.exam,c.title,c.description,JSON.stringify(c.skills),c.published]);
  }
  const lessonCount=await sql('SELECT COUNT(*)::int AS n FROM lessons');
  if(lessonCount[0].n===0){
    for(const l of seed.lessons) await sql('INSERT INTO lessons(id,course_id,exam,skill,title,body,objectives,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING',[l.id,l.courseId,l.exam,l.skill,l.title,l.body,JSON.stringify(l.objectives),l.published]);
  }
  const planCount=await sql('SELECT COUNT(*)::int AS n FROM plans');
  if(planCount[0].n===0){
    for(const p of seed.plans) await sql('INSERT INTO plans(id,name,price,days,featured,course_ids,features,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING',[p.id,p.name,p.price,p.days,p.featured,JSON.stringify(p.courseIds),JSON.stringify(p.features),p.published]);
  }
  const teacherCount=await sql('SELECT COUNT(*)::int AS n FROM teachers');
  if(teacherCount[0].n===0){
    for(const t of seed.teachers) await sql('INSERT INTO teachers(id,name,bio,photo_url) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[t.id,t.name,t.bio,t.photoUrl]);
  }
  const classCount=await sql('SELECT COUNT(*)::int AS n FROM classes');
  if(classCount[0].n===0){
    for(const c of seed.classes) await sql('INSERT INTO classes(id,title,exam,date,time,instructor,teacher_id,link,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING',[c.id,c.title,c.exam,c.date,c.time,c.instructor,c.teacherId,c.link,c.description]);
  }
  const questionCount=await sql('SELECT COUNT(*)::int AS n FROM questions');
  if(questionCount[0].n===0){
    for(const q of seed.questions) await sql('INSERT INTO questions(id,test,prompt,options,answer) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[q.id,q.test,q.prompt,JSON.stringify(q.options),q.answer]);
  }
  for(const [k,v] of Object.entries(seed.settings)){await sql('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING',[k,String(v)]);}
}

async function getAll(){
  if(!hasPostgres) return localDb;
  const [users,sessions,settings,teachers,courses,lessons,plans,classes,subscriptions,payments,progress,questions]=await Promise.all([
    sql('SELECT id,name,email,password_salt as "salt",password_hash as "hash",role,created_at as "createdAt" FROM users'),
    sql('SELECT token,user_id as "userId",extract(epoch from expires_at)*1000 as expires FROM sessions'),
    sql('SELECT key,value FROM settings'),sql('SELECT id,name,bio,photo_url as "photoUrl" FROM teachers'),sql('SELECT id,exam,title,description,skills,published FROM courses'),sql('SELECT id,course_id as "courseId",exam,skill,title,body,objectives,published FROM lessons'),sql('SELECT id,name,price,days,featured,course_ids as "courseIds",features,published FROM plans'),sql('SELECT id,title,exam,date,time,instructor,teacher_id as "teacherId",link,description FROM classes'),sql('SELECT id,user_id as "userId",plan_id as plan,"courseIds",status,provider,payment_id as "paymentId",starts_at as "startsAt",expires_at as "expiresAt" FROM subscriptions'),sql('SELECT id,user_id as "userId",plan_id as plan,amount,utr,status,provider,created_at as "createdAt",approved_at as "approvedAt",approved_by as "approvedBy" FROM payments'),sql('SELECT id,user_id as "userId",lesson_id as "lessonId",completed_at as "completedAt" FROM progress'),sql('SELECT id,test,prompt,options,answer FROM questions').catch(()=>[])
  ]);
  for(const c of courses){c.skills=Array.isArray(c.skills)?c.skills:[];c.lessons=lessons.filter(l=>l.courseId===c.id).length;c.firstLessonId=lessons.find(l=>l.courseId===c.id)?.id||'';}
  const db={settings:Object.fromEntries(settings.map(x=>[x.key,x.value])),users,sessions:Object.fromEntries(sessions.map(x=>[x.token,{userId:x.userId,expires:Number(x.expires)}])),teachers,courses,lessons,plans,pricing:plans,classes,subscriptions,payments,progress,questions};
  return db;
}
async function saveRecord(type,obj){
  if(!hasPostgres){localSave();return;}
  // Mutations use direct SQL in endpoint handlers; this is only a safety no-op.
}

const hashPassword=(password,salt=crypto.randomBytes(16).toString('hex'))=>({salt,hash:crypto.scryptSync(password,salt,64).toString('hex')});
function verifyPassword(password,stored){if(!stored?.salt||!stored?.hash)return false;const h=crypto.scryptSync(password,stored.salt,64);const s=Buffer.from(stored.hash,'hex');return h.length===s.length&&crypto.timingSafeEqual(h,s);}
function cookieOpts(){return `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV==='production'?' ; Secure':''}`.replace(' ;',';');}
async function currentUser(req){const m=(req.headers.cookie||'').match(/scorepath_session=([^;]+)/);if(!m)return null; if(hasPostgres){const rows=await sql('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>NOW()',[m[1]]);return rows[0]||null;} const s=localDb.sessions[m[1]];if(!s||s.expires<Date.now())return null;return localDb.users.find(u=>u.id===s.userId)||null;}
async function auth(req,res,next){try{const u=await currentUser(req);if(!u)return res.status(401).json({error:'Please log in.'});req.user=u;next();}catch(e){console.error(e);res.status(500).json({error:'Authentication service error.'});}}
async function admin(req,res,next){try{const u=await currentUser(req);if(!u||u.role!=='admin')return res.status(403).json({error:'Admin access required.'});req.user=u;next();}catch(e){res.status(500).json({error:'Authentication service error.'});}}
async function activeSub(userId){if(hasPostgres){const r=await sql("SELECT * FROM subscriptions WHERE user_id=$1 AND status='active' AND expires_at>NOW() ORDER BY expires_at DESC LIMIT 1",[userId]);return r[0]||null;}return localDb.subscriptions.filter(s=>s.userId===userId&&s.status==='active'&&new Date(s.expiresAt)>new Date()).sort((a,b)=>new Date(b.expiresAt)-new Date(a.expiresAt))[0]||null;}
async function planConfig(id){if(hasPostgres){const r=await sql('SELECT id,name,price,days,featured,course_ids as "courseIds",features,published FROM plans WHERE id=$1',[id]);return r[0]||null;}return localDb.plans.find(p=>p.id===id)||null;}
async function settings(){if(hasPostgres){const r=await sql('SELECT key,value FROM settings');return Object.fromEntries(r.map(x=>[x.key,x.value]));}return localDb.settings;}
async function ensureAdmin(){
  if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)return;
  const email=process.env.ADMIN_EMAIL.toLowerCase();
  if(hasPostgres){const r=await sql('SELECT id FROM users WHERE email=$1',[email]);if(r.length)return;const p=hashPassword(process.env.ADMIN_PASSWORD);await sql('INSERT INTO users(id,name,email,password_salt,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),process.env.ADMIN_NAME||'ScorePath Admin',email,p.salt,p.hash,'admin']);}
  else {if(localDb.users.some(u=>u.email===email))return;const p=hashPassword(process.env.ADMIN_PASSWORD);localDb.users.push({id:crypto.randomUUID(),name:process.env.ADMIN_NAME||'ScorePath Admin',email,password:p,role:'admin',createdAt:new Date().toISOString()});localSave();}
}

app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');next();});
app.get('/app.js',(q,r)=>r.sendFile(path.join(__dirname,'app.js')));
app.get('/styles.css',(q,r)=>r.sendFile(path.join(__dirname,'styles.css')));
let startupError=null;
let startupPromise;
app.get('/api/health',async(q,r)=>{
  if(startupPromise) await startupPromise.catch(()=>{});
  const healthy=!startupError;
  const detail = startupError ? { code: startupError.code || startupError.name || 'DB_INIT_ERROR', message: process.env.NODE_ENV === 'production' ? 'Database initialization failed. Check DATABASE_URL, Neon connection, and Vercel logs.' : startupError.message } : null;
  r.status(healthy?200:503).json({ok:healthy,service:'ScorePath',database:hasPostgres?'postgres':'local',productionReady:hasPostgres&&healthy,databaseConfigured:hasPostgres,error:detail});
});
app.use(async(req,res,next)=>{try{if(startupPromise)await startupPromise;if(startupError && req.path.startsWith('/api/'))return res.status(503).json({error:'Database is not ready. Open /api/health for diagnostics.'});next()}catch(e){console.error(e);res.status(503).json({error:'ScorePath is starting. Please retry in a moment.'})}});

app.get('/api/content',async(q,r)=>{try{const d=await getAll();const courses=(d.courses||[]).filter(x=>x.published!==false);const courseIds=new Set(courses.map(x=>x.id));r.json({courses,lessons:(d.lessons||[]).filter(x=>courseIds.has(x.courseId)&&x.published!==false).map(({body,objectives,...x})=>x),classes:d.classes||[],teachers:d.teachers||[],pricing:(d.plans||d.pricing||[]).filter(x=>x.published!==false),questions:d.questions||[]});}catch(e){console.error(e);r.status(500).json({error:'Could not load course content.'});}});
app.get('/api/me',async(q,r)=>{try{const u=await currentUser(q);r.json({user:u?{id:u.id,name:u.name,email:u.email,role:u.role}:null,subscription:u?await activeSub(u.id):null});}catch(e){r.status(500).json({error:'Could not load account.'});}});

app.post('/api/register',async(q,r)=>{try{const{name,email,password}=q.body||{};if(!name||!email||!password||password.length<8)return r.status(400).json({error:'Enter your name, a valid email and a password of at least 8 characters.'});const e=email.trim().toLowerCase();let exists=false;if(hasPostgres)exists=(await sql('SELECT 1 FROM users WHERE email=$1',[e])).length>0;else exists=localDb.users.some(u=>u.email===e);if(exists)return r.status(409).json({error:'An account with this email already exists.'});const u={id:crypto.randomUUID(),name:name.trim(),email:e,role:'student',createdAt:new Date().toISOString()};const p=hashPassword(password);if(hasPostgres)await sql('INSERT INTO users(id,name,email,password_salt,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)',[u.id,u.name,u.email,p.salt,p.hash,u.role]);else{u.password=p;localDb.users.push(u);localSave();}const token=crypto.randomBytes(32).toString('hex');if(hasPostgres)await sql("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[token,u.id]);else{localDb.sessions[token]={userId:u.id,expires:Date.now()+2592000000};localSave();}r.setHeader('Set-Cookie',`scorepath_session=${token}; ${cookieOpts()}`);r.json({ok:true});}catch(e){console.error(e);r.status(500).json({error:'Could not create your account.'});}});
app.post('/api/login',async(q,r)=>{try{const{email,password}=q.body||{};const e=(email||'').trim().toLowerCase();let u;if(hasPostgres)u=(await sql('SELECT id,name,email,password_salt as salt,password_hash as hash,role FROM users WHERE email=$1',[e]))[0];else u=localDb.users.find(x=>x.email===e);if(!u||!verifyPassword(password||'',u.password||u))return r.status(401).json({error:'Incorrect email or password.'});const token=crypto.randomBytes(32).toString('hex');if(hasPostgres)await sql("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[token,u.id]);else{localDb.sessions[token]={userId:u.id,expires:Date.now()+2592000000};localSave();}r.setHeader('Set-Cookie',`scorepath_session=${token}; ${cookieOpts()}`);r.json({ok:true});}catch(e){console.error(e);r.status(500).json({error:'Could not log in.'});}});
app.post('/api/logout',async(q,r)=>{try{const m=(q.headers.cookie||'').match(/scorepath_session=([^;]+)/);if(m){if(hasPostgres)await sql('DELETE FROM sessions WHERE token=$1',[m[1]]);else{delete localDb.sessions[m[1]];localSave();}}r.setHeader('Set-Cookie','scorepath_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');r.json({ok:true});}catch(e){r.status(500).json({error:'Could not log out.'});}});

app.get('/api/lessons/:id',auth,async(q,r)=>{try{let l;if(hasPostgres)l=(await sql('SELECT id,course_id as "courseId",exam,skill,title,body,objectives,published FROM lessons WHERE id=$1',[q.params.id]))[0];else l=localDb.lessons.find(x=>x.id===q.params.id);if(!l||l.published===false)return r.status(404).json({error:'Lesson not found.'});const sub=await activeSub(q.user.id);if(!sub)return r.status(402).json({error:'An active membership is required to open paid lessons.'});const ids=sub.courseIds||sub.course_ids||[];if(ids.length && !ids.includes(l.courseId))return r.status(403).json({error:'Your membership does not include this course.'});r.json(l);}catch(e){console.error(e);r.status(500).json({error:'Could not open lesson.'});}});
app.post('/api/progress',auth,async(q,r)=>{try{if(!await activeSub(q.user.id))return r.status(402).json({error:'An active membership is required.'});const id=q.body?.lessonId;let ok;if(hasPostgres)ok=(await sql('SELECT 1 FROM lessons WHERE id=$1',[id])).length>0;else ok=localDb.lessons.some(l=>l.id===id);if(!ok)return r.status(404).json({error:'Lesson not found.'});if(hasPostgres)await sql('INSERT INTO progress(id,user_id,lesson_id) VALUES($1,$2,$3) ON CONFLICT(user_id,lesson_id) DO NOTHING',[crypto.randomUUID(),q.user.id,id]);else{if(!localDb.progress.some(p=>p.userId===q.user.id&&p.lessonId===id))localDb.progress.push({id:crypto.randomUUID(),userId:q.user.id,lessonId:id,completedAt:new Date().toISOString()});localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not save progress.'});}});
app.get('/api/dashboard',auth,async(q,r)=>{try{const sub=await activeSub(q.user.id);let done,total,courses;if(hasPostgres){done=(await sql('SELECT COUNT(*)::int AS n FROM progress WHERE user_id=$1',[q.user.id]))[0].n;total=(await sql('SELECT COUNT(*)::int AS n FROM lessons WHERE published=true'))[0].n;courses=await sql('SELECT id,exam,title,description,skills FROM courses WHERE published=true ORDER BY title');}else{done=localDb.progress.filter(p=>p.userId===q.user.id).length;total=localDb.lessons.filter(l=>l.published!==false).length;courses=localDb.courses.filter(c=>c.published!==false);}const ids=sub?.courseIds||sub?.course_ids||[];r.json({user:{name:q.user.name,email:q.user.email},subscription:sub?{...sub,planName:(await planConfig(sub.plan_id||sub.plan))?.name}:null,progress:{completed:done,total},courses:courses.map(c=>({...c,access:!!sub&&(!ids.length||ids.includes(c.id))}))});}catch(e){console.error(e);r.status(500).json({error:'Could not load dashboard.'});}});
app.post('/api/test/submit',auth,async(q,r)=>{try{const d=await getAll();const answers=q.body?.answers||{};let score=0;(d.questions||[]).forEach(x=>{if(Number(answers[x.id])===x.answer)score++;});const total=(d.questions||[]).length;const percent=total?Math.round(score/total*100):0;r.json({score,total,percent,message:percent>=75?'Strong start — keep practising.':percent>=50?'Good foundation — review your weak areas.':'Keep practising — start with the core lessons and vocabulary.'});}catch(e){r.status(500).json({error:'Could not score the test.'});}});

app.post('/api/subscribe',auth,async(q,r)=>{try{const cfg=await planConfig(q.body?.plan);if(!cfg||cfg.published===false)return r.status(400).json({error:'Invalid plan.'});
if(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET){const rz=new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});const order=await rz.orders.create({amount:Number(cfg.price)*100,currency:'INR',receipt:`sp_${Date.now()}`,notes:{userId:q.user.id,plan:q.body.plan}});if(hasPostgres)await sql('INSERT INTO payment_orders(id,user_id,plan_id,amount,provider,provider_order_id,status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider_order_id) DO NOTHING',[crypto.randomUUID(),q.user.id,q.body.plan,cfg.price,'razorpay',order.id,'created']);return r.json({mode:'razorpay',keyId:process.env.RAZORPAY_KEY_ID,orderId:order.id,amount:order.amount,currency:'INR',plan:q.body.plan,planName:cfg.name,prefill:{name:q.user.name,email:q.user.email}});}
const s=await settings();const hasBank=!!(s.bankName||s.accountName||s.accountNumber||s.ifsc||s.upiId);if(!hasBank)return r.status(503).json({error:'Payment is not configured yet. Admin must add bank/UPI details in Admin → Bank & settings, or connect Razorpay keys.'});r.json({mode:'bank_transfer',amount:cfg.price,plan:q.body.plan,planName:cfg.name,bank:{bankName:s.bankName||'',accountName:s.accountName||'',accountNumber:s.accountNumber||'',ifsc:s.ifsc||'',upiId:s.upiId||''},instructions:'Transfer the exact amount using the details below, then submit your UTR/transaction number. An admin must verify it before access is activated.'});}catch(e){console.error(e);r.status(502).json({error:'Could not start payment.'});}});

async function activateMembership(userId,planId,provider,paymentId){const cfg=await planConfig(planId);if(!cfg)throw new Error('Plan not found');const current=await activeSub(userId);const currentExpiry=current?new Date(current.expiresAt||current.expires_at):new Date();const start=currentExpiry>new Date()?currentExpiry:new Date();const expires=new Date(start.getTime()+Number(cfg.days)*86400000);const sub={id:crypto.randomUUID(),userId,plan:planId,courseIds:cfg.courseIds||cfg.course_ids||[],status:'active',provider,paymentId,startsAt:new Date().toISOString(),expiresAt:expires.toISOString()};if(hasPostgres)await sql('INSERT INTO subscriptions(id,user_id,plan_id,course_ids,status,provider,payment_id,starts_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[sub.id,userId,planId,JSON.stringify(sub.courseIds),'active',provider,paymentId,sub.startsAt,sub.expiresAt]);else{localDb.subscriptions.push(sub);localSave();}return sub;}
app.post('/api/payment/verify',auth,async(q,r)=>{try{const{razorpay_order_id,razorpay_payment_id,razorpay_signature}=q.body||{};if(!process.env.RAZORPAY_KEY_SECRET)return r.status(503).json({error:'Payment verification is not configured.'});if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature)return r.status(400).json({error:'Incomplete payment response.'});
  const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  const provided=Buffer.from(String(razorpay_signature));const expectedBuf=Buffer.from(expected);
  if(provided.length!==expectedBuf.length||!crypto.timingSafeEqual(expectedBuf,provided))return r.status(400).json({error:'Payment verification failed.'});
  let orderPlan=null;
  if(hasPostgres){const rows=await sql('SELECT * FROM payment_orders WHERE provider_order_id=$1 AND user_id=$2 LIMIT 1',[razorpay_order_id,q.user.id]);if(!rows.length)return r.status(400).json({error:'Payment order was not created by this account.'});if(rows[0].status==='paid')return r.json({ok:true,alreadyPaid:true});orderPlan=rows[0].plan_id;await sql("UPDATE payment_orders SET status='paid',paid_at=NOW() WHERE provider_order_id=$1",[razorpay_order_id]);}
  else orderPlan=q.body.plan;
  const sub=await activateMembership(q.user.id,orderPlan,'razorpay',razorpay_payment_id);r.json({ok:true,subscription:sub});
}catch(e){console.error(e);r.status(500).json({error:'Could not activate membership.'});}});
app.post('/api/payment/manual',auth,async(q,r)=>{try{const cfg=await planConfig(q.body?.plan);const utr=(q.body?.utr||'').trim();if(!cfg||utr.length<6)return r.status(400).json({error:'Choose a plan and enter a valid UTR/transaction number.'});if(hasPostgres){if((await sql('SELECT 1 FROM payments WHERE utr=$1',[utr])).length)return r.status(409).json({error:'This transaction number has already been submitted.'});await sql('INSERT INTO payments(id,user_id,plan_id,amount,utr,status,provider) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),q.user.id,q.body.plan,cfg.price,utr,'pending','manual']);}else{if(localDb.payments.some(p=>p.utr===utr))return r.status(409).json({error:'This transaction number has already been submitted.'});localDb.payments.push({id:crypto.randomUUID(),userId:q.user.id,plan:q.body.plan,amount:cfg.price,utr,status:'pending',provider:'manual',createdAt:new Date().toISOString()});localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not submit payment proof.'});}});

app.get('/api/admin/overview',admin,async(q,r)=>{try{const d=await getAll();const active=(d.subscriptions||[]).filter(s=>s.status==='active'&&new Date(s.expiresAt||s.expires_at)>new Date()).length;const pending=(d.payments||[]).filter(p=>p.status==='pending');const students=(d.users||[]).filter(u=>u.role==='student').length;r.json({stats:{students,activeSubscriptions:active,pendingPayments:pending.length,courses:(d.courses||[]).length,lessons:(d.lessons||[]).length,teachers:(d.teachers||[]).length},bank:d.settings||{},users:(d.users||[]).map(u=>({id:u.id,name:u.name,email:u.email,role:u.role,active:!!(d.subscriptions||[]).find(s=>s.userId===u.id&&s.status==='active'&&new Date(s.expiresAt||s.expires_at)>new Date())})),pendingPayments:pending.map(p=>({...p,userName:d.users.find(u=>u.id===(p.userId||p.user_id))?.name||'Unknown',planName:(d.plans||d.pricing||[]).find(x=>x.id===(p.plan||p.plan_id))?.name||(p.plan||p.plan_id)})),courses:d.courses||[],lessons:d.lessons||[],plans:d.plans||d.pricing||[],teachers:d.teachers||[],classes:d.classes||[]});}catch(e){console.error(e);r.status(500).json({error:'Could not load admin data.'});}});

app.post('/api/admin/settings',admin,async(q,r)=>{try{const allowed=['bankName','accountName','accountNumber','ifsc','upiId','supportEmail','siteName'];const input=q.body||{};if(hasPostgres){for(const k of allowed)if(k in input)await sql('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[k,String(input[k]||'')]);}else{for(const k of allowed)if(k in input)localDb.settings[k]=String(input[k]||'');localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not save settings.'});}});

app.post('/api/admin/course',admin,async(q,r)=>{try{const{x}=q.body||{};if(!x?.title||!x?.exam)return r.status(400).json({error:'Course title and exam are required.'});const c={id:x.id||crypto.randomUUID(),exam:x.exam,title:x.title,description:x.description||'',skills:Array.isArray(x.skills)?x.skills:[],published:x.published!==false};if(hasPostgres)await sql('INSERT INTO courses(id,exam,title,description,skills,published) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET exam=$2,title=$3,description=$4,skills=$5,published=$6',[c.id,c.exam,c.title,c.description,JSON.stringify(c.skills),c.published]);else{const i=localDb.courses.findIndex(z=>z.id===c.id);if(i>=0)localDb.courses[i]=c;else localDb.courses.push(c);localSave();}r.json({ok:true,course:c});}catch(e){console.error(e);r.status(500).json({error:'Could not save course.'});}});
app.post('/api/admin/course/:id/delete',admin,async(q,r)=>{try{if(hasPostgres)await sql('DELETE FROM courses WHERE id=$1',[q.params.id]);else{localDb.courses=localDb.courses.filter(c=>c.id!==q.params.id);localDb.lessons=localDb.lessons.filter(l=>l.courseId!==q.params.id);localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not delete course.'});}});

app.post('/api/admin/lesson',admin,async(q,r)=>{try{const{x}=q.body||{};if(!x?.title||!x?.courseId||!x?.body)return r.status(400).json({error:'Course, lesson title and content are required.'});const l={id:x.id||crypto.randomUUID(),courseId:x.courseId,exam:x.exam||'',skill:x.skill||'General',title:x.title,body:x.body,objectives:Array.isArray(x.objectives)?x.objectives:[],published:x.published!==false};if(hasPostgres)await sql('INSERT INTO lessons(id,course_id,exam,skill,title,body,objectives,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET course_id=$2,exam=$3,skill=$4,title=$5,body=$6,objectives=$7,published=$8',[l.id,l.courseId,l.exam,l.skill,l.title,l.body,JSON.stringify(l.objectives),l.published]);else{const i=localDb.lessons.findIndex(z=>z.id===l.id);if(i>=0)localDb.lessons[i]=l;else localDb.lessons.push(l);localSave();}r.json({ok:true,lesson:l});}catch(e){console.error(e);r.status(500).json({error:'Could not save lesson.'});}});
app.post('/api/admin/lesson/:id/delete',admin,async(q,r)=>{try{if(hasPostgres)await sql('DELETE FROM lessons WHERE id=$1',[q.params.id]);else{localDb.lessons=localDb.lessons.filter(l=>l.id!==q.params.id);localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not delete lesson.'});}});

app.post('/api/admin/plan',admin,async(q,r)=>{try{const{x}=q.body||{};if(!x?.name||!x?.price||!x?.days)return r.status(400).json({error:'Plan name, price and days are required.'});const p={id:x.id||crypto.randomUUID(),name:x.name,price:Number(x.price),days:Number(x.days),featured:!!x.featured,courseIds:Array.isArray(x.courseIds)?x.courseIds:[],features:Array.isArray(x.features)?x.features:[],published:x.published!==false};if(hasPostgres)await sql('INSERT INTO plans(id,name,price,days,featured,course_ids,features,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET name=$2,price=$3,days=$4,featured=$5,course_ids=$6,features=$7,published=$8',[p.id,p.name,p.price,p.days,p.featured,JSON.stringify(p.courseIds),JSON.stringify(p.features),p.published]);else{const i=localDb.plans.findIndex(z=>z.id===p.id);if(i>=0)localDb.plans[i]=p;else localDb.plans.push(p);localDb.pricing=localDb.plans;localSave();}r.json({ok:true,plan:p});}catch(e){console.error(e);r.status(500).json({error:'Could not save membership plan.'});}});
app.post('/api/admin/plan/:id/delete',admin,async(q,r)=>{try{if(hasPostgres)await sql('DELETE FROM plans WHERE id=$1',[q.params.id]);else{localDb.plans=localDb.plans.filter(p=>p.id!==q.params.id);localDb.pricing=localDb.plans;localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not delete plan.'});}});

app.post('/api/admin/teacher',admin,async(q,r)=>{try{const{x}=q.body||{};if(!x?.name)return r.status(400).json({error:'Teacher name is required.'});const t={id:x.id||crypto.randomUUID(),name:x.name,bio:x.bio||'',photoUrl:x.photoUrl||''};if(hasPostgres)await sql('INSERT INTO teachers(id,name,bio,photo_url) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=$2,bio=$3,photo_url=$4',[t.id,t.name,t.bio,t.photoUrl]);else{const i=localDb.teachers.findIndex(z=>z.id===t.id);if(i>=0)localDb.teachers[i]=t;else localDb.teachers.push(t);localSave();}r.json({ok:true,teacher:t});}catch(e){r.status(500).json({error:'Could not save teacher.'});}});
app.post('/api/admin/teacher/:id/delete',admin,async(q,r)=>{try{if(hasPostgres)await sql('DELETE FROM teachers WHERE id=$1',[q.params.id]);else{localDb.teachers=localDb.teachers.filter(t=>t.id!==q.params.id);localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not delete teacher.'});}});

app.post('/api/admin/class',admin,async(q,r)=>{try{const{x}=q.body||{};if(!x?.title||!x?.instructor)return r.status(400).json({error:'Class title and instructor are required.'});const c={id:x.id||crypto.randomUUID(),title:x.title,exam:x.exam||'IELTS + PTE',date:x.date||'',time:x.time||'',instructor:x.instructor,teacherId:x.teacherId||'',link:x.link||'',description:x.description||''};if(hasPostgres)await sql('INSERT INTO classes(id,title,exam,date,time,instructor,teacher_id,link,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET title=$2,exam=$3,date=$4,time=$5,instructor=$6,teacher_id=$7,link=$8,description=$9',[c.id,c.title,c.exam,c.date,c.time,c.instructor,c.teacherId,c.link,c.description]);else{const i=localDb.classes.findIndex(z=>z.id===c.id);if(i>=0)localDb.classes[i]=c;else localDb.classes.push(c);localSave();}r.json({ok:true,class:c});}catch(e){r.status(500).json({error:'Could not save live class.'});}});
app.post('/api/admin/class/:id/delete',admin,async(q,r)=>{try{if(hasPostgres)await sql('DELETE FROM classes WHERE id=$1',[q.params.id]);else{localDb.classes=localDb.classes.filter(c=>c.id!==q.params.id);localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not delete live class.'});}});

app.post('/api/admin/payment/:id/approve',admin,async(q,r)=>{try{let p;if(hasPostgres)p=(await sql('SELECT * FROM payments WHERE id=$1',[q.params.id]))[0];else p=localDb.payments.find(x=>x.id===q.params.id);if(!p||p.status!=='pending')return r.status(404).json({error:'Pending payment not found.'});const plan=p.plan_id||p.plan;const sub=await activateMembership(p.user_id||p.userId,plan,'manual',p.utr);if(hasPostgres)await sql("UPDATE payments SET status='approved',approved_at=NOW(),approved_by=$2 WHERE id=$1",[p.id,q.user.id]);else{p.status='approved';p.approvedAt=new Date().toISOString();p.approvedBy=q.user.id;localSave();}r.json({ok:true,subscription:sub});}catch(e){console.error(e);r.status(500).json({error:'Could not approve payment.'});}});
app.post('/api/admin/payment/:id/reject',admin,async(q,r)=>{try{if(hasPostgres)await sql("UPDATE payments SET status='rejected' WHERE id=$1 AND status='pending'",[q.params.id]);else{const p=localDb.payments.find(x=>x.id===q.params.id);if(!p||p.status!=='pending')return r.status(404).json({error:'Pending payment not found.'});p.status='rejected';localSave();}r.json({ok:true});}catch(e){r.status(500).json({error:'Could not reject payment.'});}});

app.get('*',(q,r)=>r.sendFile(path.join(__dirname,'index.html')));

startupPromise=(async()=>{if(hasPostgres)await initPostgres();await ensureAdmin();console.log(`ScorePath ready (${hasPostgres?'PostgreSQL':'local development storage'})`);})().catch(e=>{startupError=e;console.error('Startup failed:',e);});
if(require.main===module)startupPromise.then(()=>app.listen(PORT,()=>console.log(`Listening on ${PORT}`))).catch(()=>process.exit(1));
module.exports=app;
