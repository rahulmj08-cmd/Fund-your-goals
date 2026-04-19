'use client'
import { useState, useEffect } from 'react'

const C={bg:'#0F172A',bg2:'#1E293B',border:'rgba(255,255,255,0.08)',text:'#F1F5F9',text2:'#94A3B8',text3:'#64748B',blue:'#3B82F6',blueD:'#2563EB',blueL:'rgba(59,130,246,.12)',gold:'#D4A843',green:'#10B981'}
const WEB3KEY='d7482f92-835d-4e61-a4f3-b02b801821a5'
const occupations=['Salaried','Business Owner','Self-Employed','Professional','Retired','Homemaker']

const Qs=[
{q:"What is your current age group?",o:[{l:"Above 55",s:1},{l:"45\u201355",s:3},{l:"35\u201345",s:6},{l:"Below 35",s:10}]},
{q:"What is your primary investment objective?",o:[{l:"Preserve capital at all costs",s:1},{l:"Regular income with some growth",s:4},{l:"Long-term wealth creation",s:7},{l:"Aggressive growth \u2014 maximize returns",s:10}]},
{q:"How many years before you need this money?",o:[{l:"Less than 3 years",s:1},{l:"3\u20135 years",s:4},{l:"5\u201310 years",s:7},{l:"More than 10 years",s:10}]},
{q:"How familiar are you with equity and mutual fund investments?",o:[{l:"No experience at all",s:1},{l:"Basic \u2014 know FDs and savings",s:3},{l:"Moderate \u2014 invested in MFs/stocks",s:7},{l:"Expert \u2014 actively manage portfolio",s:10}]},
{q:"If your portfolio drops 20% in a month, what would you do?",o:[{l:"Sell everything immediately",s:1},{l:"Sell some and move to safety",s:3},{l:"Hold and wait for recovery",s:7},{l:"Invest more \u2014 buying opportunity",s:10}]},
{q:"What percentage of your monthly income can you invest?",o:[{l:"Less than 10%",s:2},{l:"10\u201320%",s:4},{l:"20\u201335%",s:7},{l:"More than 35%",s:10}]},
{q:"How do you feel about market volatility?",o:[{l:"Very uncomfortable \u2014 I worry daily",s:1},{l:"Somewhat nervous but can tolerate",s:4},{l:"I understand it\u2019s normal and stay calm",s:7},{l:"I welcome it \u2014 creates opportunities",s:10}]},
{q:"What is your current debt situation?",o:[{l:"High EMIs \u2014 more than 50% of income",s:1},{l:"Moderate EMIs \u2014 30\u201350% of income",s:4},{l:"Low EMIs \u2014 under 30% of income",s:7},{l:"Debt-free",s:10}]},
{q:"Do you have adequate emergency fund and insurance?",o:[{l:"No emergency fund, no insurance",s:1},{l:"Some savings but no proper insurance",s:3},{l:"Emergency fund OR insurance in place",s:6},{l:"Both emergency fund and insurance covered",s:10}]},
{q:"Which portfolio allocation would you be most comfortable with?",o:[{l:"90% FD/Debt + 10% Equity",s:1},{l:"60% Debt + 40% Equity",s:4},{l:"40% Debt + 60% Equity",s:7},{l:"20% Debt + 80% Equity",s:10}]}
]

const Profiles=[
{min:0,max:25,n:"Conservative",color:"#60a5fa",alloc:{Equity:20,Debt:50,Gold:10,Liquid:20}},
{min:26,max:50,n:"Moderate",color:"#2dd4bf",alloc:{Equity:40,Debt:35,Gold:10,Liquid:15}},
{min:51,max:75,n:"Moderately Aggressive",color:"#fb923c",alloc:{Equity:60,Debt:25,Gold:10,Liquid:5}},
{min:76,max:100,n:"Aggressive",color:"#f43f5e",alloc:{Equity:80,Debt:10,Gold:5,Liquid:5}}
]

