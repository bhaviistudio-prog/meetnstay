/* MeetNStay online layer: Supabase login, profiles, likes, matches, live chat, trips.
   Loaded after the main script in index.html. Bookings and stays stay demo. */
(()=>{
const SB_URL='https://fidopptubdrwetumdbkm.supabase.co',SB_KEY='sb_publishable_5glWsZGEjGVi_q_AAW2RiQ_tSTbng4E';
if(!window.supabase){document.body.insertAdjacentHTML('afterbegin','<div style="padding:30px;color:#fff;font:15px sans-serif">Could not load the online service. Check your connection and reload.</div>');return}
const sb=window.supabase.createClient(SB_URL,SB_KEY);
let ME=null,TR=[],ch=null,lastLoad=0;

/* start clean: drop the old on-device demo data */
const old=D;D={...def(),bookings:old.bookings||[],favs:old.favs||[],set:old.set||def().set,lastRead:old.lastRead||{}};
P.length=0;go('welcome');

/* ---------- helpers ---------- */
const clean=s=>String(s==null?'':s).replace(/[<>&"'`]/g,'').trim();
const okImg=s=>typeof s==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s);
const INTENTS=['Dating','Friendship','Travel'];
function toP(r,dup){const name=clean(r.name)||'Member';return{id:r.id,n:dup?name+' ·'+r.id.slice(0,4):name,a:ageOf(r.dob),c:clean(r.city),i:(r.intents||[]).filter(x=>INTENTS.includes(x)).join(' & ')||'Friendship',b:String(r.bio||''),t:(r.interests||[]).map(clean).filter(Boolean).slice(0,8),img:okImg(r.photo)?r.photo:ph(name),lk:false}}
function fromRow(r){const ph0=(r.photos&&r.photos.length?r.photos:(r.photo?[r.photo]:[])).filter(okImg);return{name:clean(r.name),dob:r.dob||'',phone:'',bio:String(r.bio||''),city:clean(r.city)||'Mumbai',intents:(r.intents||[]).filter(x=>INTENTS.includes(x)),interests:(r.interests||[]).map(clean),photos:ph0}}
async function syncProfile(){const u=D.user,photos=(u.photos||[]).filter(okImg);return (await sb.from('profiles').upsert({id:ME.id,name:clean(u.name).slice(0,40),dob:u.dob||null,bio:String(u.bio||'').slice(0,500),city:clean(u.city),intents:u.intents||[],interests:u.interests||[],photo:photos[0]||null,photos})).error}
function refreshActive(){const a=document.querySelector('.screen.active');if(a&&(a.id==='likes'||a.id==='chats')&&R[a.id])R[a.id]();badges()}
function dropLike(n){const p=byName(n);if(p)sb.from('likes').delete().eq('to_user',p.id).then(({error})=>{if(error)console.error(error)})}
function syncBlocks(prev){D.blocked.filter(n=>!prev.includes(n)).forEach(dropLike)}

/* ---------- load everything ---------- */
async function loadAll(){
 const uid=ME.id;
 const [pr,lk,ms,tr]=await Promise.all([
  sb.from('profiles').select('id,name,dob,bio,city,photo,intents,interests').neq('id',uid).neq('bio','').limit(300),
  sb.from('likes').select('from_user,to_user'),
  sb.from('messages').select('id,sender,receiver,body,created_at').order('created_at',{ascending:false}).limit(1000),
  sb.from('trips').select('*').order('created_at',{ascending:false}).limit(100)]);
 const err=pr.error||lk.error||ms.error;
 if(err){console.error(err);toast('Could not load data. Check your connection.');return false}
 const cnt={};pr.data.forEach(r=>{const k=clean(r.name);cnt[k]=(cnt[k]||0)+1});
 P.length=0;pr.data.forEach(r=>P.push(toP(r,cnt[clean(r.name)]>1)));
 const sent=new Set(lk.data.filter(x=>x.from_user===uid).map(x=>x.to_user)),recv=new Set(lk.data.filter(x=>x.to_user===uid).map(x=>x.from_user));
 D.sent=[];D.matches=[];
 P.forEach(p=>{p.lk=recv.has(p.id);if(sent.has(p.id))(p.lk?D.matches:D.sent).push(p.n)});
 const th={};D.matches.forEach(n=>th[n]=[]);
 ms.data.slice().reverse().forEach(m=>{const o=m.sender===uid?m.receiver:m.sender,p=P.find(x=>x.id===o);if(!p)return;(th[p.n]=th[p.n]||[]).push({id:m.id,who:m.sender===uid?'me':'them',text:m.body,t:new Date(m.created_at).getTime()})});
 D.threads=th;D.unread={};
 Object.keys(th).forEach(n=>{const c=th[n].filter(m=>m.who==='them'&&m.t>(D.lastRead[n]||0)).length;if(c)D.unread[n]=c});
 D.blocked=D.blocked.filter(n=>P.some(p=>p.n===n));
 if(!tr.error)setTrips(tr.data);
 lastLoad=Date.now();save();return true}
function setTrips(rows){TR=rows.map(r=>({id:r.id,hostId:r.host,mine:r.host===ME.id,dest:clean(r.destination),from:r.start_date,to:r.end_date,note:String(r.details||'')}))}
async function loadTrips(){const {data,error}=await sb.from('trips').select('*').order('created_at',{ascending:false}).limit(100);if(error)return console.error(error);setTrips(data)}

/* ---------- realtime ---------- */
function subscribe(){
 if(ch)sb.removeChannel(ch);
 ch=sb.channel('mns-'+ME.id)
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'receiver=eq.'+ME.id},e=>incoming(e.new))
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'likes',filter:'to_user=eq.'+ME.id},e=>incomingLike(e.new))
 .subscribe()}
