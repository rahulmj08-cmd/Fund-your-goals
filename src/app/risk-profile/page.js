'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const C={bg:'#0F172A',bg2:'#1E293B',border:'rgba(255,255,255,0.08)',text:'#F1F5F9',text2:'#94A3B8',text3:'#64748B',blue:'#3B82F6',blueD:'#2563EB',blueL:'rgba(59,130,246,.12)',gold:'#D4A843',green:'#10B981'}
const WEB3KEY='d7482f92-835d-4e61-a4f3-b02b801821a5'

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
{min:0,max:25,n:"Conservative",color:"#60a5fa",desc:"Capital preservation focused. Suitable for short horizons or low risk appetite.",alloc:{Equity:20,Debt:50,Gold:10,Liquid:20}},
{min:26,max:50,n:"Moderate",color:"#2dd4bf",desc:"Balanced growth and stability. Comfortable with moderate market fluctuations.",alloc:{Equity:40,Debt:35,Gold:10,Liquid:15}},
{min:51,max:75,n:"Moderately Aggressive",color:"#fb923c",desc:"Growth-oriented with tolerance for market swings and a long investment horizon.",alloc:{Equity:60,Debt:25,Gold:10,Liquid:5}},
{min:76,max:100,n:"Aggressive",color:"#f43f5e",desc:"Maximum growth focus. Can withstand large drawdowns with very long horizon.",alloc:{Equity:80,Debt:10,Gold:5,Liquid:5}}
]

