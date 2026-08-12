/* Penalty Family PRO V3 - skill-based peer-to-peer penalty game + cinematic animation */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const screens = {home:$('#screen-home'),room:$('#screen-room'),game:$('#screen-game'),result:$('#screen-result')};
const NAMES={baba:'بابا علی',sepanta:'سپنتا'};
const IMG={baba:'assets/baba-ali.png',sepanta:'assets/sepanta.png'};
const ZONE_POS={TL:{x:-.72,y:.78},TC:{x:0,y:.78},TR:{x:.72,y:.78},BL:{x:-.72,y:.22},BC:{x:0,y:.22},BR:{x:.72,y:.22}};
const SHOT_LABEL={power:'شوت محکم',placed:'بغل‌پا',curve:'کات‌دار',chip:'چیپ',drive:'شوت معمولی'};
let myRole=null, roomCode=null, peer=null, conn=null, isHost=false, demo=false, soundOn=true;
let selectedMode='pro', state=null, dragStart=null, dragPath=[], dragStartedAt=0;
let keeperReactStart=null, keeperReactSeq=-1, lastIncomingShotKey='', resolutionLocked=false, lastRenderSeq=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function show(name){Object.values(screens).forEach(x=>x.classList.remove('active'));screens[name].classList.add('active');if(name==='game')requestAnimationFrame(()=>MatchV3?.reset?.())}
function randomCode(){return String(Math.floor(1000+Math.random()*9000))}
function other(r){return r==='baba'?'sepanta':'baba'}
function clone(x){return JSON.parse(JSON.stringify(x))}
function freshState(mode=selectedMode){return {status:'lobby',mode,players:{baba:false,sepanta:false},turn:'sepanta',scores:{baba:0,sepanta:0},history:{baba:[],sepanta:[]},attempts:{baba:0,sepanta:0},suddenDeath:false,current:{shot:null,keeper:null},winner:null,seq:0}}
function modeName(m){return m==='pro'?'حرفه‌ای ⚡':'فان 🎉'}
function speak(text){if(!soundOn||!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='fa-IR';u.rate=.95;u.pitch=1.06;speechSynthesis.speak(u)}
function sfx(id){if(!soundOn)return;const a=$(id);if(a){a.currentTime=0;a.play().catch(()=>{})}}
function buzz(ms=30){try{navigator.vibrate?.(ms)}catch{}}
function callout(text,ms=1700){const el=$('#callout');el.textContent=text;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),ms)}
function makeConfetti(target,count=70){target.innerHTML='';for(let i=0;i<count;i++){const s=document.createElement('span');s.style.left=Math.random()*100+'%';s.style.setProperty('--h',Math.floor(Math.random()*360));s.style.setProperty('--d',(1.5+Math.random()*2)+'s');s.style.setProperty('--r',(Math.random()*360)+'deg');s.style.setProperty('--x',(-130+Math.random()*260)+'px');s.style.animationDelay=(Math.random()*.5)+'s';target.appendChild(s)}}
function serialize(msg){return JSON.parse(JSON.stringify(msg))}
function broadcast(){if(demo)return;if(isHost&&conn?.open)conn.send({type:'STATE',state:clone(state)})}
function sendEvent(event){if(!demo&&isHost&&conn?.open)conn.send({type:'EVENT',event:serialize(event)})}
function setState(next){state=next;render();broadcast()}