async function incoming(row){
 let p=P.find(x=>x.id===row.sender);
 if(!p){await loadAll();p=P.find(x=>x.id===row.sender);if(!p)return}
 const n=p.n,th=(D.threads[n]=D.threads[n]||[]);
 if(th.some(m=>m.id===row.id))return;
 th.push({id:row.id,who:'them',text:row.body,t:new Date(row.created_at).getTime()});
 if(peer===n&&$('#chat').classList.contains('active')){D.lastRead[n]=Date.now();renderChat()}
 else{D.unread[n]=(D.unread[n]||0)+1;notify('chat','New message from '+n,row.body)}
 save();refreshActive()}
async function incomingLike(row){
 let p=P.find(x=>x.id===row.from_user);
 if(!p){await loadAll();p=P.find(x=>x.id===row.from_user);if(!p)return}
 p.lk=true;
 if(D.sent.includes(p.n)){match(p.n,true);toast(p.n+' liked you back. It is a match.')}
 else{notify('heart',p.n+' liked you','Open Likes to like back.');toast(p.n+' liked you.')}
 save();refreshActive()}

/* ---------- login screen and signup fields ---------- */
$('#login .subtitle').textContent='Log in with the email and password you signed up with.';
$('#login p.small').textContent='Your account, chats and trips are stored online, so you can log in from any device.';
$('#loginPhone').closest('.field').outerHTML='<div class="field"><label class="label">Email</label><input id="loginEmail" type="email" class="input" autocomplete="email" placeholder="you@example.com"></div><div class="field"><label class="label">Password</label><input id="loginPassword" type="password" class="input" autocomplete="current-password" placeholder="Your password"></div>';
$('#loginSend').textContent='Log in';$('#loginOtpWrap').remove();
$('#signupPhone').closest('.field').classList.add('hidden');
$('#signupName').closest('.field').insertAdjacentHTML('afterend','<div class="field"><label class="label">Email</label><input id="signupEmail" type="email" class="input" autocomplete="email" placeholder="you@example.com"></div><div class="field"><label class="label">Password</label><input id="signupPassword" type="password" class="input" autocomplete="new-password" placeholder="At least 8 characters"></div>');
$('#photos .subtitle').textContent='Upload up to 6 photos. They are compressed and saved to your profile.';
DOCS.privacy[1]='Your profile (name, date of birth, bio, city, interests and photos), likes, chats and trips are stored online with Supabase so that other members can see your profile and message you. Bookings and settings stay on this device. You can delete your account and data at any time from Settings.';

shrink=function(f){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,480/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.7))};i.onerror=no;i.src=r.result};r.onerror=no;r.readAsDataURL(f)})};

/* ---------- auth ---------- */
async function enter(user){
 ME=user;
 const {data:prof,error}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
 if(error){console.error(error);return toast('Could not load your profile.')}
 const md=user.user_metadata||{};
 D.user=prof?fromRow(prof):{name:clean(md.name),dob:md.dob||'',phone:'',bio:'',city:'Mumbai',intents:[],interests:[],photos:[]};
 if(!prof||(prof.bio||'').length<10){editing=false;save();return go('intent')}
 D.session=true;save();
 if(!(await loadAll()))return;
 subscribe();go('discover');toast('Welcome, '+D.user.name+'.')}
$('#loginSend').onclick=async()=>{
 const email=$('#loginEmail').value.trim().toLowerCase(),pw=$('#loginPassword').value;
 if(!email||!pw)return toast('Enter your email and password.');
 const b=$('#loginSend');b.disabled=true;
 const {data,error}=await sb.auth.signInWithPassword({email,password:pw});
 b.disabled=false;
 if(error)return toast(/invalid/i.test(error.message)?'Wrong email or password.':error.message);
 $('#loginPassword').value='';await enter(data.user)};