export default function IntakePage(){
  const [step,setStep]=useState(0)
  const [form,setForm]=useState({name:'',phone:'',email:'',city:'',occupation:'',message:''})
  const [wantRisk,setWantRisk]=useState(false)
  const [answers,setAnswers]=useState({})
  const [currentQ,setCurrentQ]=useState(0)
  const [submitting,setSubmitting]=useState(false)
  const [animate,setAnimate]=useState(true)

  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  const canSubmit=form.name&&form.phone&&form.email
  const score=Object.values(answers).reduce((a,b)=>a+b,0)
  const prof=Profiles.find(p=>score>=p.min&&score<=p.max)||Profiles[0]
  const allDone=Object.keys(answers).length===10

  const selectAnswer=(qi,s)=>{
    setAnswers(p=>({...p,[qi]:s}))
    if(qi<9){setAnimate(false);setTimeout(()=>{setCurrentQ(qi+1);setAnimate(true)},200)}
  }

  const handleSubmit=async()=>{
    setSubmitting(true)
    const body={access_key:WEB3KEY,subject:`New Lead - ${form.name}`,from_name:'Fund Your Goals',
      'Name':form.name,'Phone':form.phone,'Email':form.email,
      'City':form.city||'Not provided','Occupation':form.occupation||'Not specified',
      'Message':form.message||'No message'}
    if(wantRisk&&allDone){
      const allocText=Object.entries(prof.alloc).map(([k,v])=>`${k}: ${v}%`).join(' | ')
      body.subject=`New Lead + Risk Profile: ${form.name} \u2014 ${prof.n} (${score}/100)`
      body['Risk Score']=`${score}/100`
      body['Risk Profile']=prof.n
      body['Allocation (AMFI)']=allocText
      Qs.forEach((q,i)=>{body[`Q${i+1}`]=q.o.find(o=>o.s===answers[i])?.l||'\u2014'})
    }
    try{await fetch('https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}catch{}
    setStep(2)
    setSubmitting(false)
  }

  return(
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",position:'relative',overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
        @keyframes confetti{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(-220px) rotate(720deg);opacity:0}}
        @keyframes checkDraw{from{stroke-dashoffset:50}to{stroke-dashoffset:0}}
        @keyframes ringPulse{0%,100%{transform:scale(1);opacity:.25}50%{transform:scale(1.4);opacity:0}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
        .fade-up{animation:fadeUp .6s ease forwards}
        .slide-in{animation:slideIn .4s ease forwards}
        .i-input{width:100%;padding:14px 16px;border-radius:12px;border:1.5px solid ${C.border};background:rgba(255,255,255,0.03);color:${C.text};font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all .3s}
        .i-input:focus{border-color:${C.blue};background:rgba(59,130,246,.03)}
        .i-input::placeholder{color:${C.text3}}
        .i-label{font-size:11px;color:${C.text2};margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
        .i-chip{padding:11px 16px;border-radius:12px;border:1.5px solid ${C.border};background:rgba(255,255,255,0.02);cursor:pointer;transition:all .25s;font-size:13px;color:${C.text2};text-align:center;font-weight:500}
        .i-chip:hover{border-color:rgba(59,130,246,.3);background:rgba(59,130,246,.03)}
        .i-chip.active{border-color:${C.blue};background:${C.blueL};color:${C.blue};font-weight:700}
        .i-btn{width:100%;padding:16px;border-radius:50px;border:none;font-size:16px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .3s;background:${C.blue};color:#fff;box-shadow:0 8px 30px rgba(59,130,246,.2)}
        .i-btn:hover{background:${C.blueD};box-shadow:0 12px 40px rgba(59,130,246,.3);transform:translateY(-1px)}
        .i-btn:disabled{opacity:.35;cursor:not-allowed;transform:none;box-shadow:none}
        .r-opt{width:100%;padding:15px 18px;border-radius:12px;border:1.5px solid ${C.border};background:rgba(255,255,255,0.02);cursor:pointer;transition:all .25s;font-size:14px;color:${C.text2};text-align:left;font-family:'Plus Jakarta Sans',sans-serif;display:block;font-weight:500}
        .r-opt:hover{border-color:rgba(59,130,246,.4);background:rgba(59,130,246,.04);color:${C.text}}
        .r-opt.sel{border-color:${C.blue};background:${C.blueL};color:${C.blue};font-weight:700}
        textarea.i-input{resize:none;min-height:70px}
        @media(max-width:600px){.i-grid{grid-template-columns:1fr!important}.i-chips{grid-template-columns:1fr 1fr!important}.r-opt{padding:16px 18px;font-size:15px}}
      `}</style>

      <div style={{padding:'14px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',backdropFilter:'blur(12px)',background:'rgba(15,23,42,.92)',position:'relative',zIndex:10}}>
        <a href="/" style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:C.text,textDecoration:'none'}}>
          Fund Your <span style={{color:C.blue}}>Goals</span>
        </a>
        <span style={{fontSize:11,color:C.text3}}>
          {step===0&&'Your Details'}
          {step===1&&`Question ${currentQ+1}/10`}
          {step===2&&'Complete'}
        </span>
      </div>

      <div style={{height:3,background:'rgba(255,255,255,0.04)'}}>
        <div style={{height:'100%',background:`linear-gradient(90deg,${C.blue},#60a5fa)`,transition:'width .5s ease',borderRadius:'0 3px 3px 0',
          width:step===0?'10%':step===1?`${10+((Object.keys(answers).length/10)*60)}%`:'100%'}}/>
      </div>

      <div style={{maxWidth:560,margin:'0 auto',padding:'36px 24px 80px',position:'relative',zIndex:5}}>

        {step===0&&<div className="fade-up">
          <div style={{textAlign:'center',marginBottom:28}}>
            <div style={{display:'inline-block',padding:'6px 16px',borderRadius:50,fontSize:11,fontWeight:700,color:C.blue,background:C.blueL,marginBottom:16,letterSpacing:.5}}>Get Started</div>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:C.text,marginBottom:8,lineHeight:1.25}}>
              {"Let's Plan Your"}<br/><span style={{color:C.blue,fontStyle:'italic'}}>Financial Future</span>
            </h1>
            <p style={{fontSize:14,color:C.text2,lineHeight:1.6}}>Share your details and our team will reach out to you within 24 hours.</p>
          </div>
          <div style={{display:'grid',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}} className="i-grid">
              <div><div className="i-label">Full Name *</div><input className="i-input" placeholder="Your full name" value={form.name} onChange={e=>set('name',e.target.value)}/></div>
              <div><div className="i-label">Phone *</div><input className="i-input" type="tel" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={e=>set('phone',e.target.value)}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}} className="i-grid">
              <div><div className="i-label">Email *</div><input className="i-input" type="email" placeholder="your@email.com" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
              <div><div className="i-label">City</div><input className="i-input" placeholder="Your city" value={form.city} onChange={e=>set('city',e.target.value)}/></div>
            </div>
            <div><div className="i-label">Occupation</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}} className="i-chips">
                {occupations.map(o=>(<div key={o} className={`i-chip${form.occupation===o?' active':''}`} onClick={()=>set('occupation',form.occupation===o?'':o)}>{o}</div>))}
              </div>
            </div>
            <div><div className="i-label">Message (optional)</div><textarea className="i-input" placeholder="Anything you'd like us to know..." value={form.message} onChange={e=>set('message',e.target.value)}/></div>

            <div onClick={()=>setWantRisk(!wantRisk)} style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderRadius:12,border:`1.5px solid ${wantRisk?C.blue+'60':C.border}`,background:wantRisk?C.blueL:'transparent',cursor:'pointer',transition:'all .3s'}}>
              <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${wantRisk?C.blue:C.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .3s',background:wantRisk?C.blue:'transparent'}}>
                {wantRisk&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:wantRisk?C.blue:C.text}}>I'd like to take the Risk Assessment</div>
                <div style={{fontSize:11,color:C.text3,marginTop:2}}>Optional — 10 quick questions to understand your risk tolerance</div>
              </div>
            </div>

            <button className="i-btn" disabled={!canSubmit||submitting} onClick={()=>{
              if(wantRisk){setStep(1)}else{handleSubmit()}
            }}>{submitting?'Sending...':(wantRisk?'Continue to Risk Assessment →':'Submit')}</button>

            <div style={{display:'flex',justifyContent:'center',gap:20,fontSize:10,color:C.text3,flexWrap:'wrap'}}>
              <span>🔒 100% Confidential</span><span>📞 Callback within 24 hours</span><span>✓ No spam ever</span>
            </div>
          </div>
        </div>}

        {step===1&&<div>
          <div style={{marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.text2,marginBottom:6}}>
              <span>Question {currentQ+1} of 10</span><span>{Object.keys(answers).length}/10 answered</span>
            </div>
            <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.04)',overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:3,background:allDone?C.green:C.blue,width:`${(Object.keys(answers).length/10)*100}%`,transition:'width .4s'}}/>
            </div>
          </div>
          <div key={currentQ} className={animate?'slide-in':''} style={{opacity:animate?undefined:0}}>
            <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:16,padding:24,marginBottom:16}}>
              <div style={{fontSize:11,color:C.blue,fontWeight:700,marginBottom:14}}>Q{currentQ+1}</div>
              <div style={{fontSize:17,fontWeight:700,color:C.text,lineHeight:1.4,marginBottom:18}}>{Qs[currentQ].q}</div>
              <div style={{display:'grid',gap:8}}>
                {Qs[currentQ].o.map((o,oi)=>(<button key={oi} className={`r-opt${answers[currentQ]===o.s?' sel':''}`} onClick={()=>selectAnswer(currentQ,o.s)}>
                  <span style={{marginRight:10,fontSize:11,opacity:.4}}>{String.fromCharCode(65+oi)}.</span>{o.l}
                </button>))}
              </div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>{if(currentQ>0){setAnimate(false);setTimeout(()=>{setCurrentQ(currentQ-1);setAnimate(true)},200)}else setStep(0)}} style={{padding:'10px 20px',borderRadius:50,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text2,fontSize:12,cursor:'pointer',fontFamily:"'Plus Jakarta Sans'",fontWeight:600}}>← Back</button>
            <div style={{display:'flex',gap:4}}>{Array.from({length:10}).map((_,i)=>(<div key={i} onClick={()=>{if(answers[i]!==undefined){setAnimate(false);setTimeout(()=>{setCurrentQ(i);setAnimate(true)},200)}}} style={{width:8,height:8,borderRadius:4,background:answers[i]!==undefined?C.blue:i===currentQ?C.text+'60':'rgba(255,255,255,0.08)',cursor:answers[i]!==undefined?'pointer':'default',transition:'all .3s'}}/>))}</div>
            {allDone?<button className="i-btn" style={{width:'auto',padding:'10px 28px',fontSize:13,borderRadius:50}} disabled={submitting} onClick={handleSubmit}>{submitting?'Sending...':'Submit'}</button>:
            currentQ<9?<button onClick={()=>{setAnimate(false);setTimeout(()=>{setCurrentQ(currentQ+1);setAnimate(true)},200)}} style={{padding:'10px 20px',borderRadius:50,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text2,fontSize:12,cursor:'pointer',fontFamily:"'Plus Jakarta Sans'",fontWeight:600}}>Next →</button>:<div style={{width:80}}/>}
          </div>
        </div>}

        {step===2&&<ThankYou name={form.name} didRisk={wantRisk&&allDone} profile={prof}/>}
      </div>
    </div>
  )
}

