/* Penalty Family PRO V3 cinematic match animation engine.
   No external runtime dependency: Web Animations API + CSS only. */
(function(){
  const $=s=>document.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const zoneMap={TL:{x:-.72,y:.78},TC:{x:0,y:.78},TR:{x:.72,y:.78},BL:{x:-.72,y:.22},BC:{x:0,y:.22},BR:{x:.72,y:.22}};
  let running=false;

  function actor(id){return $(id)}
  function cancelAnimations(el){try{el?.getAnimations?.().forEach(a=>a.cancel())}catch{}}
  function setState(el,state){if(el)el.dataset.state=state}
  function animate(el,frames,opts){if(!el?.animate)return {finished:Promise.resolve()};return el.animate(frames,{fill:'forwards',...opts})}

  function resetActor(el){
    if(!el)return;cancelAnimations(el);el.style.transform='';el.style.opacity='';setState(el,'idle');
  }
  function reset(){
    running=false;resetActor(actor('#shooter'));resetActor(actor('#keeper'));
    ['#spectator-mom','#spectator-daughter'].forEach(s=>{const e=$(s);cancelAnimations(e);e?.classList.remove('cheer','clap','oops')});
    const ball=$('#ball');cancelAnimations(ball);if(ball){ball.style.left='50%';ball.style.top='auto';ball.style.bottom='7.5%';ball.style.transform='translate(-50%,0) scale(1) rotate(0deg)';ball.style.opacity='1'}
    const net=$('#net');if(net){cancelAnimations(net);net.style.transform='';}
    $('#stadium')?.classList.remove('camera-kick','camera-goal','camera-save');
  }

  function setCharacters(shooterRole,keeperRole){
    const img={baba:'assets/baba-ali.png',sepanta:'assets/sepanta.png'};
    const si=$('#shooter-img'),ki=$('#keeper-img');
    if(si)si.src=img[shooterRole];if(ki)ki.src=img[keeperRole];
    const sh=$('#shooter'),ke=$('#keeper');
    if(sh)sh.dataset.role=shooterRole;if(ke)ke.dataset.role=keeperRole;
  }

  function previewShot(profile){
    const shooter=$('#shooter');if(!shooter)return;
    setState(shooter,'aim');
    animate(shooter,[{transform:'translate3d(0,0,0) rotate(0deg)'},{transform:`translate3d(${(profile.targetX||0)*-5}px,-4px,0) rotate(${(profile.curve||0)*-2}deg)`},{transform:'translate3d(0,0,0) rotate(0deg)'}],{duration:340,easing:'ease-out'});
  }

  function targetPx(shot,result){
    const goal=$('#goal'),stad=$('#stadium');
    if(!goal||!stad)return {sx:0,sy:0,ex:0,ey:0};
    const gr=goal.getBoundingClientRect(),sr=stad.getBoundingClientRect();
    const fx=result?.finalX??shot.targetX,fy=result?.finalY??shot.targetY;
    return {sx:sr.width*.5,sy:sr.height*.895,ex:(gr.left-sr.left)+gr.width*(.5+fx*.44),ey:(gr.top-sr.top)+gr.height*(.90-fy*.76)};
  }

  async function runUp(shooterRole){
    const s=$('#shooter');if(!s)return;
    setState(s,'run');
    const from=shooterRole==='sepanta'?54:48;
    const a=animate(s,[
      {transform:`translate3d(${from}px,0,0) rotate(1deg) scale(1)`,offset:0},
      {transform:`translate3d(${from*.72}px,-2px,0) rotate(-1.5deg) scale(1.015)`,offset:.23},
      {transform:`translate3d(${from*.42}px,1px,0) rotate(1deg) scale(.995)`,offset:.46},
      {transform:`translate3d(${from*.15}px,-3px,0) rotate(-2deg) scale(1.02)`,offset:.7},
      {transform:'translate3d(0,0,0) rotate(0deg) scale(1)',offset:1}
    ],{duration:500,easing:'cubic-bezier(.2,.7,.2,1)'});
    await a.finished.catch(()=>{});
    setState(s,'strike');
    const k=animate(s,[{transform:'translate3d(0,0,0) rotate(0)'},{transform:'translate3d(-8px,-7px,0) rotate(-5deg) scale(1.03)'},{transform:'translate3d(7px,1px,0) rotate(4deg) scale(.99)'},{transform:'translate3d(0,0,0) rotate(0)'}],{duration:260,easing:'ease-out'});
    await wait(95);return k;
  }

  function keeperAnticipate(zone){
    const k=$('#keeper');if(!k)return;
    setState(k,'ready');
    const x=zone?.endsWith('L')?-9:zone?.endsWith('R')?9:0;
    animate(k,[{transform:'translateX(-50%) translateY(0) scale(1)'},{transform:`translateX(calc(-50% + ${x}px)) translateY(4px) scale(1.025)`},{transform:'translateX(-50%) translateY(0) scale(1)'}],{duration:360,easing:'ease-in-out',iterations:1});
  }

  async function dive(zone,saved){
    const k=$('#keeper');if(!k)return;
    setState(k,'dive');
    const z=zoneMap[zone]||zoneMap.BC;
    const dx=z.x*120,dy=(.5-z.y)*115;
    const rot=z.x*18;
    const scale=saved?1.10:1.04;
    const a=animate(k,[
      {transform:'translateX(-50%) translate3d(0,0,0) rotate(0deg) scale(1)',offset:0},
      {transform:`translateX(-50%) translate3d(${dx*.35}px,${dy*.28-10}px,0) rotate(${rot*.35}deg) scale(1.04)`,offset:.28},
      {transform:`translateX(-50%) translate3d(${dx}px,${dy}px,0) rotate(${rot}deg) scale(${scale})`,offset:.72},
      {transform:`translateX(-50%) translate3d(${dx*.9}px,${dy+15}px,0) rotate(${rot*.75}deg) scale(1.02)`,offset:1}
    ],{duration:620,easing:'cubic-bezier(.18,.72,.2,1)'});
    await a.finished.catch(()=>{});
  }

  async function flyBall(shot,result){
    const ball=$('#ball');if(!ball)return;
    const p=targetPx(shot,result);const curve=(shot.curve||0)*86;
    const duration=Math.round(760-(shot.power||.5)*230);
    cancelAnimations(ball);ball.style.left=p.sx+'px';ball.style.top=p.sy+'px';ball.style.bottom='auto';
    const a=animate(ball,[
      {left:p.sx+'px',top:p.sy+'px',transform:'translate(-50%,-50%) scale(1) rotate(0deg)',offset:0},
      {left:(p.sx+(p.ex-p.sx)*.30+curve*.45)+'px',top:(p.sy+(p.ey-p.sy)*.22-34)+'px',transform:'translate(-50%,-50%) scale(.88) rotate(220deg)',offset:.3},
      {left:(p.sx+(p.ex-p.sx)*.64+curve)+'px',top:(p.sy+(p.ey-p.sy)*.55-18)+'px',transform:'translate(-50%,-50%) scale(.68) rotate(510deg)',offset:.62},
      {left:p.ex+'px',top:p.ey+'px',transform:'translate(-50%,-50%) scale(.49) rotate(820deg)',offset:1}
    ],{duration,easing:'cubic-bezier(.16,.7,.18,1)'});
    await a.finished.catch(()=>{});
  }

  function netReaction(){
    const n=$('#net');if(!n)return;
    animate(n,[{transform:'perspective(350px) translateZ(0) scale(1)'},{transform:'perspective(350px) translateZ(-26px) scale(1.045)'},{transform:'perspective(350px) translateZ(0) scale(1)'}],{duration:480,easing:'ease-out'});
  }

  function familyReaction(kind){
    const m=$('#spectator-mom'),d=$('#spectator-daughter');
    [m,d].forEach(e=>{if(!e)return;e.classList.remove('cheer','clap','oops');e.classList.add(kind);setTimeout(()=>e.classList.remove(kind),1750)});
  }

  async function celebrate(role){
    const s=$('#shooter');if(!s)return;setState(s,'celebrate');
    if(role==='sepanta'){
      await animate(s,[{transform:'translateY(0) scale(1)'},{transform:'translateY(-52px) scale(1.08)'},{transform:'translateY(2px) scale(.98)'},{transform:'translateY(-22px) scale(1.04)'},{transform:'translateY(0) scale(1)'}],{duration:900,easing:'cubic-bezier(.2,.8,.2,1)'}).finished.catch(()=>{});
    }else{
      await animate(s,[{transform:'translate3d(0,0,0) rotate(0deg)'},{transform:'translate3d(-20px,-48px,0) rotate(120deg)'},{transform:'translate3d(-30px,-68px,0) rotate(230deg)'},{transform:'translate3d(-14px,-30px,0) rotate(330deg)'},{transform:'translate3d(0,0,0) rotate(360deg)'}],{duration:1000,easing:'cubic-bezier(.25,.75,.2,1)'}).finished.catch(()=>{});
    }
  }

  async function disappointed(){
    const s=$('#shooter');if(!s)return;setState(s,'disappointed');
    await animate(s,[{transform:'translateY(0) rotate(0)'},{transform:'translateY(8px) rotate(-2deg) scale(.98)'},{transform:'translateY(4px) rotate(1deg)'},{transform:'translateY(0) rotate(0)'}],{duration:700,easing:'ease-out'}).finished.catch(()=>{});
  }

  async function resolve(event){
    if(!event||running)return;running=true;
    const {shot,result,keeperAction,shooter}=event;
    const stage=$('#stadium');
    reset();running=true;setCharacters(shooter,event.keeper);keeperAnticipate(keeperAction?.zone);
    await runUp(shooter);
    stage?.classList.add('camera-kick');setTimeout(()=>stage?.classList.remove('camera-kick'),220);
    const flight=flyBall(shot,result);await wait(70);const diveAnim=dive(keeperAction?.zone||'BC',!!result.save);await Promise.all([flight,diveAnim]);
    if(result.goal){netReaction();stage?.classList.add('camera-goal');setTimeout(()=>stage?.classList.remove('camera-goal'),450);familyReaction('cheer');await celebrate(shooter)}
    else {stage?.classList.add('camera-save');setTimeout(()=>stage?.classList.remove('camera-save'),320);familyReaction(result.kind==='saved'?'clap':'oops');await disappointed()}
    running=false;
  }

  window.MatchV3={reset,setCharacters,previewShot,resolve,familyReaction,get running(){return running}};
})();