$('#signupContinue').onclick=async()=>{
 const name=clean($('#signupName').value).slice(0,40),dob=$('#signupDob').value,email=$('#signupEmail').value.trim().toLowerCase(),pw=$('#signupPassword').value;
 if(!name||!dob)return toast('Add your name and date of birth.');
 if(!/^\S+@\S+\.\S+$/.test(email))return toast('Enter a valid email address.');
 if(pw.length<8)return toast('Use a password of at least 8 characters.');
 if(!$('#adultCheck').checked||ageOf(dob)<18)return toast('MeetNStay is for adults aged 18 and over.');
 const b=$('#signupContinue');b.disabled=true;
 const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{name,dob}}});
 b.disabled=false;
 if(error){if(/registered|exists/i.test(error.message)){toast('This email already has an account. Log in instead.');$('#loginEmail').value=email;return go('login')}return toast(error.message)}
 if(!data.session)return toast('Check your email to confirm your account, then log in.');
 ME=data.user;D=def();D.lastRead={};
 D.user={name,dob,phone:'',bio:'',city:'Mumbai',intents:[],interests:[],photos:[]};
 const e=await syncProfile();if(e){console.error(e);return toast('Account created, but the profile could not be saved. Log in again.')}
 editing=false;save();go('intent')};
$('#photoContinue').onclick=async()=>{
 const b=$('#photoContinue');b.disabled=true;
 const err=await syncProfile();
 if(err){b.disabled=false;console.error(err);return toast('Could not save your profile. Try again.')}
 if(!D.session){D.session=true;notify('user','Welcome to MeetNStay','Like a profile, plan a trip or search for a stay to get started.')}
 save();const was=editing;editing=false;
 await loadAll();subscribe();b.disabled=false;
 go(was?'me':'discover');toast(was?'Profile updated.':'Profile created. Start exploring.')};
$('#logoutBtn').onclick=async()=>{
 if(ch){sb.removeChannel(ch);ch=null}
 await sb.auth.signOut({scope:'local'});
 ME=null;D=def();D.lastRead={};P.length=0;TR=[];save();go('welcome')};
$('#deleteBtn').onclick=async()=>{
 if(!confirm('Delete your account, profile, chats and trips? This cannot be undone.'))return;
 const {error}=await sb.rpc('delete_my_account');
 if(error){console.error(error);return toast('Could not delete your account. Try again.')}
 if(ch){sb.removeChannel(ch);ch=null}
 await sb.auth.signOut({scope:'local'});
 localStorage.removeItem(KEY);ME=null;D=def();D.lastRead={};P.length=0;TR=[];hotel=null;go('welcome');toast('Account and data deleted.')};

/* ---------- likes, matches, chat ---------- */
match=function(n,quiet){
 if(D.matches.includes(n))return;
 D.sent=D.sent.filter(x=>x!==n);D.matches.push(n);D.threads[n]=D.threads[n]||[];
 notify('heart','It is a match with '+n,'Say hello and plan something together.');save();
 if(!quiet)showMatch(n)};
like=function(n,quiet){
 const p=byName(n);if(!p)return;
 D.passed=D.passed.filter(x=>x!==n);
 if(p.lk)match(n,quiet);
 else{if(!D.sent.includes(n))D.sent.push(n);toast('You liked '+n+'. We will tell you if it is mutual.')}
 save();
 sb.from('likes').insert({to_user:p.id}).then(({error})=>{
  if(error&&error.code!=='23505'){console.error(error);D.sent=D.sent.filter(x=>x!==n);D.matches=D.matches.filter(x=>x!==n);save();toast('Could not send your like. Try again.');refreshActive()}})};
openChat=function(n){peer=n;D.unread[n]=0;D.lastRead[n]=Date.now();save();go('chat')};
send=function(text){
 text=(text||'').trim().slice(0,1000);if(!text||!peer)return;
 const to=peer,p=byName(to);if(!p)return;
 const m={who:'me',text,t:Date.now()};(D.threads[to]=D.threads[to]||[]).push(m);renderChat();
 sb.from('messages').insert({receiver:p.id,body:text}).select('id').single().then(({data,error})=>{
  if(error){console.error(error);D.threads[to]=D.threads[to].filter(x=>x!==m);toast('Message not sent. You can only chat with people you matched with.');if(peer===to&&$('#chat').classList.contains('active'))renderChat()}
  else{m.id=data.id;save()}});
 save()};