$$('.mode-btn').forEach(b=>b.addEventListener('click',()=>{selectedMode=b.dataset.mode;$$('.mode-btn').forEach(x=>x.classList.toggle('selected',x===b));}));
$$('.role-btn').forEach(b=>b.addEventListener('click',()=>{myRole=b.dataset.role;$$('.role-btn').forEach(x=>x.classList.toggle('selected',x===b));$('#create-room').disabled=false;$('#join-room').disabled=false;$('#demo-mode').disabled=false;$('#role-hint').textContent=`شما: ${NAMES[myRole]}`;}));
$('#create-room').onclick=()=>{demo=false;roomCode=randomCode();isHost=true;state=freshState(selectedMode);state.players[myRole]=true;show('room');$('#join-wrap').classList.add('hidden');$('#room-code-wrap').classList.remove('hidden');$('#room-code').textContent=roomCode;$('#room-mode').textContent=`حالت ${modeName(state.mode)}`;$('#room-status').textContent='منتظر گوشی دوم…';setupHost()};
$('#join-room').onclick=()=>{demo=false;isHost=false;show('room');$('#room-code-wrap').classList.add('hidden');$('#join-wrap').classList.remove('hidden');$('#room-mode').textContent='حالت بازی را میزبان تعیین می‌کند';$('#room-status').textContent='کد اتاق را وارد کن.';updateReadyUI()};
$('#confirm-join').onclick=()=>{const c=$('#join-code').value.replace(/\D/g,'').slice(0,4);if(c.length!==4){$('#room-status').textContent='کد باید ۴ رقم باشد.';return}roomCode=c;setupGuest()};
$('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$('#copy-code').textContent='کپی شد';setTimeout(()=>$('#copy-code').textContent='کپی',1000)}catch{}};
$('#leave-room').onclick=resetHome;$('#quit-game').onclick=resetHome;$('#home-btn').onclick=resetHome;
$('#demo-mode').onclick=()=>{demo=true;isHost=true;roomCode='DEMO';state=freshState(selectedMode);state.players={baba:true,sepanta:true};state.status='playing';show('game');render()};
$('#sound-toggle').onclick=()=>{soundOn=!soundOn;$('#sound-toggle').textContent=soundOn?'🔊 صدا روشن':'🔇 صدا خاموش'};
$('#play-again').onclick=()=>{if(!state)return;if(isHost||demo){const joined=clone(state.players),mode=state.mode;state=freshState(mode);state.players=joined;state.status='playing';state.seq++;setState(state);show('game')}else conn?.send({type:'REMATCH'})};

function setupHost(){
  try{peer?.destroy()}catch{}
  peer=new Peer('family-penalty-'+roomCode);
  peer.on('open',()=>{$('#room-status').textContent='کد را به بازیکن دوم بده.'});
  peer.on('connection',c=>{if(conn?.open){c.close();return}conn=c;conn.on('open',()=>conn.send({type:'HELLO_REQUEST'}));conn.on('data',m=>handleMessage(m));conn.on('close',()=>{$('#room-status').textContent='اتصال بازیکن دوم قطع شد.'})});
  peer.on('error',e=>{$('#room-status').textContent='خطا در ساخت اتاق. دوباره تلاش کن.';console.error(e)});updateReadyUI();
}
function setupGuest(){
  $('#room-status').textContent='در حال اتصال…';peer=new Peer();
  peer.on('open',()=>{conn=peer.connect('family-penalty-'+roomCode,{reliable:true});conn.on('open',()=>{conn.send({type:'HELLO',role:myRole});$('#room-status').textContent='وصل شد؛ منتظر شروع بازی…'});conn.on('data',m=>handleMessage(m));conn.on('close',()=>{$('#room-status').textContent='اتصال قطع شد.'})});
  peer.on('error',e=>{$('#room-status').textContent='اتاق پیدا نشد یا اتصال برقرار نشد.';console.error(e)});
}
function handleMessage(msg){
  if(!msg)return;
  if(msg.type==='HELLO_REQUEST'&&!isHost){conn.send({type:'HELLO',role:myRole});return}
  if(msg.type==='HELLO'&&isHost){if(msg.role===myRole){conn.send({type:'ERROR',text:'این بازیکن قبلاً انتخاب شده. نقش دیگر را انتخاب کن.'});return}state.players[msg.role]=true;state.status='playing';broadcast();render();setTimeout(()=>{show('game');broadcast()},500);return}
  if(msg.type==='STATE'&&!isHost){state=msg.state;selectedMode=state.mode||'pro';$('#room-mode').textContent=`حالت ${modeName(state.mode)}`;if(state.status==='playing')show('game');if(state.status==='finished')showResult();render();return}
  if(msg.type==='EVENT'){playResolution(msg.event);return}
  if(msg.type==='ERROR'){alert(msg.text);resetHome();return}
  if(msg.type==='ACTION'&&isHost){applyAction(msg.action,msg.role);return}
  if(msg.type==='REMATCH'&&isHost){const joined=clone(state.players),mode=state.mode;state=freshState(mode);state.players=joined;state.status='playing';setState(state);show('game')}
}
function submitAction(action){if(demo){applyAction(action,action.role||myRole);return}if(isHost)applyAction(action,myRole);else conn?.send({type:'ACTION',role:myRole,action})}
function applyAction(action,role){
  if(!state||state.status!=='playing'||resolutionLocked)return;const shooter=state.turn,keeper=other(shooter);
  if(action.kind==='shot'&&role===shooter&&!state.current.shot){state.current.shot=sanitizeShot(action);sfx('#kick-sfx');buzz(20)}
  if(action.kind==='keep'&&role===keeper&&!state.current.keeper){state.current.keeper={zone:ZONE_POS[action.zone]?action.zone:'BC',reactionMs:clamp(Number(action.reactionMs)||0,0,2500)}}
  render();broadcast();resolveIfReady();
}
function sanitizeShot(a){return {targetX:clamp(Number(a.targetX)||0,-1.35,1.35),targetY:clamp(Number(a.targetY)||.5,-.18,1.3),power:clamp(Number(a.power)||.5,0,1),curve:clamp(Number(a.curve)||0,-1,1),consistency:clamp(Number(a.consistency)||.8,0,1),type:a.type||'drive',zone:a.zone||'TC',duration:clamp(Number(a.duration)||450,80,1800)}}
function resolveIfReady(){
  const c=state.current;if(!c.shot||!c.keeper||resolutionLocked)return;resolutionLocked=true;const shooter=state.turn,keeper=other(shooter);
  const result=state.mode==='pro'?resolvePro(c.shot,c.keeper):resolveFun(c.shot,c.keeper);
  state.attempts[shooter]++;state.history[shooter].push(result.goal?'goal':'miss');if(result.goal)state.scores[shooter]++;
  const event={type:'resolution',seq:state.seq,shooter,keeper,shot:c.shot,keeperAction:c.keeper,result};broadcast();sendEvent(event);playResolution(event);
  setTimeout(()=>{resolutionLocked=false;advanceTurn()},3300);
}
function resolveFun(shot,keeper){const saved=shot.zone===keeper.zone;return {goal:!saved,kind:saved?'saved':'goal',finalX:shot.targetX,finalY:shot.targetY,save:saved}}
function resolvePro(shot,keeper){
  const overhit=Math.max(0,(shot.power-.9)/.1),underhit=Math.max(0,(.28-shot.power)/.28),instability=(1-shot.consistency)*.17+overhit*.13+underhit*.08;
  const rx=(Math.random()-.5)*2*instability,ry=(Math.random()-.5)*1.4*instability,finalX=shot.targetX+shot.curve*.16+rx,finalY=shot.targetY+ry-underhit*.08;
  const insideX=Math.abs(finalX)<=1,insideY=finalY>=.02&&finalY<=1;
  const nearPost=(Math.abs(Math.abs(finalX)-1)<.055&&finalY>.04&&finalY<1.03)||(Math.abs(finalY-1)<.045&&Math.abs(finalX)<1.03);
  if(nearPost&&Math.random()<.68)return {goal:false,kind:'post',finalX,finalY,save:false};if(!insideX)return {goal:false,kind:'wide',finalX,finalY,save:false};if(!insideY)return {goal:false,kind:finalY>1?'high':'weak',finalX,finalY,save:false};
  const kp=ZONE_POS[keeper.zone]||ZONE_POS.BC,dx=finalX-kp.x,dy=(finalY-kp.y)*1.15,dist=Math.hypot(dx,dy),reaction=keeper.reactionMs;
  const reactionBonus=reaction<260?.12:reaction<480?.075:reaction<750?.02:reaction<1050?-.055:-.13,shotDifficulty=shot.power*.10+Math.abs(shot.curve)*.09+(shot.type==='chip'?.04:0),reach=clamp(.47+reactionBonus-shotDifficulty,.22,.60);
  let save=dist<reach;if(!save&&dist<reach+.11)save=Math.random()<clamp(.48-(dist-reach)*2.8,0,.48);return {goal:!save,kind:save?'saved':'goal',finalX,finalY,save,dist,reach};
}
function advanceTurn(){
  if(!state||state.status!=='playing')return;const a=state.attempts;
  if(a.baba>=5&&a.sepanta>=5&&a.baba===a.sepanta&&state.scores.baba!==state.scores.sepanta){finish(state.scores.baba>state.scores.sepanta?'baba':'sepanta');return}
  if(a.baba===5&&a.sepanta===5&&state.scores.baba===state.scores.sepanta)state.suddenDeath=true;
  state.turn=other(state.turn);state.current={shot:null,keeper:null};state.seq++;keeperReactStart=null;keeperReactSeq=-1;lastIncomingShotKey='';setState(state)
}
function finish(w){state.winner=w;state.status='finished';broadcast();showResult()}
function resultPhrase(event){const {result,shooter}=event;if(result.goal)return `ماشالله ${NAMES[shooter]}!`;if(result.kind==='post')return `اوه! خورد به تیر ${NAMES[shooter]}!`;if(result.kind==='saved')return `چه سیوی! این چه ضربه‌ای بود ${NAMES[shooter]}!`;if(result.kind==='high')return `خیلی بالا بود ${NAMES[shooter]}!`;return `این چه ضربه‌ای بود ${NAMES[shooter]}!`}
async function playResolution(event){
  if(!event||event.type!=='resolution')return;const phrase=resultPhrase(event);callout(phrase,2200);
  try{await MatchV3?.resolve?.(event)}catch(e){console.error('V3 animation',e)}
  speak(phrase);
  if(event.result.goal){sfx('#goal-sfx');buzz([35,40,60]);makeConfetti($('#confetti'),55);if(event.shooter==='sepanta')setTimeout(()=>speak('سییی!'),720)}else{sfx('#save-sfx');buzz(45)}
}
function showResult(){if(!state?.winner)return;show('result');$('#winner-name').textContent=NAMES[state.winner];$('#winner-img').src=IMG[state.winner];$('#final-score').textContent=`${state.scores.baba} - ${state.scores.sepanta}`;makeConfetti($('#result-confetti'),120);speak(`برنده ${NAMES[state.winner]}!`)}
function updateReadyUI(){const p=state?.players||{};$('#ready-baba').classList.toggle('on',!!p.baba);$('#ready-sepanta').classList.toggle('on',!!p.sepanta);$('#ready-baba').textContent=p.baba?'●':'○';$('#ready-sepanta').textContent=p.sepanta?'●':'○'}
function render(){
  if(!state)return;updateReadyUI();$('#score-baba').textContent=state.scores.baba;$('#score-sepanta').textContent=state.scores.sepanta;renderDots('baba');renderDots('sepanta');$('#round-label').textContent=state.suddenDeath?'گل طلایی':'پنالتی';$('#turn-label').textContent=state.suddenDeath?'★':String(Math.max(state.attempts.baba,state.attempts.sepanta)+1);$('#mode-badge').textContent=state.mode==='pro'?'PRO':'FUN';$('#my-role-label').textContent=`شما: ${NAMES[myRole]}`;
  const shooter=state.turn,keeper=other(shooter);MatchV3?.setCharacters?.(shooter,keeper);
  const seqChanged=lastRenderSeq!==state.seq;if(seqChanged){lastRenderSeq=state.seq;$('#confetti').innerHTML='';MatchV3?.reset?.();MatchV3?.setCharacters?.(shooter,keeper);resetHud();keeperReactStart=null;keeperReactSeq=-1;lastIncomingShotKey=''}
  const myIsShooter=demo?true:myRole===shooter,myIsKeeper=demo?false:myRole===keeper;
  $('#pro-hud').classList.toggle('hidden',state.mode!=='pro'||!myIsShooter);$('#aim-guide').classList.toggle('hidden',!myIsShooter||!!state.current.shot);$('#keeper-controls').classList.toggle('hidden',!myIsKeeper||!!state.current.keeper);$('#waiting').classList.toggle('hidden',demo||(myIsShooter&&!state.current.shot)||(myIsKeeper&&!state.current.keeper));
  $('#aim-guide').textContent=state.mode==='pro'&&myIsShooter&&!state.current.shot?'سوایپ رو به بالا = ارتفاع • قوس انگشت = کات':'توپ را رو به دروازه سوایپ کن';
  if(myIsKeeper&&!state.current.keeper){if(state.current.shot){const key=state.seq+':'+JSON.stringify(state.current.shot);if(lastIncomingShotKey!==key){lastIncomingShotKey=key;keeperReactStart=performance.now();keeperReactSeq=state.seq}$('#keeper-hint').textContent='شوت شد! سریع شیرجه بزن'}else $('#keeper-hint').textContent='آماده باش؛ جهت را پیش‌بینی کن'}
  if(demo){$('#aim-guide').classList.remove('hidden');$('#waiting').classList.add('hidden')}
}
function renderDots(role){const el=$('#dots-'+role);el.innerHTML='';const total=state.suddenDeath?Math.max(5,state.history[role].length):5;for(let i=0;i<total;i++){const d=document.createElement('i');if(state.history[role][i])d.classList.add(state.history[role][i]);el.appendChild(d)}}
function resetHud(){$('#power-value').textContent='—';$('#power-bar').style.width='0%';$('#shot-type').textContent='آماده';$('#curve-value').textContent='—'}
const ball=$('#ball');
function point(e){const t=e.touches?.[0]||e.changedTouches?.[0]||e;return{x:t.clientX,y:t.clientY,t:performance.now()}}
ball.addEventListener('touchstart',startDrag,{passive:false});ball.addEventListener('mousedown',startDrag);
function startDrag(e){if(!state||state.status!=='playing'||resolutionLocked||MatchV3?.running)return;const shooter=state.turn;if(!demo&&myRole!==shooter)return;if(state.current.shot)return;e.preventDefault();dragStart=point(e);dragStartedAt=dragStart.t;dragPath=[dragStart];window.addEventListener('touchmove',moveDrag,{passive:false});window.addEventListener('mousemove',moveDrag);window.addEventListener('touchend',endDrag,{once:true});window.addEventListener('mouseup',endDrag,{once:true})}
function moveDrag(e){if(!dragStart)return;if(e.cancelable)e.preventDefault();const p=point(e);dragPath.push(p);if(dragPath.length>24)dragPath.shift()}
function endDrag(e){window.removeEventListener('touchmove',moveDrag);window.removeEventListener('mousemove',moveDrag);if(!dragStart)return;const p=point(e);dragPath.push(p);const start=dragStart;dragStart=null;const dx=p.x-start.x,dy=p.y-start.y,dist=Math.hypot(dx,dy),duration=Math.max(80,p.t-dragStartedAt);if(dist<34){callout('محکم‌تر سوایپ کن',900);return}const profile=state.mode==='pro'?profileFromGesture(start,p,dragPath,duration):funProfile(dx,dy,dist,duration);updateHud(profile);MatchV3?.previewShot?.(profile);submitAction({kind:'shot',...profile});if(demo)setTimeout(()=>demoKeeper(profile),520)}
function funProfile(dx,dy,dist,duration){const power=clamp(dist/250,0,1);let zone='TC';if(Math.abs(dx)>32){const high=dy<-65;zone=dx<0?(high?'TL':'BL'):(high?'TR':'BR')}else zone=dy<-100?'TC':'BC';const p=ZONE_POS[zone];return {targetX:p.x,targetY:p.y,power,curve:0,consistency:1,type:'drive',zone,duration}}
function profileFromGesture(start,end,path,duration){const dx=end.x-start.x,dy=end.y-start.y,dist=Math.hypot(dx,dy),speed=dist/duration,up=-dy,curveInfo=measureCurve(start,end,path);let targetX=clamp(dx/150,-1.28,1.28),targetY=clamp((up-42)/180,-.12,1.22);const power=clamp((dist/285)*.56+(speed/1.35)*.44,0,1),curve=clamp(curveInfo.curve,-1,1),consistency=clamp(1-curveInfo.scatter,0,1);targetX=clamp(targetX+curve*.12,-1.35,1.35);let type='drive';if(targetY>.78&&power<.63)type='chip';else if(Math.abs(curve)>.28)type='curve';else if(power>.82)type='power';else if(power<.57)type='placed';const zone=nearestZone(targetX,targetY);return {targetX,targetY,power,curve,consistency,type,zone,duration}}
function measureCurve(start,end,path){const vx=end.x-start.x,vy=end.y-start.y,len=Math.hypot(vx,vy)||1;let sum=0,maxSigned=0,absSum=0,n=0;for(const p of path){const px=p.x-start.x,py=p.y-start.y,signed=(vx*py-vy*px)/len;sum+=signed;absSum+=Math.abs(signed);if(Math.abs(signed)>Math.abs(maxSigned))maxSigned=signed;n++}const avg=n?sum/n:0,scatter=clamp((absSum/Math.max(1,n))/95,0,1);return {curve:clamp((maxSigned*.65+avg*.35)/62,-1,1),scatter}}
function nearestZone(x,y){let best='TC',bd=99;for(const [z,p] of Object.entries(ZONE_POS)){const d=Math.hypot(x-p.x,(y-p.y)*1.15);if(d<bd){bd=d;best=z}}return best}
function updateHud(p){if(state?.mode!=='pro')return;$('#power-value').textContent=Math.round(p.power*100)+'٪';$('#power-bar').style.width=Math.round(p.power*100)+'%';$('#shot-type').textContent=SHOT_LABEL[p.type]||'شوت';$('#curve-value').textContent=Math.abs(p.curve)<.12?'بدون کات':p.curve>0?'کات راست':'کات چپ'}
function demoKeeper(profile){const zones=Object.keys(ZONE_POS);let z;if(Math.random()<.48)z=profile.zone;else z=zones[Math.floor(Math.random()*zones.length)];submitAction({kind:'keep',zone:z,reactionMs:250+Math.random()*650,role:other(state.turn)})}
$$('#keeper-controls button').forEach(b=>b.onclick=()=>{const reaction=(keeperReactSeq===state?.seq&&keeperReactStart)?performance.now()-keeperReactStart:0;submitAction({kind:'keep',zone:b.dataset.zone,reactionMs:reaction})});
function resetHome(){try{conn?.close();peer?.destroy()}catch{}conn=null;peer=null;state=null;roomCode=null;isHost=false;demo=false;resolutionLocked=false;keeperReactStart=null;lastRenderSeq=null;MatchV3?.reset?.();show('home')}
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