function RiskForm(){
  const params=useSearchParams()
  const [step,setStep]=useState(0)
  const [name,setName]=useState(params.get('name')||'')
  const [email,setEmail]=useState(params.get('email')||'')
  const [phone,setPhone]=useState(params.get('phone')||'')
  const [age,setAge]=useState('')
  const [answers,setAnswers]=useState({})
  const [currentQ,setCurrentQ]=useState(0)
  const [submitting,setSubmitting]=useState(false)
  const [animate,setAnimate]=useState(true)

  const score=Object.values(answers).reduce((a,b)=>a+b,0)
  const prof=Profiles.find(p=>score>=p.min&&score<=p.max)||Profiles[0]
  const pct=Math.round(score/100*100)
  const allDone=Object.keys(answers).length===10

  const selectAnswer=(qi,s)=>{
    setAnswers(p=>({...p,[qi]:s}))
    if(qi<9){setAnimate(false);setTimeout(()=>{setCurrentQ(qi+1);setAnimate(true)},200)}
  }

  const submitResult=async()=>{
    setSubmitting(true)
    const allocText=Object.entries(prof.alloc).map(([k,v])=>`${k}: ${v}%`).join(' | ')
    const answersText=Qs.map((q,i)=>`Q${i+1}. ${q.q}\n   Answer: ${q.o.find(o=>o.s===answers[i])?.l||'\u2014'} (Score: ${answers[i]}/10)`).join('\n\n')
    try{
      await fetch('https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        access_key:WEB3KEY,subject:`Risk Profile: ${name||'Client'} \u2014 ${prof.n} (${score}/100)`,from_name:'Fund Your Goals - Risk Assessment',
        'Client Name':name||'Not provided','Age':age||'Not provided','Email':email||'Not provided','Phone':phone||'Not provided',
        'Risk Score':`${score} out of 100 (${pct}%)`,
        'Risk Profile':prof.n,'Recommended Allocation (AMFI)':allocText,'Detailed Answers':answersText
      })})
    }catch{}
    setStep(3)
    setSubmitting(false)
  }

  return(
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
        @keyframes confetti{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(-220px) rotate(720deg);opacity:0}}
        .r-input{width:100%;padding:14px 16px;border-radius:12px;border:1.5px solid ${C.border};background:rgba(255,255,255,0.03);color:${C.text};font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all .3s}
        .r-input:focus{border-color:${C.blue};background:rgba(59,130,246,.03)}
        .r-input::placeholder{color:${C.text3}}
        .r-opt{width:100%;padding:15px 18px;border-radius:12px;border:1.5px solid ${C.border};background:rgba(255,255,255,0.02);cursor:pointer;transition:all .25s;font-size:14px;color:${C.text2};text-align:left;font-family:'Plus Jakarta Sans',sans-serif;display:block;font-weight:500}
        .r-opt:hover{border-color:rgba(59,130,246,.4);background:rgba(59,130,246,.04);color:${C.text}}
        .r-opt.sel{border-color:${C.blue};background:${C.blueL};color:${C.blue};font-weight:700}
        .r-btn{width:100%;padding:16px;border-radius:50px;border:none;font-size:16px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;background:${C.blue};color:#fff;box-shadow:0 8px 30px rgba(59,130,246,.2)}
        .r-btn:hover{background:${C.blueD};box-shadow:0 12px 40px rgba(59,130,246,.3)}
        .r-btn:disabled{opacity:.35;cursor:not-allowed}
        .fade-up{animation:fadeUp .5s ease forwards}
        .slide-in{animation:slideIn .4s ease forwards}
        @media(max-width:600px){.r-grid{grid-template-columns:1fr!important}.r-opt{padding:16px 18px;font-size:15px}.r-btn{padding:18px;font-size:17px}}
      `}</style>

      <div style={{padding:'14px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(15,23,42,.92)',backdropFilter:'blur(12px)',position:'relative',zIndex:10}}>
        <a href="/" style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:C.text,textDecoration:'none'}}>Fund Your <span style={{color:C.blue}}>Goals</span></a>
        <span style={{fontSize:11,color:C.text3}}>Risk Profile Assessment</span>
      </div>

      <div style={{maxWidth:580,margin:'0 auto',padding:'32px 24px 80px',position:'relative',zIndex:5}}>

        {step===0&&<div className="fade-up" style={{textAlign:'center'}}>
          <div style={{display:'inline-block',padding:'6px 16px',borderRadius:50,fontSize:11,fontWeight:700,color:C.blue,background:C.blueL,marginBottom:20}}>Risk Assessment</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:C.text,marginBottom:8}}>Risk Profile<br/><span style={{color:C.blue,fontStyle:'italic'}}>Assessment</span></h1>
          <p style={{fontSize:14,color:C.text2,lineHeight:1.7,marginBottom:28,maxWidth:400,margin:'0 auto 28px'}}>Answer 10 simple questions to discover your investment risk tolerance.</p>
          <div style={{display:'grid',gap:12,textAlign:'left',marginBottom:24}}>
            <div><div style={{fontSize:11,color:C.text2,marginBottom:4,textTransform:'uppercase',letterSpacing:'.8px',fontWeight:700}}>Full Name *</div><input className="r-input" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="r-grid">
              <div><div style={{fontSize:11,color:C.text2,marginBottom:4,textTransform:'uppercase',letterSpacing:'.8px',fontWeight:700}}>Email *</div><input className="r-input" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
              <div><div style={{fontSize:11,color:C.text2,marginBottom:4,textTransform:'uppercase',letterSpacing:'.8px',fontWeight:700}}>Phone</div><input className="r-input" placeholder="+91 XXXXX XXXXX" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
            </div>
            <div><div style={{fontSize:11,color:C.text2,marginBottom:4,textTransform:'uppercase',letterSpacing:'.8px',fontWeight:700}}>Age</div><input className="r-input" type="number" placeholder="Your age" value={age} onChange={e=>setAge(e.target.value)}/></div>
          </div>
          <button className="r-btn" disabled={!name||!email} onClick={()=>setStep(1)}>Start Assessment →</button>
        </div>}

        {step===1&&<div>
          <div style={{marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.text2,marginBottom:6}}>
              <span>Question {currentQ+1} of 10</span><span>{Object.keys(answers).length}/10</span>
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
            {allDone?<button className="r-btn" style={{width:'auto',padding:'10px 28px',fontSize:13,borderRadius:50}} onClick={()=>setStep(2)}>See Results →</button>:
            currentQ<9?<button onClick={()=>{setAnimate(false);setTimeout(()=>{setCurrentQ(currentQ+1);setAnimate(true)},200)}} style={{padding:'10px 20px',borderRadius:50,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text2,fontSize:12,cursor:'pointer',fontFamily:"'Plus Jakarta Sans'",fontWeight:600}}>Next →</button>:<div style={{width:80}}/>}
          </div>
        </div>}

        {step===2&&<div className="fade-up" style={{textAlign:'center'}}>
          <div style={{fontSize:11,color:C.text2,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Your Risk Profile</div>
          <svg viewBox="0 0 320 200" style={{display:'block',margin:'0 auto 8px',width:'100%',maxWidth:300}}>
            <path d="M 35 170 A 125 125 0 0 1 95 48" stroke="#60a5fa" strokeWidth="20" fill="none" strokeLinecap="round" opacity=".9"/>
            <path d="M 95 48 A 125 125 0 0 1 160 28" stroke="#2dd4bf" strokeWidth="20" fill="none" strokeLinecap="round" opacity=".9"/>
            <path d="M 160 28 A 125 125 0 0 1 225 48" stroke="#fb923c" strokeWidth="20" fill="none" strokeLinecap="round" opacity=".9"/>
            <path d="M 225 48 A 125 125 0 0 1 285 170" stroke="#f43f5e" strokeWidth="20" fill="none" strokeLinecap="round" opacity=".9"/>
            <text x="18" y="195" fontSize="11" fill="#60a5fa" fontFamily="Plus Jakarta Sans" fontWeight="600">Low</text>
            <text x="160" y="18" fontSize="11" fill="#2dd4bf" fontFamily="Plus Jakarta Sans" textAnchor="middle" fontWeight="600">Moderate</text>
            <text x="268" y="195" fontSize="11" fill="#f43f5e" fontFamily="Plus Jakarta Sans" fontWeight="600">High</text>
            {(()=>{const angle=-90+(pct*1.8);const rad=angle*Math.PI/180;const nx=160+105*Math.cos(rad);const ny=170+105*Math.sin(rad);return(<>
              <line x1="160" y1="170" x2={nx} y2={ny} stroke={prof.color} strokeWidth="4" strokeLinecap="round"><animate attributeName="x2" from="160" to={nx} dur="1.2s" fill="freeze"/><animate attributeName="y2" from="170" to={ny} dur="1.2s" fill="freeze"/></line>
              <circle cx="160" cy="170" r="8" fill={prof.color}/>
            </>)})()}
          </svg>
          <div style={{fontSize:36,fontWeight:900,color:prof.color,fontFamily:"'Playfair Display',serif",margin:'8px 0 4px'}}>{prof.n}</div>
          <div style={{fontSize:36,fontWeight:900,color:prof.color}}>{score}<span style={{fontSize:16,color:C.text3}}>/100</span></div>
          <p style={{fontSize:13,color:C.text2,maxWidth:400,margin:'12px auto 20px',lineHeight:1.6}}>{prof.desc}</p>
          <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:16,padding:20,marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:12,textAlign:'center'}}>Recommended Asset Allocation (AMFI Guidelines)</div>
            <div style={{display:'flex',gap:6}}>
              {Object.entries(prof.alloc).map(([k,v])=>{const colors={Equity:C.green,Debt:'#60a5fa',Gold:C.gold,Liquid:'#06b6d4'};return(<div key={k} style={{flex:v,minWidth:40,padding:'10px 4px',borderRadius:12,textAlign:'center',background:(colors[k]||C.text3)+'15',border:`1px solid ${(colors[k]||C.text3)}25`}}>
                <div style={{fontSize:20,fontWeight:800,color:colors[k]||C.text3}}>{v}%</div>
                <div style={{fontSize:9,color:C.text2}}>{k}</div>
              </div>)})}
            </div>
          </div>
          <button className="r-btn" disabled={submitting} onClick={submitResult}>{submitting?'Submitting...':'Submit'}</button>
        </div>}

        {step===3&&<ThankYou name={name} profile={prof}/>}
      </div>
    </div>
  )
}

function ThankYou({name,profile}){
  const [show,setShow]=useState(false)
  useEffect(()=>{setTimeout(()=>setShow(true),100)},[])
  return(<div style={{textAlign:'center',opacity:show?1:0,transition:'all .7s',transform:show?'translateY(0)':'translateY(30px)',paddingTop:20}}>
    {show&&Array.from({length:20}).map((_,i)=>(<div key={i} style={{position:'fixed',left:`${8+Math.random()*84}%`,bottom:'45%',width:i%2===0?8:6,height:i%2===0?8:6,borderRadius:i%3===0?'50%':'2px',background:['#3B82F6','#10B981','#60a5fa','#a78bfa','#f87171','#D4A843'][i%6],animation:`confetti ${1.2+Math.random()*1.8}s ease-out ${Math.random()*.5}s forwards`,opacity:0}}/>))}
    <div style={{fontSize:56,marginBottom:16}}>✅</div>
    <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:C.text,marginBottom:12}}>Thank You{name?`, ${name.split(' ')[0]}`:''} !</h1>
    <p style={{fontSize:15,color:C.text2,lineHeight:1.7,marginBottom:20}}>Your risk profile assessment has been submitted.<br/>Our team will <span style={{color:C.gold,fontWeight:600}}>reach out to you within 24 hours</span>.</p>
    <a href="/" style={{display:'inline-block',padding:'12px 32px',borderRadius:50,background:C.blueL,border:`1px solid rgba(59,130,246,.2)`,color:C.blue,textDecoration:'none',fontSize:13,fontWeight:700,fontFamily:"'Plus Jakarta Sans'"}}>← Visit Fund Your Goals</a>
  </div>)
}

export default function RiskProfilePage(){
  return <Suspense fallback={<div style={{minHeight:'100vh',background:'#0F172A',display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Loading...</div>}><RiskForm/></Suspense>
}