$('#unmatchDemo').onclick=()=>{
 const n=peer;if(!D.matches.includes(n))return toast('You are not matched with '+n+'.');
 D.matches=D.matches.filter(x=>x!==n);delete D.threads[n];D.unread[n]=0;save();renderSafety();badges();dropLike(n);toast('Unmatched from '+n+'.')};
{const ob=$('#blockDemo').onclick;$('#blockDemo').onclick=function(){const prev=[...D.blocked];ob.call(this);syncBlocks(prev)}}
{const os=$('#submitReport').onclick;$('#submitReport').onclick=function(){const prev=[...D.blocked];os.call(this);syncBlocks(prev)}}
{const od=R.discover,ol=R.likes;
 const stale=()=>{if(ME&&Date.now()-lastLoad>60000)loadAll().then(ok=>{if(ok)refreshActive();const a=document.querySelector('.screen.active');if(a&&a.id==='discover'&&!cur)od()})};
 R.discover=function(){od();stale()};R.likes=function(){ol();stale()}}

/* ---------- trips ---------- */
function drawTrips(){
 $$('#trips .tab').forEach(b=>b.classList.toggle('active',b.dataset.tt===tripTab));
 const mine=tripTab==='mine';
 const l=TR.filter(t=>mine?t.mine:(!t.mine&&!D.blocked.includes((P.find(p=>p.id===t.hostId)||{}).n)));
 $('#tripList').innerHTML=l.length?l.map(t=>{
  const h=P.find(p=>p.id===t.hostId),matched=h&&D.matches.includes(h.n),pending=D.joined.includes(t.id)||(h&&D.sent.includes(h.n));
  const act=mine?`<button class="btn dark" data-del="${t.id}">Delete</button>`:!h?'<button class="btn dark" disabled>Host unavailable</button>':matched?`<button class="btn primary" data-tm="${h.n}">Message</button>`:pending?'<button class="btn dark" disabled>Interested</button>':`<button class="btn primary" data-ti="${t.id}">I am interested</button>`;
  return `<div class="card"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3 style="margin:0 0 4px;font-size:18px">${esc(t.dest)}</h3><span class="small muted">${dt(t.from)} to ${dt(t.to)}</span></div>${h?`<div style="text-align:center"><img class="avatar" style="width:40px;height:40px" src="${h.img}" alt="${h.n}"><div class="small muted">${h.n}</div></div>`:''}</div><p class="small" style="color:#ccc;line-height:1.5">${esc(t.note)}</p><div class="row">${act}<button class="btn outline" data-ts="${t.id}">Find stays</button></div></div>`}).join('')
  :`<div class="empty"><strong>${mine?'No trips yet':'No trips yet'}</strong>${mine?'Tap + to plan your first trip.':'Trips from other members will show up here.'}</div>`;
 $$('[data-ti]').forEach(b=>b.onclick=()=>{const t=TR.find(x=>x.id===b.dataset.ti),h=t&&P.find(p=>p.id===t.hostId);if(!h)return;D.joined.push(t.id);like(h.n);if(!D.matches.includes(h.n))toast('We let '+h.n+' know you are interested. Chat opens if they like you back.');drawTrips()});
 $$('[data-tm]').forEach(b=>b.onclick=()=>openChat(b.dataset.tm));
 $$('[data-del]').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('trips').delete().eq('id',b.dataset.del);if(error)return toast('Could not delete the trip.');TR=TR.filter(x=>x.id!==b.dataset.del);drawTrips();toast('Trip deleted.')});
 $$('[data-ts]').forEach(b=>b.onclick=()=>{const t=TR.find(x=>x.id===b.dataset.ts);$('#stayDestination').value=t.dest;$('#checkin').value=t.from;$('#checkoutDate').value=t.to;go('stays')})}
R.trips=renderTrips=function(){drawTrips();loadTrips().then(()=>{if($('#trips').classList.contains('active'))drawTrips()})};
$('#saveTrip').onclick=async()=>{
 const d=clean($('#tripDest').value).slice(0,60),f=$('#tripFrom').value,t=$('#tripTo').value;
 if(!d||!f||!t)return toast('Add a destination and dates.');
 if(t<f)return toast('The end date must be after the start date.');
 const b=$('#saveTrip');b.disabled=true;
 const {error}=await sb.from('trips').insert({title:d,destination:d,start_date:f,end_date:t,details:$('#tripNote').value.trim().slice(0,500)});
 b.disabled=false;
 if(error){console.error(error);return toast('Could not publish the trip. Try again.')}
 $('#tripDest').value='';$('#tripNote').value='';await loadTrips();tripTab='mine';go('trips');toast('Trip published.')};

/* ---------- boot ---------- */
sb.auth.getSession().then(({data})=>{if(data.session)enter(data.session.user);else go('welcome')});
})();