function ThankYou({name}){
  const [show,setShow]=useState(false)
  useEffect(()=>{setTimeout(()=>setShow(true),100)},[])
  return(<div style={{textAlign:'center',paddingTop:20,opacity:show?1:0,transition:'all .7s',transform:show?'translateY(0)':'translateY(30px)'}}>
    {show&&Array.from({length:20}).map((_,i)=>(<div key={i} style={{position:'fixed',left:`${8+Math.random()*84}%`,bottom:'40%',width:i%2===0?8:6,height:i%2===0?8:6,borderRadius:i%3===0?'50%':'2px',background:['#3B82F6','#10B981','#60a5fa','#a78bfa','#f87171','#D4A843'][i%6],animation:`confetti ${1.2+Math.random()*1.8}s ease-out ${Math.random()*.5}s forwards`,opacity:0}}/>))}
    <div style={{position:'relative',width:110,height:110,margin:'0 auto 24px'}}>
      <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(16,185,129,.15)',animation:'ringPulse 2s ease-in-out infinite'}}/>
      <svg width="110" height="110" viewBox="0 0 110 110" style={{animation:'scaleIn .6s ease .2s both'}}><circle cx="55" cy="55" r="48" fill="rgba(16,185,129,.06)" stroke="#10B981" strokeWidth="2" opacity=".4"/><path d="M33 55 L48 70 L77 38" fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{strokeDasharray:50,animation:'checkDraw .6s ease .5s both'}}/></svg>
    </div>
    <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:'#F1F5F9',marginBottom:12}}>Thank You{name?`, ${name.split(' ')[0]}`:''} !</h1>
    <p style={{fontSize:15,color:'#94A3B8',lineHeight:1.8,marginBottom:24}}>We have received your details.<br/>Our team will <span style={{color:'#D4A843',fontWeight:600}}>reach out to you within 24 hours</span>.</p>
    <a href="/" style={{display:'inline-block',padding:'12px 32px',borderRadius:50,background:'rgba(59,130,246,.1)',border:'1px solid rgba(59,130,246,.2)',color:'#3B82F6',textDecoration:'none',fontSize:13,fontWeight:700,fontFamily:"'Plus Jakarta Sans'"}}>← Back to Home</a>
  </div>)
}
