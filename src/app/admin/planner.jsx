import { useState, useMemo, useEffect } from "react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine } from "recharts";

/* ══════════════════════════════════════════════════════════════════
   THEME & UTILS
   ══════════════════════════════════════════════════════════════════ */
const F={s:"'DM Sans',sans-serif",m:"'DM Mono',monospace"};
const C={bg:"#0a0a10",card:"#11111b",card2:"#16162244",border:"#1c1c2e",text:"#e4e2df",dim:"#5e5e70",accent:"#c9a84c",accentBg:"#c9a84c14",green:"#2dd4bf",red:"#f43f5e",orange:"#fb923c",blue:"#60a5fa",purple:"#a78bfa",cyan:"#22d3ee"};
const PIE_COLORS=[C.blue,C.green,C.accent,C.purple,C.cyan,C.orange,C.red,"#6366f1","#14b8a6"];
const fmt=n=>{if(n==null||isNaN(n))return"₹0";const a=Math.abs(n),s=n<0?"−":"";if(a>=1e7)return`${s}₹${(a/1e7).toFixed(2)} Cr`;if(a>=1e5)return`${s}₹${(a/1e5).toFixed(2)} L`;return`${s}₹${Math.round(a).toLocaleString("en-IN")}`};
const pct=n=>((n||0)*100).toFixed(1)+"%";
const rr=n=>Math.round((n||0)*1e4)/100;

/* ── Financial math ── */
const calcFV=(pv,r,y)=>(pv||0)*Math.pow(1+(r||0),y||0);
/* FIX 1: Safe SIP — handles fv=0, y=0, r=0, negative inputs */
const calcSIP=(fv,r,y)=>{if(!fv||fv<=0||!y||y<=0)return 0;const mr=(r||0)/12;const n=y*12;if(mr<=0)return fv/n;return fv*mr/(Math.pow(1+mr,n)-1);};
/* FIX 2: SIP Future Value with MONTHLY compounding (not annual) */
const calcSIPFV=(monthlySIP,annualReturn,years)=>{if(!monthlySIP||!years||years<=0)return 0;const mr=(annualReturn||0)/12;const n=years*12;if(mr<=0)return monthlySIP*n;return monthlySIP*((Math.pow(1+mr,n)-1)/mr);};
/* Step-Up SIP: starting SIP that grows by stepRate annually to reach FV */
const calcStepUpSIP=(fv,r,y,stepRate)=>{if(!fv||fv<=0||!y||y<=0)return 0;const sr=stepRate||0;if(sr===0)return calcSIP(fv,r,y);let lo=0,hi=fv,mid;const mr=(r||0)/12;for(let i=0;i<60;i++){mid=(lo+hi)/2;let acc=0,m=mid;for(let yr=0;yr<y;yr++){for(let mo=0;mo<12;mo++)acc=(acc+m)*(1+mr);m*=(1+sr);}if(acc>fv)hi=mid;else lo=mid;}return Math.round((lo+hi)/2);};
/* FIX 3: Safe weighted average return — prevents NaN/Infinity */
const safeAvgRet=(weights,total)=>{if(!total||total<=0)return 0;const v=weights/total;return isFinite(v)?v:0;};
const STEP_OPTS=[{v:0,l:"Flat"},{v:.05,l:"5%"},{v:.10,l:"10%"},{v:.15,l:"15%"},{v:.20,l:"20%"}];

/* ══════════════════════════════════════════════════════════════════
   MONTE CARLO SIMULATION ENGINE — MONTHLY GRANULARITY
   ══════════════════════════════════════════════════════════════════ */
/* Box-Muller transform — pair of standard normals */
const boxMuller=()=>{let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};

/* Monthly MC: simulates month-by-month with SIP contributions + optional SWP withdrawals
   annualReturn/volatility auto-converted to monthly equivalents
   Fat-tail: 5% crash probability PER YEAR (checked once every 12 months)
   Inflation: optionally simulated monthly for real-value tracking */
const runMonteCarlo=({initialPortfolio,monthlySIP=0,monthlyWithdrawal=0,years,
  meanReturn=.10,volatility=.15,simulations=1000,
  inflationMean=.06,inflationStd=.015,fatTailProb=.05})=>{
  if(!years||years<=0)return{results:[],median:0,p10:0,p25:0,p75:0,p90:0,best:0,worst:0,bands:[]};
  const N=Math.min(Math.max(simulations,100),5000);
  const totalMonths=Math.round(years*12);
  /* Convert annual → monthly */
  const mMean=meanReturn/12;
  const mVol=volatility/Math.sqrt(12);
  const mInfMean=inflationMean/12;
  const mInfStd=inflationStd/Math.sqrt(12);
  const finals=new Float64Array(N);
  /* Sample yearly snapshots for band chart (every 12 months) */
  const yearCount=Math.ceil(years);
  const yearSnaps=Array.from({length:yearCount},()=>new Float64Array(N));
  for(let s=0;s<N;s++){
    let pf=initialPortfolio||0;
    let crashThisYear=false;
    for(let m=0;m<totalMonths;m++){
      /* Fat-tail: decide once per year */
      if(m%12===0)crashThisYear=Math.random()<(fatTailProb||.05);
      /* Monthly return: normal + crash override */
      let mr;
      if(crashThisYear&&m%12<3){
        /* Crash spread over first 3 months of crash year */
        mr=mMean-mVol*3+boxMuller()*mVol*0.3;
      }else{
        mr=mMean+boxMuller()*mVol;
      }
      pf=pf*(1+mr)+(monthlySIP||0)-(monthlyWithdrawal||0);
      if(pf<0)pf=0;
      /* Snapshot at end of each year */
      if((m+1)%12===0){const yi=Math.floor(m/12);if(yi<yearCount)yearSnaps[yi][s]=pf;}
    }
    finals[s]=pf;
  }
  finals.sort();
  const pc=p=>finals[Math.min(Math.floor(p*N),N-1)];
  /* Build yearly percentile bands */
  const bands=yearSnaps.map((snap,i)=>{
    snap.sort();const n=snap.length;
    return{year:i+1,
      p10:snap[Math.floor(.1*n)],p25:snap[Math.floor(.25*n)],
      median:snap[Math.floor(.5*n)],
      p75:snap[Math.floor(.75*n)],p90:snap[Math.floor(.9*n)]};
  });
  return{results:finals,median:pc(.5),p10:pc(.1),p25:pc(.25),p75:pc(.75),p90:pc(.9),best:finals[N-1],worst:finals[0],bands};
};

/* Goal-specific MC: monthly SIP accumulation → probability of reaching target */
const runGoalMC=({existing=0,monthlySIP=0,years,targetFV,meanReturn=.10,volatility=.15,simulations=1000})=>{
  if(!years||years<=0||!targetFV)return{prob:0,median:0,best:0,worst:0,p10:0,p90:0};
  const N=Math.min(Math.max(simulations,100),5000);
  const totalMonths=Math.round(years*12);
  const mMean=meanReturn/12;
  const mVol=volatility/Math.sqrt(12);
  const finals=new Float64Array(N);
  let success=0;
  for(let s=0;s<N;s++){
    let pf=existing;
    let crashYear=false;
    for(let m=0;m<totalMonths;m++){
      if(m%12===0)crashYear=Math.random()<.05;
      const mr=crashYear&&m%12<3?(mMean-mVol*3+boxMuller()*mVol*0.3):(mMean+boxMuller()*mVol);
      pf=Math.max(0,pf*(1+mr)+(monthlySIP||0));
    }
    finals[s]=pf;
    if(pf>=targetFV)success++;
  }
  finals.sort();const n=finals.length;
  return{prob:Math.round(success/N*100),median:finals[Math.floor(.5*n)],best:finals[n-1],worst:finals[0],p10:finals[Math.floor(.1*n)],p90:finals[Math.floor(.9*n)]};
};

/* ── FIX 5: Robust DOB parser with Date object validation ── */
const parseDOB=s=>{if(!s)return null;const p=String(s).split("-");if(p.length!==3)return null;
  let d,m,y;
  if(p[0].length===4){y=+p[0];m=+p[1];d=+p[2];}else{d=+p[0];m=+p[1];y=+p[2];}
  if(!y||!m||!d||m<1||m>12||d<1||d>31||y<1900||y>2100)return null;
  /* Validate with actual Date object — catches Feb 30, Apr 31 etc */
  const dt=new Date(y,m-1,d);
  if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d)return null;
  return{d,m,y,date:dt};};
const calcAge=dob=>{const b=parseDOB(dob);if(!b)return 0;const t=new Date();const ty=t.getFullYear(),tm=t.getMonth()+1,td=t.getDate();let a=ty-b.y;if(tm<b.m||(tm===b.m&&td<b.d))a--;return Math.max(0,a);};
const calcAgeDetail=dob=>{const b=parseDOB(dob);if(!b)return"—";const t=new Date();let y=t.getFullYear()-b.y,m=t.getMonth()+1-b.m;if(t.getDate()<b.d)m--;if(m<0){y--;m+=12;}if(y<=0)return`${Math.max(0,m)}m`;if(y<=5)return`${y}y ${m}m`;return`${y}y`;};
/* Normalize to storage format DD-MM-YYYY from HTML date input YYYY-MM-DD */
const htmlToDD=v=>{if(!v)return"";const p=v.split("-");return p.length===3&&p[0].length===4?`${p[2]}-${p[1]}-${p[0]}`:v;};
const ddToHtml=v=>{if(!v)return"";const p=v.split("-");return p.length===3&&p[2].length===4?`${p[2]}-${p[1]}-${p[0]}`:v;};

/* ── 5. Contribution frequency → monthly ── */
const FREQ={monthly:1,quarterly:3,halfyearly:6,yearly:12};
const toMo=(amt,freq)=>(amt||0)/(FREQ[freq]||1);
const FREQ_OPTS=[{v:"monthly",l:"Monthly"},{v:"quarterly",l:"Quarterly"},{v:"halfyearly",l:"Half-Yearly"},{v:"yearly",l:"Yearly"}];

/* ── Risk profiling — 10-question professional questionnaire ── */
const RISK_QS=[
{q:"What is your current age group?",cat:"Demographics",
 o:[{l:"Above 55",s:1},{l:"45–55",s:3},{l:"35–45",s:6},{l:"Below 35",s:10}]},
{q:"What is your primary investment objective?",cat:"Objective",
 o:[{l:"Preserve capital at all costs",s:1},{l:"Regular income with some growth",s:4},{l:"Long-term wealth creation",s:7},{l:"Aggressive growth — maximize returns",s:10}]},
{q:"How many years before you need this money?",cat:"Horizon",
 o:[{l:"Less than 3 years",s:1},{l:"3–5 years",s:4},{l:"5–10 years",s:7},{l:"More than 10 years",s:10}]},
{q:"How familiar are you with equity and mutual fund investments?",cat:"Knowledge",
 o:[{l:"No experience at all",s:1},{l:"Basic — know FDs and savings",s:3},{l:"Moderate — invested in MFs/stocks",s:7},{l:"Expert — actively manage portfolio",s:10}]},
{q:"If your portfolio drops 20% in a month, what would you do?",cat:"Loss Tolerance",
 o:[{l:"Sell everything immediately",s:1},{l:"Sell some and move to safety",s:3},{l:"Hold and wait for recovery",s:7},{l:"Invest more — it's a buying opportunity",s:10}]},
{q:"What percentage of your monthly income can you invest without affecting lifestyle?",cat:"Capacity",
 o:[{l:"Less than 10%",s:2},{l:"10–20%",s:4},{l:"20–35%",s:7},{l:"More than 35%",s:10}]},
{q:"How do you feel about market volatility (ups and downs)?",cat:"Behavior",
 o:[{l:"Very uncomfortable — I check daily and worry",s:1},{l:"Somewhat nervous but I can tolerate it",s:4},{l:"I understand it's normal and stay calm",s:7},{l:"I welcome it — volatility creates opportunities",s:10}]},
{q:"What is your current debt situation?",cat:"Financial Health",
 o:[{l:"High EMIs — more than 50% of income",s:1},{l:"Moderate EMIs — 30–50% of income",s:4},{l:"Low EMIs — under 30% of income",s:7},{l:"Debt-free",s:10}]},
{q:"Do you have adequate emergency fund and insurance coverage?",cat:"Safety Net",
 o:[{l:"No emergency fund, no insurance",s:1},{l:"Some savings but no proper insurance",s:3},{l:"Emergency fund OR insurance in place",s:6},{l:"Both emergency fund and insurance covered",s:10}]},
{q:"Which portfolio allocation would you be most comfortable with?",cat:"Preference",
 o:[{l:"90% FD/Debt + 10% Equity",s:1},{l:"60% Debt + 40% Equity",s:4},{l:"40% Debt + 60% Equity",s:7},{l:"20% Debt + 80% Equity",s:10}]}
];
const RISK_P=[
{min:0,max:25,n:"Conservative",color:"#60a5fa",
 desc:"You prioritize capital preservation over growth. Suitable for short horizons, retirees, or those with low risk appetite.",
 alloc:{equity:20,debt:50,gold:10,liquid:20},recReturn:.08},
{min:26,max:50,n:"Moderate",color:"#2dd4bf",
 desc:"You seek a balance between growth and stability. Comfortable with moderate market fluctuations for steady long-term returns.",
 alloc:{equity:40,debt:35,gold:10,liquid:15},recReturn:.10},
{min:51,max:75,n:"Moderately Aggressive",color:"#fb923c",
 desc:"You are growth-oriented with tolerance for significant market swings. Long investment horizon with strong financial foundation.",
 alloc:{equity:60,debt:25,gold:10,liquid:5},recReturn:.12},
{min:76,max:100,n:"Aggressive",color:"#f43f5e",
 desc:"You aim for maximum growth and can withstand large drawdowns. Very long horizon, high income stability, and strong risk appetite.",
 alloc:{equity:80,debt:10,gold:5,liquid:5},recReturn:.14}
];
/* Portfolio asset keys for goal funding mapping */
const PF_ASSETS=[
{cat:"equity",key:"equityMF",label:"Equity Mutual Funds",ret:.14},
{cat:"equity",key:"directEquity",label:"Direct Equity/Stocks",ret:.14},
{cat:"equity",key:"ulip",label:"ULIP",ret:.10},
{cat:"fixedIncome",key:"fixedDeposits",label:"Fixed Deposits",ret:.07},
{cat:"fixedIncome",key:"recurringDeposits",label:"Recurring Deposits",ret:.07},
{cat:"fixedIncome",key:"bonds",label:"Bonds",ret:.08},
{cat:"fixedIncome",key:"debtMF",label:"Debt Mutual Funds",ret:.08},
{cat:"retirement",key:"epf",label:"EPF",ret:.081},
{cat:"retirement",key:"nps",label:"NPS",ret:.10},
{cat:"retirement",key:"ppf",label:"PPF",ret:.071},
{cat:"smallSavings",key:"nsc",label:"NSC",ret:.07},
{cat:"smallSavings",key:"ssy",label:"SSY",ret:.08},
{cat:"smallSavings",key:"kvp",label:"KVP",ret:.07},
{cat:"smallSavings",key:"scss",label:"SCSS",ret:.08},
{cat:"smallSavings",key:"postOffice",label:"Post Office",ret:.06},
{cat:"cash",key:"savingsBank",label:"Savings Bank",ret:.04},
{cat:"cash",key:"emergency",label:"Emergency Fund",ret:.04},
{cat:"commodities",key:"goldBars",label:"Gold Bars/Coins",ret:.09},
{cat:"commodities",key:"jewellery",label:"Jewellery",ret:.09}
];

/* ══════════════════════════════════════════════════════════════════
   CHART TOOLTIP
   ══════════════════════════════════════════════════════════════════ */
const ChTip=({active,payload,label})=>{if(!active||!payload?.length)return null;return(
<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:10,fontSize:11,fontFamily:F.m,boxShadow:"0 8px 32px #0008"}}>
<div style={{color:C.dim,marginBottom:4,fontFamily:F.s,fontWeight:600}}>{label}</div>
{payload.map((p,i)=><div key={i} style={{color:p.color||C.text,display:"flex",justifyContent:"space-between",gap:16}}><span>{p.name}</span><span style={{fontWeight:700}}>{fmt(p.value)}</span></div>)}
</div>)};

/* ══════════════════════════════════════════════════════════════════
   UI PRIMITIVES (preserved dark theme + card layout)
   ══════════════════════════════════════════════════════════════════ */
const Inp=({label,value,onChange,type="number",prefix,suffix,disabled,w,hint,placeholder})=>(
<div style={{flex:w?undefined:1,width:w,minWidth:0}}>
{label&&<div style={{fontSize:10,color:C.dim,marginBottom:3,fontFamily:F.s}}>{label}</div>}
<div style={{display:"flex",alignItems:"center",background:disabled?C.bg+"88":C.bg,borderRadius:6,border:`1px solid ${C.border}`,padding:"0 8px"}}>
{prefix&&<span style={{fontSize:11,color:C.dim,marginRight:4}}>{prefix}</span>}
<input type={type==="date"?"date":type==="text"?"text":"text"} value={value??""} disabled={disabled} placeholder={placeholder}
onChange={e=>{if(type==="number"){const v=parseFloat(e.target.value);onChange(isNaN(v)?0:v);}else onChange(e.target.value);}}
style={{flex:1,background:"transparent",border:"none",color:disabled?C.dim:C.text,fontSize:12,padding:"8px 0",outline:"none",fontFamily:F.m,width:"100%",minWidth:0}}/>
{suffix&&<span style={{fontSize:10,color:C.dim,marginLeft:4}}>{suffix}</span>}
</div>
{hint&&<div style={{fontSize:9,color:C.accent,marginTop:2}}>{hint}</div>}
</div>);

const DOBInp=({label,value,onChange,disabled,w})=>{
  const htmlVal=ddToHtml(value);
  return <Inp label={label} value={htmlVal} type="date" disabled={disabled} w={w}
    onChange={v=>onChange(htmlToDD(v))}/>;
};

const Sel=({label,value,onChange,options})=>(<div style={{flex:1,minWidth:0}}>
{label&&<div style={{fontSize:10,color:C.dim,marginBottom:3,fontFamily:F.s}}>{label}</div>}
<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12,padding:"8px",fontFamily:F.s,outline:"none"}}>
{options.map(o=>typeof o==="string"?<option key={o}>{o}</option>:<option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);
const Cd=({title,accent,children,style})=>(<div style={{background:C.card,borderRadius:12,padding:16,border:`1px solid ${C.border}`,borderTop:accent?`2px solid ${accent}`:undefined,...style}}>
{title&&<div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12,fontFamily:F.s}}>{title}</div>}{children}</div>);
const St=({label,value,color,sub})=>(<div style={{flex:1,minWidth:90}}>
<div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:".5px"}}>{label}</div>
<div style={{fontSize:18,fontWeight:800,color:color||C.text,fontFamily:F.m,marginTop:2}}>{value}</div>
{sub&&<div style={{fontSize:9,color:C.dim,marginTop:1}}>{sub}</div>}</div>);
const SH=({icon,title,sub})=>(<div style={{marginBottom:20}}>
<div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:F.s}}>{icon} {title}</div>
{sub&&<div style={{fontSize:12,color:C.dim,marginTop:2}}>{sub}</div>}</div>);
const G=({children,cols=2,gap=10,style})=><div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap,...style}}>{children}</div>;
const Fx=({children,gap=14,style})=><div style={{display:"flex",flexWrap:"wrap",gap,...style}}>{children}</div>;
const TR=({cells,header,hl})=>(<tr style={{background:hl?C.accentBg:header?C.border+"44":"transparent"}}>
{cells.map((c,i)=>{const s=typeof c==="object"?c:{};const v=typeof c==="object"?c.v:c;return(header?<th key={i}style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:C.dim,textAlign:i===0?"left":"right",borderBottom:`1px solid ${C.border}33`,fontFamily:F.s}}>{v}</th>
:<td key={i} style={{padding:"6px 8px",fontSize:11,fontWeight:s.bold?700:400,color:s.color||C.text,textAlign:i===0?"left":"right",borderBottom:`1px solid ${C.border}22`,fontFamily:s.bold?F.m:F.s}}>{v}</td>)})}</tr>);
const Del=({onClick})=><button onClick={onClick} style={{padding:"4px 8px",borderRadius:4,border:`1px solid ${C.red}30`,background:"transparent",color:C.red,fontSize:10,cursor:"pointer"}}>✕</button>;
const AddBtn=({label,onClick})=><button onClick={onClick} style={{padding:"6px 14px",borderRadius:6,border:`1px dashed ${C.border}`,background:"transparent",color:C.accent,fontSize:11,cursor:"pointer",fontFamily:F.s,marginTop:6}}>{label}</button>;
const Pill=({label,active,color,onClick})=><button onClick={onClick} style={{padding:"4px 10px",borderRadius:5,border:`1px solid ${active?color||C.accent:C.border}`,background:active?(color||C.accent)+"18":"transparent",color:active?color||C.accent:C.dim,fontSize:10,fontWeight:active?700:400,cursor:"pointer",fontFamily:F.s,transition:"all .15s"}}>{label}</button>;

/* ══════════════════════════════════════════════════════════════════
   CLIENT FACTORY
   ══════════════════════════════════════════════════════════════════ */
const newClient=()=>({
  id:Date.now(),name:"New Client",created:new Date().toISOString().slice(0,10),
  serviceType:"comprehensive",status:"prospect",
  P:{name:"",dob:"15-06-1988",work:"Private Salaried",retireAge:60,lifeExpect:85,incGrowth:.07,email:"",phone:"",
     spouseName:"",spouseDob:"01-01-1990",spouseWork:"Homemaker",spouseRetireAge:60,spouseLifeExpect:85,spouseIncGrowth:.05,children:[]},
  A:{inflation:.06,debt:.08,equity:.14,retRet:.08,retInf:.06},
  inc:{salary:0,bonus:0,business:0,rental:0,invest:0,other:0},
  exp:{food:0,rent:0,conv:0,med:0,elec:0,mobile:0,clothes:0,shop:0,dine:0,travel:0,childEd:0,parentCont:0,childMaint:0,ott:0,otherExp:0},
  portfolio:{
    equity:{equityMF:0,directEquity:0,ulip:0},
    fixedIncome:{fixedDeposits:0,recurringDeposits:0,bonds:0,debtMF:0},
    retirement:{epf:0,nps:0,ppf:0},
    smallSavings:{nsc:0,ssy:0,kvp:0,scss:0,postOffice:0},
    cash:{savingsBank:0,cashInHand:0,emergency:0},
    commodities:{goldBars:0,goldCoins:0,jewellery:0},
    other:{},
    sips:{equityMF:{amt:0,freq:"monthly"},directEquity:{amt:0,freq:"monthly"},debtMF:{amt:0,freq:"monthly"},
          epf:{amt:0,freq:"monthly"},nps:{amt:0,freq:"monthly"},ppf:{amt:0,freq:"yearly"},
          recurringDeposits:{amt:0,freq:"monthly"}},
    /* Traditional Insurance / Endowment policies */
    tradIns:[]
  },
  property:{residential:0,vehicle:0,otherPersonal:0},
  liab:{homeLoan:{outstanding:0,emi:0,remaining:0},vehicleLoan:{outstanding:0,emi:0,remaining:0},personalLoan:{outstanding:0,emi:0,remaining:0}},
  lifePol:[],
  genPol:[{type:"Health",company:"",sumInsured:0,premium:0,freq:"yearly"},{type:"Motor",company:"",sumInsured:0,premium:0,freq:"yearly"},{type:"Critical Illness",company:"",sumInsured:0,premium:0,freq:"yearly"},{type:"Personal Accident",company:"",sumInsured:0,premium:0,freq:"yearly"}],
  riskAns:{},
  goals:[],
  retInc:{pension:0,rental:0,other:0},
  retExp:{postRetExpense:0,retInflation:0},
  /* Retirement mapped assets — keys from portfolio that reduce corpus required */
  retMappedAssets:["epf","nps","ppf"]
});

/* ══════════════════════════════════════════════════════════════════
   MAIN APPLICATION
   ══════════════════════════════════════════════════════════════════ */
export default function App(){
/* ── Data migration: ensure all clients have required fields ── */
const migrateClient=(c)=>{
  if(!c||typeof c!=="object")return c;
  const m={...c};
  if(!m.serviceType)m.serviceType="comprehensive";
  if(!m.status)m.status="prospect";
  if(m.P){m.P={...m.P};if(!m.P.email)m.P.email="";if(!m.P.phone)m.P.phone="";}
  if(!m.riskAns)m.riskAns={};
  if(!m.goals)m.goals=[];
  if(!m.retMappedAssets)m.retMappedAssets=["epf","nps","ppf"];
  if(!m.portfolio)m.portfolio={equity:{equityMF:0,directEquity:0,ulip:0},fixedIncome:{fixedDeposits:0,recurringDeposits:0,bonds:0,debtMF:0},retirement:{epf:0,nps:0,ppf:0},smallSavings:{nsc:0,ssy:0,kvp:0,scss:0,postOffice:0},cash:{savingsBank:0,cashInHand:0,emergency:0},commodities:{goldBars:0,goldCoins:0,jewellery:0},other:{},sips:{equityMF:{amt:0,freq:"monthly"},directEquity:{amt:0,freq:"monthly"},debtMF:{amt:0,freq:"monthly"},epf:{amt:0,freq:"monthly"},nps:{amt:0,freq:"monthly"},ppf:{amt:0,freq:"yearly"},recurringDeposits:{amt:0,freq:"monthly"}},tradIns:[]};
  if(!m.property)m.property={residential:0,vehicle:0,otherPersonal:0};
  if(!m.liab)m.liab={homeLoan:{outstanding:0,emi:0,remaining:0},vehicleLoan:{outstanding:0,emi:0,remaining:0},personalLoan:{outstanding:0,emi:0,remaining:0}};
  if(!m.lifePol)m.lifePol=[];
  if(!m.genPol)m.genPol=[{type:"Health",company:"",sumInsured:0,premium:0,freq:"yearly"},{type:"Motor",company:"",sumInsured:0,premium:0,freq:"yearly"},{type:"Critical Illness",company:"",sumInsured:0,premium:0,freq:"yearly"},{type:"Personal Accident",company:"",sumInsured:0,premium:0,freq:"yearly"}];
  if(!m.retInc)m.retInc={pension:0,rental:0,other:0};
  if(!m.retExp)m.retExp={postRetExpense:0,retInflation:0};
  if(!m.inc)m.inc={salary:0,bonus:0,business:0,rental:0,invest:0,other:0};
  if(!m.exp)m.exp={food:0,rent:0,conv:0,med:0,elec:0,mobile:0,clothes:0,shop:0,dine:0,travel:0,childEd:0,parentCont:0,childMaint:0,ott:0,otherExp:0};
  if(!m.A)m.A={inflation:.06,debt:.08,equity:.14,retRet:.08,retInf:.06};
  return m;
};
const [clients,setClients]=useState(()=>{try{const s=localStorage.getItem("fyg_clients");const d=s?JSON.parse(s):[];return Array.isArray(d)?d.map(migrateClient):[];}catch{return[];}});
const [activeId,setActiveId]=useState(null);
const [tab,setTab]=useState("registry");
const [sideOpen,setSide]=useState(true);
const [projView,setProjView]=useState("both");
/* Auto-save all client data whenever it changes */
useEffect(()=>{try{localStorage.setItem("fyg_clients",JSON.stringify(clients));}catch(e){console.warn("Save failed:",e);}},[clients]);
const cl=clients.find(c=>c.id===activeId);
const upd=fn=>setClients(p=>p.map(c=>c.id===activeId?fn(c):c));
const setP=v=>upd(c=>({...c,P:v}));const setA=v=>upd(c=>({...c,A:v}));
const setInc=v=>upd(c=>({...c,inc:v}));const setExp=v=>upd(c=>({...c,exp:v}));
const setPf=v=>upd(c=>({...c,portfolio:typeof v==="function"?v(c.portfolio):v}));
const setProp=v=>upd(c=>({...c,property:v}));
const setLiab=v=>upd(c=>({...c,liab:v}));
const setLP=v=>upd(c=>({...c,lifePol:v}));const setGP=v=>upd(c=>({...c,genPol:v}));
const setRA=v=>upd(c=>({...c,riskAns:v}));
const setGoals=v=>upd(c=>({...c,goals:typeof v==="function"?v(c.goals):v}));
const setRI=v=>upd(c=>({...c,retInc:v}));const setRE=v=>upd(c=>({...c,retExp:v}));
const d=newClient();
const P=cl?.P||d.P, A=cl?.A||d.A, inc_=cl?.inc||d.inc, exp_=cl?.exp||d.exp;
const pf=cl?.portfolio||d.portfolio, prop=cl?.property||d.property, li_=cl?.liab||d.liab;
const lp_=cl?.lifePol||[], gp_=cl?.genPol||d.genPol, ra_=cl?.riskAns||{};
const go_=cl?.goals||[], ri_=cl?.retInc||d.retInc, re_=cl?.retExp||d.retExp;
const retMap_=cl?.retMappedAssets||d.retMappedAssets;
const setRetMap=v=>upd(c=>({...c,retMappedAssets:v}));
const tradIns_=pf.tradIns||[];
const setTradIns=v=>setPf(p=>({...p,tradIns:v}));

/* ── Derived ages ── */
const selfAge=calcAge(P.dob), spAge=calcAge(P.spouseDob);
const selfWorking=["Private Salaried","Businessman","Government","Professional"].includes(P.work);
const spouseWorking=["Private Salaried","Businessman","Government","Professional"].includes(P.spouseWork);
const ytr=Math.max(0,P.retireAge-selfAge), rYrs=Math.max(0,P.lifeExpect-P.retireAge);
const curYr=new Date().getFullYear();

/* ══════════════════ 4. PORTFOLIO CALCULATIONS ══════════════════ */
const eqTotal=(pf.equity?.equityMF||0)+(pf.equity?.directEquity||0)+(pf.equity?.ulip||0);
const fiTotal=(pf.fixedIncome?.fixedDeposits||0)+(pf.fixedIncome?.recurringDeposits||0)+(pf.fixedIncome?.bonds||0)+(pf.fixedIncome?.debtMF||0);
const retAccts=(pf.retirement?.epf||0)+(pf.retirement?.nps||0)+(pf.retirement?.ppf||0);
const ssTotal=Object.values(pf.smallSavings||{}).reduce((s,v)=>s+(v||0),0);
const cashTotal=(pf.cash?.savingsBank||0)+(pf.cash?.cashInHand||0)+(pf.cash?.emergency||0);
const commodTotal=(pf.commodities?.goldBars||0)+(pf.commodities?.goldCoins||0)+(pf.commodities?.jewellery||0);
const otherTotal=Object.values(pf.other||{}).reduce((s,v)=>s+(typeof v==="number"?v:0),0);
const tradInsTotal=tradIns_.reduce((s,p)=>s+(p.currentValue||0),0);
const tradInsMaturity=tradIns_.reduce((s,p)=>{const mYrs=p.maturityDate?Math.max(0,parseInt(String(p.maturityDate).split("-").pop()||0)-curYr):0;return s+(p.maturityValue||calcFV(p.currentValue||0,.05,mYrs));},0);
const investA=eqTotal+fiTotal+retAccts+ssTotal+cashTotal+commodTotal+otherTotal+tradInsTotal;
const propTotal=Object.values(prop).reduce((s,v)=>s+(v||0),0);
const totA=investA+propTotal;
const totL=(li_.homeLoan?.outstanding||0)+(li_.vehicleLoan?.outstanding||0)+(li_.personalLoan?.outstanding||0);
const nw=totA-totL;

/* 6. Asset allocation for pie chart */
const allocData=useMemo(()=>[
  {name:"Equity",value:eqTotal},{name:"Fixed Income",value:fiTotal},{name:"Retirement",value:retAccts},
  {name:"Small Savings",value:ssTotal},{name:"Cash",value:cashTotal},{name:"Commodities",value:commodTotal},
  {name:"Trad Insurance",value:tradInsTotal},{name:"Other",value:otherTotal}].filter(d=>d.value>0),[eqTotal,fiTotal,retAccts,ssTotal,cashTotal,commodTotal,tradInsTotal,otherTotal]);

/* Monthly SIP contributions from portfolio */
const sipMo=useMemo(()=>{let t=0;Object.values(pf.sips||{}).forEach(s=>{t+=toMo(s?.amt||0,s?.freq||"monthly");});return t;},[pf.sips]);

/* ── Cash Flow ── */
const totI=Object.values(inc_).reduce((s,v)=>s+(v||0),0);
const loanE=(li_.homeLoan?.emi||0)+(li_.vehicleLoan?.emi||0)+(li_.personalLoan?.emi||0);
const lifePMo=lp_.reduce((s,p)=>s+toMo(p.premium||0,p.freq||"yearly"),0);
const genPMo=gp_.reduce((s,p)=>s+toMo(p.premium||0,p.freq||"yearly"),0);
const insP=lifePMo+genPMo;
const baseExp=Object.values(exp_).reduce((s,v)=>s+(v||0),0);
const totE=baseExp+loanE+insP;
const sav=totI-totE;
const surp=sav-sipMo;

/* ── Risk Profile ── */
const rScore=Object.values(ra_).reduce((s,v)=>s+v,0);
const rProf=RISK_P.find(p=>rScore>=p.min&&rScore<=p.max)||RISK_P[0];

/* ══════════════════ 2. NEED-BASED LIFE INSURANCE ══════════════════ */
const lifeInsAnalysis=useMemo(()=>{
  const liabilities=totL;
  const depAnnExp=(baseExp-((exp_.childEd||0)+(exp_.parentCont||0)))*12*0.75;
  const spouseRemYrs=Math.max(0,(P.lifeExpect||85)-(spAge||30));
  const netRetRate=((1+0.097)/(1+(A.inflation||.06)))-1;
  const depCorpus=netRetRate>0?depAnnExp*(1-Math.pow(1+netRetRate,-spouseRemYrs))/netRetRate:depAnnExp*spouseRemYrs;
  const goalFunding=go_.reduce((s,g)=>s+calcFV(g.pv||0,g.inf||A.inflation,g.yrs||1),0);
  const grossNeed=liabilities+depCorpus+goalFunding;
  const existingCover=lp_.reduce((s,p)=>s+(p.cover||0),0);
  const existingAssets=investA;
  const additional=Math.max(0,grossNeed-existingCover-existingAssets);
  return{liabilities,depCorpus,goalFunding,grossNeed,existingCover,existingAssets,additional,depAnnExp,spouseRemYrs};
},[totL,baseExp,exp_,spAge,P.lifeExpect,A.inflation,go_,lp_,investA]);

/* ── Dynamic owner options for goal dropdown ── */
const ownerOpts=useMemo(()=>{
  const opts=[{v:"self",l:P.name||"Self"},{v:"spouse",l:P.spouseName||"Spouse"}];
  (P.children||[]).forEach((ch,i)=>opts.push({v:`child_${i}`,l:ch.name||`Child ${i+1}`}));
  opts.push({v:"other",l:"Other"});
  return opts;
},[P.name,P.spouseName,P.children]);
/* Resolve owner DOB from ownerType */
const getOwnerDob=ot=>{if(ot==="self")return P.dob;if(ot==="spouse")return P.spouseDob;
  if(ot?.startsWith("child_")){const ci=parseInt(ot.split("_")[1]);return P.children?.[ci]?.dob||"";}return "";};
const getOwnerName=ot=>{const o=ownerOpts.find(x=>x.v===ot);return o?.l||"Self";};

/* ══════════════════ 7. GOAL PLANNING ENGINE with owner + asset funding ══════════════════ */
/* Helper: get portfolio asset value by key */
const getPfVal=key=>{for(const cat of ["equity","fixedIncome","retirement","smallSavings","cash","commodities"]){if(pf[cat]?.[key]!=null)return pf[cat][key]||0;}return 0;};

const gAn=useMemo(()=>go_.map(g=>{
  /* Owner resolution */
  const ownerDob=getOwnerDob(g.ownerType);
  const ownerAge=calcAge(ownerDob);
  const ownerName=getOwnerName(g.ownerType);
  /* Years: if targetAge set and owner has DOB, auto-calc */
  const y=g.targetAge&&ownerAge>0?Math.max(1,g.targetAge-ownerAge):Math.max(1,g.yrs||1);
  const ageAtGoal=ownerAge>0?ownerAge+y:(calcAge(P.dob)+y);
  const inf=g.inf||A.inflation;
  const fv=calcFV(g.pv||0,inf,y);
  const ret=y>10?A.equity:y>5?(A.equity+A.debt)/2:A.debt;
  /* Asset-to-goal funding: sum FV of mapped assets — proportional if shared */
  const fa=g.fundingAssets||[];
  let assetFunded=0;const fundingSrc=[];
  /* Count claims per asset across ALL goals for proportional split */
  const claimCt={};go_.forEach(gg=>{(gg.fundingAssets||[]).forEach(k=>{claimCt[k]=(claimCt[k]||0)+1;});});
  fa.forEach(key=>{const cv=getPfVal(key);if(cv>0){const share=cv/(claimCt[key]||1);const meta=PF_ASSETS.find(a=>a.key===key);const assetRet=meta?.ret||ret;const afv=calcFV(share,assetRet,y);assetFunded+=afv;fundingSrc.push({key,label:meta?.label||key,cv:share,fv:afv,shared:claimCt[key]>1});}});
  const existingGrown=calcFV(g.existing||0,ret,y);
  const totalFunded=assetFunded+existingGrown;
  const gap=Math.max(0,fv-totalFunded);
  const sip=calcSIP(gap,ret,y);
  const stepRate=g.stepUp||0;
  const stepSIP=calcStepUpSIP(gap,ret,y,stepRate);
  return{...g,fv,ret,existingGrown,assetFunded,totalFunded,gap,sip,stepSIP,stepRate,ageAt:ageAtGoal,yrsCalc:y,ownerAge,ownerName,ownerDob,fundingSrc};
}),[go_,A,P,pf]);
const totGoalSIP=gAn.reduce((s,g)=>s+(g.stepRate>0?g.stepSIP:g.sip),0);

/* Step 7: Asset allocation tracker — FIX 4: cap allocation per asset, warn over-allocation */
const assetAllocTracker=useMemo(()=>{
  const tracker={};
  PF_ASSETS.forEach(a=>{const cv=getPfVal(a.key);if(cv>0)tracker[a.key]={label:a.label,total:cv,allocated:0,goals:[],overAllocated:false};});
  /* Count how many goals claim each asset */
  const claimCount={};
  go_.forEach(g=>{(g.fundingAssets||[]).forEach(key=>{claimCount[key]=(claimCount[key]||0)+1;});});
  /* Allocate: split proportionally if shared, cap at total value */
  go_.forEach(g=>{(g.fundingAssets||[]).forEach(key=>{if(tracker[key]){
    const share=tracker[key].total/(claimCount[key]||1);
    tracker[key].allocated+=share;
    tracker[key].goals.push(g.name);
    if(tracker[key].allocated>tracker[key].total*1.001){tracker[key].overAllocated=true;tracker[key].allocated=tracker[key].total;}
  }});});
  return tracker;
},[go_,pf]);

/* ══════════════════ 8. RETIREMENT PLANNING ENGINE ══════════════════ */
const retME=Object.entries(exp_).filter(([k])=>!["childEd","parentCont","childMaint"].includes(k)).reduce((s,[,v])=>s+(v||0),0);
const retExpBase=(re_.postRetExpense||0)>0?re_.postRetExpense:retME;
const retInflation=(re_.retInflation||0)>0?re_.retInflation:A.retInf;
const retEF=calcFV(retExpBase*12,A.inflation,ytr);
const retAI=((ri_.pension||0)+(ri_.rental||0)+(ri_.other||0))*12;
const retNN=Math.max(0,retEF-retAI);
const retNR=((1+A.retRet)/(1+retInflation))-1;
const retCorpusGross=retNR>0?retNN*(1-Math.pow(1+retNR,-rYrs))/retNR:retNN*rYrs;
/* Mapped retirement assets — their FV at retirement reduces corpus required */
const retMappedFV=useMemo(()=>{
  let total=0;const items=[];
  const assetMap={epf:{val:pf.retirement?.epf||0,ret:.081,label:"EPF"},nps:{val:pf.retirement?.nps||0,ret:.10,label:"NPS"},ppf:{val:pf.retirement?.ppf||0,ret:.071,label:"PPF"},savingsBank:{val:pf.cash?.savingsBank||0,ret:.04,label:"Savings Bank"},cashInHand:{val:pf.cash?.cashInHand||0,ret:0,label:"Cash in Hand"},emergency:{val:pf.cash?.emergency||0,ret:.04,label:"Emergency Fund"}};
  /* Add tradIns maturity values */
  tradIns_.forEach(t=>{if(t.currentValue>0){const mYrs=t.maturityDate?Math.max(0,parseInt(String(t.maturityDate).split("-").pop()||curYr)-curYr):ytr;const fv=t.maturityValue||calcFV(t.currentValue,.05,mYrs);assetMap[`trad_${t.planName||"endowment"}`]={val:t.currentValue,ret:.05,label:t.planName||"Endowment",fvOverride:fv};}});
  (retMap_||[]).forEach(k=>{const a=assetMap[k];if(a&&a.val>0){const fv=a.fvOverride||calcFV(a.val,a.ret,ytr);total+=fv;items.push({key:k,label:a.label,cv:a.val,fv,ret:a.ret});}});
  return{total,items};
},[pf,retMap_,ytr,tradIns_,curYr]);
const retCorpus=Math.max(0,retCorpusGross-retMappedFV.total);
/* Retirement funded = remaining investA (excl mapped) grown to retirement */
const retFunded=useMemo(()=>{
  const mappedCV=(retMappedFV.items||[]).reduce((s,i)=>s+i.cv,0);
  const unmappedInvest=Math.max(0,investA-mappedCV);
  const weightedSum=A.equity*(eqTotal)+A.debt*(fiTotal+Math.max(0,retAccts-mappedCV)+ssTotal)+0.04*Math.max(0,cashTotal)+0.09*commodTotal;
  const avgRet=safeAvgRet(weightedSum,unmappedInvest)||A.debt;
  /* FIX 2: Use calcSIPFV for monthly compounding instead of annual */
  return calcFV(unmappedInvest,avgRet,ytr)+calcSIPFV(sipMo,avgRet,ytr);
},[investA,eqTotal,fiTotal,retAccts,ssTotal,cashTotal,commodTotal,A,ytr,sipMo,retMappedFV]);
const retGap=Math.max(0,retCorpus-retFunded);
const retSIP=calcSIP(retGap,ytr>10?A.equity:(A.equity+A.debt)/2,ytr);
const [retStepUp,setRetStepUp]=useState(.10);
const [sipCalc,setSipCalc]=useState({monthly:10000,rate:.12,stepUp:.10,years:15});
const [lsCalc,setLsCalc]=useState({amount:100000,rate:.12,years:10});
const [goalCalc,setGoalCalc]=useState({cost:2000000,inf:.08,years:15,existing:0,ret:.12,stepUp:.10});
const retStepSIP=calcStepUpSIP(retGap,ytr>10?A.equity:(A.equity+A.debt)/2,ytr,retStepUp);

/* Retirement Scenario Engine: what-if for early/late retirement */
const retScenarios=useMemo(()=>{
  const offsets=[-5,-3,-2,0,2,3,5];
  return offsets.map(off=>{
    const rAge=P.retireAge+off;
    const yToR=Math.max(1,rAge-selfAge);
    const rY=Math.max(0,P.lifeExpect-rAge);
    if(rY<=0||yToR<=0)return null;
    const ef=calcFV(retExpBase*12,A.inflation,yToR);
    const ai=retAI;
    const nn=Math.max(0,ef-ai);
    const nr=((1+A.retRet)/(1+retInflation))-1;
    const corpus=nr>0?nn*(1-Math.pow(1+nr,-rY))/nr:nn*rY;
    const avgRet=safeAvgRet(A.equity*eqTotal+A.debt*(fiTotal+retAccts+ssTotal)+0.04*cashTotal+0.09*commodTotal,investA)||A.debt;
    const funded=calcFV(investA,avgRet,yToR)+calcSIPFV(sipMo,avgRet,yToR);
    const gap=Math.max(0,corpus-funded);
    const sip=calcSIP(gap,yToR>10?A.equity:(A.equity+A.debt)/2,yToR);
    return{offset:off,retireAge:rAge,yrsToRetire:yToR,retYrs:rY,corpus:Math.round(corpus),funded:Math.round(funded),gap:Math.round(gap),sip:Math.round(sip)};
  }).filter(Boolean);
},[P.retireAge,P.lifeExpect,selfAge,retExpBase,A,retAI,retInflation,investA,eqTotal,fiTotal,retAccts,ssTotal,cashTotal,commodTotal,sipMo]);

/* ══════════════════ MONTE CARLO: RETIREMENT ══════════════════ */
const [mcSims,setMcSims]=useState(1000);
const retMC=useMemo(()=>{
  if(!investA&&!sipMo)return null;
  const mappedCV=(retMappedFV.items||[]).reduce((s,i)=>s+i.cv,0);
  const unmapped=Math.max(0,investA-mappedCV);
  const avgRet=safeAvgRet(A.equity*eqTotal+A.debt*(fiTotal+retAccts+ssTotal)+0.04*cashTotal+0.09*commodTotal,investA)||A.debt;
  const vol=avgRet>0.10?0.18:avgRet>0.06?0.12:0.06;
  const mc=runMonteCarlo({initialPortfolio:unmapped,monthlySIP:sipMo,years:ytr,meanReturn:avgRet,volatility:vol,simulations:mcSims,inflationMean:A.inflation,inflationStd:.015,fatTailProb:.05});
  const successCount=Array.from(mc.results).filter(v=>v>=retCorpus).length;
  return{...mc,successRate:Math.round(successCount/mc.results.length*100),target:retCorpus};
},[investA,sipMo,ytr,A,eqTotal,fiTotal,retAccts,ssTotal,cashTotal,commodTotal,retCorpus,retMappedFV,mcSims]);

/* ══════════════════ MONTE CARLO: GOALS ══════════════════ */
const goalMC=useMemo(()=>gAn.map(g=>{
  if(!g.fv||g.fv<=0||!g.yrsCalc)return{...g,mcProb:0,mcMedian:0};
  const ret=g.ret||A.equity;
  const vol=ret>0.10?0.18:ret>0.06?0.12:0.06;
  const monthlyInvest=(g.stepRate>0?g.stepSIP:g.sip)||0;
  const mc=runGoalMC({existing:g.totalFunded||g.existingGrown||0,monthlySIP:monthlyInvest,years:g.yrsCalc,targetFV:g.fv,meanReturn:ret,volatility:vol,simulations:500});
  return{...g,mcProb:mc.prob,mcMedian:mc.median,mcBest:mc.best,mcWorst:mc.worst};
}),[gAn,A]);

/* ══════════════════ 10. PROJECTION ENGINE ══════════════════ */
const cfProj=useMemo(()=>{
  const rows=[];const bI=totI*12,bE=(baseExp)*12;
  const avgRet=(A.equity+A.debt)/2;let cum=investA;
  for(let y=0;y<=P.lifeExpect-selfAge;y++){
    const ay=selfAge+y,yr=curYr+y,isRet=ay>=P.retireAge;
    const incY=isRet?retAI:bI*Math.pow(1+P.incGrowth,y);
    const expY=isRet?retEF*Math.pow(1+retInflation,Math.max(0,ay-P.retireAge)):bE*Math.pow(1+A.inflation,y);
    const emiY=y*12<Math.max(li_.homeLoan?.remaining||0,li_.vehicleLoan?.remaining||0,li_.personalLoan?.remaining||0)?loanE*12:0;
    const insY=isRet?0:insP*12;
    const invY=isRet?0:sipMo*12;
    const surpY=incY-expY-emiY-insY-invY;
    cum=cum*(1+avgRet)+(surpY>0?surpY:0);
    if(isRet&&surpY<0)cum=Math.max(0,cum+surpY);
    rows.push({year:yr,age:ay,income:Math.round(incY),expenses:Math.round(expY),emi:Math.round(emiY),insurance:Math.round(insY),investments:Math.round(invY),surplus:Math.round(surpY),netWorth:Math.round(cum)});
  }return rows;
},[totI,baseExp,loanE,insP,sipMo,investA,selfAge,P,A,retAI,retEF,retInflation,curYr,li_]);

/* Retirement corpus depletion */
const retDepletion=useMemo(()=>{let c=retCorpus;const rows=[];for(let y=0;y<rYrs&&c>0;y++){
  const gr=c*A.retRet,ex=retEF*Math.pow(1+retInflation,y),ic=retAI*Math.pow(1+retInflation*.5,y);
  c=c+gr-(ex-ic);rows.push({age:P.retireAge+y,corpus:Math.max(0,Math.round(c)),expense:Math.round(ex),income:Math.round(ic)});
  if(c<=0)break;}return rows;},[retCorpus,rYrs,P.retireAge,A.retRet,retEF,retAI,retInflation]);

/* ══════════════════ MILESTONE DATA for cash flow chart ══════════════════ */
const milestones=useMemo(()=>{
  const ms=[];
  gAn.forEach(g=>{if(g.ageAt>0)ms.push({age:g.ageAt,name:g.name,fv:g.fv,color:g.priority==="High"?C.red:g.priority==="Medium"?C.orange:C.blue,priority:g.priority});});
  ms.push({age:P.retireAge,name:"Retirement",fv:retCorpus,color:C.purple,priority:"Milestone"});
  ms.push({age:P.lifeExpect,name:"Life Expectancy",fv:0,color:C.dim,priority:"End"});
  return ms.sort((a,b)=>a.age-b.age);
},[gAn,P.retireAge,P.lifeExpect,retCorpus]);

/* ══════════════════ 4. FINANCIAL HEALTH THUMB RULES ══════════════════ */
const finHealth=useMemo(()=>{
  const eme=cashTotal;const emeNeed=baseExp*6;const emeRatio=emeNeed>0?eme/emeNeed:0;
  const savRatio=totI>0?sav/totI:0;
  const insCover=lp_.reduce((s,p)=>s+(p.cover||0),0);const insNeed=totI*12*10;const insRatio=insNeed>0?insCover/insNeed:0;
  const dtiRatio=totI>0?(loanE+insP)/totI:0;
  const retSavRatio=totI>0?sipMo/totI:0;
  const st=(v,g,y)=>v>=g?"green":v>=y?"yellow":"red";
  return[
    {label:"Emergency Fund",value:fmt(eme),target:`${fmt(emeNeed)} (6mo exp)`,ratio:emeRatio,status:st(emeRatio,1,.5),icon:"🆘",tip:"Keep 6 months expenses in liquid assets"},
    {label:"Savings Ratio",value:pct(savRatio),target:"≥ 20%",ratio:savRatio,status:st(savRatio,.20,.10),icon:"💰",tip:"Save at least 20% of monthly income"},
    {label:"Insurance Cover",value:fmt(insCover),target:`${fmt(insNeed)} (10× income)`,ratio:insRatio,status:st(insRatio,1,.5),icon:"🛡️",tip:"Life cover should be 10–15× annual income"},
    {label:"Debt-to-Income",value:pct(dtiRatio),target:"< 40%",ratio:1-dtiRatio,status:st(1-dtiRatio,.6,.4),icon:"💳",tip:"EMI + insurance < 40% of income"},
    {label:"Retirement Savings",value:pct(retSavRatio),target:"≥ 15%",ratio:retSavRatio,status:st(retSavRatio,.15,.08),icon:"🏖️",tip:"Invest at least 15% income for retirement"},
    {label:"Net Worth / Income",value:`${(nw/(totI*12||1)).toFixed(1)}×`,target:"≥ Age/10 × Income",ratio:Math.min(1,(nw/(totI*12||1))/(selfAge/10||1)),status:st(nw/(totI*12||1),selfAge/10,selfAge/20),icon:"📊",tip:"Net worth should be Age/10 × annual income"}
  ];
},[cashTotal,baseExp,totI,sav,lp_,loanE,insP,sipMo,nw,selfAge]);

/* ══════════════════ SWP + HomeLoan states ══════════════════ */
const [swpCalc,setSwpCalc]=useState({corpus:10000000,withdrawal:50000,retRate:.08,infRate:.06,years:25});
const [hlCalc,setHlCalc]=useState({price:10000000,down:20,rate:.085,tenure:20,sipReturn:.12});
const [riskHistory,setRiskHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem("fyg_risk_history")||"[]")}catch{return[]}});
const [reportEmail,setReportEmail]=useState("");
const [riskShowResult,setRiskShowResult]=useState(false);
const [riskEmailSent,setRiskEmailSent]=useState(false);
const [riskSending,setRiskSending]=useState(false);
const [riskLinkCopied,setRiskLinkCopied]=useState(false);
const [riskLinkEmail,setRiskLinkEmail]=useState("");

/* ══════════════════ NAV TABS ══════════════════ */
const tabs=activeId?[
  {id:"dashboard",i:"📊",l:"Dashboard"},{id:"data",i:"📋",l:"Data & Cash Flow"},
  {id:"portfolio",i:"💼",l:"Portfolio"},{id:"insurance",i:"🛡️",l:"Insurance"},
  {id:"goals",i:"🎯",l:"Goals"},
  {id:"retirement",i:"🏖️",l:"Retirement"},{id:"projections",i:"📈",l:"Projections"},
  {id:"health",i:"💚",l:"Financial Health"},{id:"calculators",i:"🧮",l:"Calculators"},
  {id:"present",i:"🎬",l:"Presentation"}
]:[];

/* ══════════════════════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════════════════════ */
return(<div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:F.s,color:C.text}}>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

{/* ════ SIDEBAR ════ */}
<div style={{width:sideOpen?210:50,background:C.card,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",transition:"width .2s",flexShrink:0,overflow:"hidden"}}>
<div style={{padding:sideOpen?"14px 12px":"14px 8px",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>setSide(!sideOpen)}>
<div style={{fontSize:sideOpen?15:11,fontWeight:900,color:C.accent,whiteSpace:"nowrap"}}>{sideOpen?"Fund Your Goals":"FYG"}</div></div>
<div style={{padding:"6px 4px",borderBottom:`1px solid ${C.border}`}}>
<button onClick={()=>{setActiveId(null);setTab("registry");}} style={{width:"100%",padding:sideOpen?"6px 8px":"6px 0",borderRadius:5,border:"none",background:tab==="registry"?C.accentBg:"transparent",color:tab==="registry"?C.accent:C.dim,fontSize:10,fontWeight:600,cursor:"pointer",textAlign:sideOpen?"left":"center",fontFamily:F.s}}>
{sideOpen?"📁 Client Registry":"📁"}</button></div>
{activeId&&<div style={{flex:1,overflowY:"auto",padding:"6px 4px"}}>
{sideOpen&&<div style={{fontSize:9,color:C.dim,padding:"4px 8px",textTransform:"uppercase",letterSpacing:".5px"}}>{P.name||cl?.name||"Client"}</div>}
{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{width:"100%",padding:sideOpen?"6px 8px":"6px 0",borderRadius:5,border:"none",background:tab===t.id?C.accentBg:"transparent",color:tab===t.id?C.accent:C.dim,fontSize:10,fontWeight:tab===t.id?700:400,cursor:"pointer",textAlign:sideOpen?"left":"center",display:"flex",alignItems:"center",gap:5,marginBottom:1,fontFamily:F.s}}>
<span style={{fontSize:12}}>{t.i}</span>{sideOpen&&t.l}
</button>))}</div>}</div>

{/* ════ MAIN ════ */}
<div style={{flex:1,overflowY:"auto",padding:24,maxHeight:"100vh"}}>

{/* ──── REGISTRY ──── */}
{tab==="registry"&&<div>
<SH icon="📁" title="Client Registry" sub="One registry → many workspaces"/>
<div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
<button onClick={()=>{const nc=newClient();nc.serviceType="comprehensive";setClients(p=>[...p,nc]);setActiveId(nc.id);setTab("data");}}
style={{padding:"10px 24px",borderRadius:8,border:`1px solid ${C.accent}`,background:C.accentBg,color:C.accent,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F.s}}>+ New Client</button>
<button onClick={()=>{const b=new Blob([JSON.stringify(clients,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`fyg-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(u);}}
style={{padding:"10px 16px",borderRadius:8,border:`1px solid ${C.green}50`,background:"transparent",color:C.green,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F.s}}>📥 Export</button>
<label style={{padding:"10px 16px",borderRadius:8,border:`1px solid ${C.blue}50`,background:"transparent",color:C.blue,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F.s}}>📤 Import
<input type="file" accept=".json" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(Array.isArray(d)){setClients(d);alert(`Imported ${d.length} client(s) successfully.`);}else{alert("Invalid file — expected client array.");}}catch{alert("Could not read file.");}};r.readAsText(f);e.target.value="";}}/></label>
</div>
<div style={{fontSize:9,color:C.dim,marginBottom:12}}>💾 Data auto-saves to this browser. Use Export to keep a backup file.</div>
{clients.length>0?<G cols={3}>{clients.map(c=>{
  const st=c.status||"prospect";
  const svc=c.serviceType||"comprehensive";
  const stColors={prospect:C.blue,risk_profiled:C.orange,active:C.accent,plan_delivered:C.green,closed:C.dim};
  const stLabels={prospect:"Prospect",risk_profiled:"Risk Profiled",active:"Active Client",plan_delivered:"Plan Delivered",closed:"Closed"};
  const svcLabels={comprehensive:"📊 Comprehensive",riskonly:"🎯 Risk Only"};
  const rAnswered=Object.keys(c.riskAns||{}).length;
  return(<div key={c.id} onClick={()=>{setActiveId(c.id);setTab("dashboard");}} style={{background:activeId===c.id?C.accentBg:C.card,border:`1px solid ${activeId===c.id?C.accent:C.border}`,borderRadius:10,padding:14,cursor:"pointer",transition:"all .2s"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
<div style={{fontSize:14,fontWeight:700}}>{c.P?.name||c.name}</div>
<Del onClick={e=>{e.stopPropagation();setClients(p=>p.filter(x=>x.id!==c.id));if(activeId===c.id){setActiveId(null);setTab("registry");}}} /></div>
<div style={{fontSize:10,color:C.dim}}>Age {calcAge(c.P?.dob)} • {c.created}</div>
<div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
<span style={{padding:"2px 8px",borderRadius:4,fontSize:8,fontWeight:700,background:(stColors[st]||C.dim)+"18",color:stColors[st]||C.dim,border:`1px solid ${(stColors[st]||C.dim)}30`}}>{stLabels[st]||st}</span>
<span style={{padding:"2px 8px",borderRadius:4,fontSize:8,fontWeight:600,background:C.card,color:C.dim,border:`1px solid ${C.border}`}}>{svcLabels[svc]||svc}</span>
{rAnswered===10&&<span style={{padding:"2px 8px",borderRadius:4,fontSize:8,fontWeight:600,background:C.green+"18",color:C.green,border:`1px solid ${C.green}30`}}>✓ Risk Done</span>}
</div>
{/* Status dropdown — click to change */}
<select value={st} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();setClients(p=>p.map(x=>x.id===c.id?{...x,status:e.target.value}:x))}}
style={{marginTop:8,width:"100%",padding:"4px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.bg,color:C.dim,fontSize:9,fontFamily:F.s,cursor:"pointer",outline:"none"}}>
{Object.entries(stLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
</select>
</div>)})}</G>:<div style={{textAlign:"center",padding:40,color:C.dim}}>No clients yet. Create a Comprehensive Plan or Risk Profile Only client.</div>}
</div>}

{/* ──── 12. DASHBOARD ──── */}
{tab==="dashboard"&&cl&&<div>
<SH icon="📊" title={P.name||cl.name} sub="Financial Planning Dashboard"/>
<Fx><St label="Net Worth" value={fmt(nw)} color={nw>=0?C.green:C.red}/><St label="Monthly Income" value={fmt(totI)} color={C.green}/><St label="Monthly Surplus" value={fmt(surp)} color={surp>=0?C.green:C.red}/><St label="Risk Profile" value={Object.keys(ra_).length===10?rProf.n:"Not Assessed"} color={Object.keys(ra_).length===10?(rProf.color||C.accent):C.dim}/><St label="Goal SIPs" value={fmt(totGoalSIP)} color={C.blue}/><St label="Retire Gap" value={fmt(retGap)} color={retGap>0?C.red:C.green}/></Fx>
<G cols={3} style={{marginTop:16}}>
<Cd title="Cash Flow" accent={C.green}>{[["Income",fmt(totI),C.green],["Expenses",fmt(totE),C.red],["Savings",fmt(sav),C.accent],["SIP Investments",fmt(sipMo),C.blue],["Surplus",fmt(surp),surp>=0?C.green:C.red]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.border}22`}}><span style={{fontSize:11,color:C.dim}}>{l}</span><span style={{fontSize:11,fontWeight:700,color:c,fontFamily:F.m}}>{v}</span></div>)}</Cd>
<Cd title="Insurance Gap" accent={C.cyan}>{[["Gross Need",fmt(lifeInsAnalysis.grossNeed),C.orange],["Existing Cover",fmt(lifeInsAnalysis.existingCover),C.green],["Existing Assets",fmt(lifeInsAnalysis.existingAssets),C.blue],["Additional Required",fmt(lifeInsAnalysis.additional),lifeInsAnalysis.additional>0?C.red:C.green]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.border}22`}}><span style={{fontSize:11,color:C.dim}}>{l}</span><span style={{fontSize:11,fontWeight:700,color:c,fontFamily:F.m}}>{v}</span></div>)}</Cd>
<Cd title="Asset Allocation" accent={C.purple}>{allocData.length>0?<ResponsiveContainer width="100%" height={160}>
<PieChart><Pie data={allocData} cx="50%" cy="50%" outerRadius={60} innerRadius={30} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
{allocData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip content={<ChTip/>}/></PieChart></ResponsiveContainer>
:<div style={{textAlign:"center",padding:20,color:C.dim,fontSize:11}}>Add portfolio assets</div>}</Cd>
</G>
{/* Mini charts */}
{cfProj.length>1&&<G cols={2} style={{marginTop:12}}>
<Cd title="Net Worth Projection" accent={C.green}><ResponsiveContainer width="100%" height={130}>
<AreaChart data={cfProj.filter((_,i)=>i%3===0)}><defs><linearGradient id="nwG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
<XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip content={<ChTip/>}/>
<Area type="monotone" dataKey="netWorth" stroke={C.green} fill="url(#nwG)" name="Net Worth"/></AreaChart></ResponsiveContainer></Cd>
<Cd title="Income vs Expenses" accent={C.blue}><ResponsiveContainer width="100%" height={130}>
<LineChart data={cfProj.filter((_,i)=>i%3===0)}>
<XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip content={<ChTip/>}/>
<Line type="monotone" dataKey="income" stroke={C.green} dot={false} strokeWidth={1.5} name="Income"/>
<Line type="monotone" dataKey="expenses" stroke={C.red} dot={false} strokeWidth={1.5} name="Expenses"/>
</LineChart></ResponsiveContainer></Cd>
</G>}
{/* 2. Goal Commitment Summary */}
<Cd title="🎯 Goal Commitment" accent={C.accent} style={{marginTop:12}}>
<G cols={4}>
<St label="Current SIPs" value={fmt(sipMo)} color={C.blue} sub="Portfolio SIPs"/>
<St label="Required SIPs" value={fmt(totGoalSIP+retSIP)} color={C.orange} sub="Goals + Retirement"/>
<St label="SIP Gap" value={fmt(Math.max(0,(totGoalSIP+retSIP)-sipMo))} color={(totGoalSIP+retSIP)>sipMo?C.red:C.green}/>
<St label="Surplus After Goals" value={fmt(surp-totGoalSIP)} color={(surp-totGoalSIP)>=0?C.green:C.red}/>
</G>
{(totGoalSIP+retSIP)>0&&<div style={{marginTop:8,height:8,borderRadius:4,background:C.bg,overflow:"hidden"}}>
<div style={{height:"100%",borderRadius:4,background:`linear-gradient(90deg, ${C.green} ${Math.min(100,sipMo/(totGoalSIP+retSIP)*100)}%, ${C.accent} ${Math.min(100,sipMo/(totGoalSIP+retSIP)*100)}%)`,width:`${Math.min(100,Math.max(sipMo/(totGoalSIP+retSIP)*100,5))}%`,transition:"width .3s"}}/>
</div>}
<div style={{fontSize:9,color:C.dim,marginTop:4}}>{sipMo>=(totGoalSIP+retSIP)?"✓ Current SIPs cover all goals and retirement":"⚠ Additional "+fmt((totGoalSIP+retSIP)-sipMo)+"/mo needed"}</div>
</Cd>
</div>}

{/* ──── DATA & CASH FLOW ──── */}
{tab==="data"&&cl&&<div>
<SH icon="📋" title="Data & Cash Flow" sub="Personal info, income & expenses"/>
<G><Cd title="👤 Self" accent={C.accent}>
<Inp label="Full Name" value={P.name} onChange={v=>setP({...P,name:v})} type="text"/>
<G><Inp label="Email" value={P.email||""} onChange={v=>setP({...P,email:v})} type="text" placeholder="client@email.com"/>
<Inp label="Phone" value={P.phone||""} onChange={v=>setP({...P,phone:v})} type="text" placeholder="+91 XXXXX XXXXX"/></G>
<G><DOBInp label="DOB (DD-MM-YYYY)" value={P.dob} onChange={v=>setP({...P,dob:v})}/>
<Inp label="Age" value={calcAgeDetail(P.dob)} disabled type="text" suffix="" hint={`Born: ${P.dob}`}/></G>
<Sel label="Work Status" value={P.work} onChange={v=>setP({...P,work:v})} options={["Private Salaried","Businessman","Government","Professional","Retired","Homemaker"]}/>
{selfWorking&&<G><Inp label="Retire Age" value={P.retireAge} onChange={v=>setP({...P,retireAge:v})} suffix="yrs"/><Inp label="Income Growth" value={rr(P.incGrowth)} onChange={v=>setP({...P,incGrowth:v/100})} suffix="%"/></G>}
<Inp label="Life Expectancy" value={P.lifeExpect} onChange={v=>setP({...P,lifeExpect:v})} suffix="yrs"/>
{!selfWorking&&P.work==="Retired"&&<div style={{fontSize:9,color:C.dim,marginTop:4}}>Retired — only life expectancy applies</div>}
</Cd>
<Cd title="💍 Spouse" accent={C.purple}>
<Inp label="Name" value={P.spouseName||""} onChange={v=>setP({...P,spouseName:v})} type="text"/>
<G><DOBInp label="DOB (DD-MM-YYYY)" value={P.spouseDob} onChange={v=>setP({...P,spouseDob:v})}/>
<Inp label="Age" value={calcAgeDetail(P.spouseDob)} disabled type="text" hint={`Born: ${P.spouseDob||"—"}`}/></G>
<Sel label="Work Status" value={P.spouseWork||"Homemaker"} onChange={v=>setP({...P,spouseWork:v})} options={["Private Salaried","Businessman","Government","Professional","Retired","Homemaker","NA"]}/>
{spouseWorking&&<G><Inp label="Retire Age" value={P.spouseRetireAge||60} onChange={v=>setP({...P,spouseRetireAge:v})} suffix="yrs"/><Inp label="Income Growth" value={rr(P.spouseIncGrowth||.05)} onChange={v=>setP({...P,spouseIncGrowth:v/100})} suffix="%"/></G>}
<Inp label="Life Expectancy" value={P.spouseLifeExpect||85} onChange={v=>setP({...P,spouseLifeExpect:v})} suffix="yrs"/>
{!spouseWorking&&P.spouseWork!=="NA"&&<div style={{fontSize:9,color:C.dim,marginTop:4}}>{P.spouseWork==="Retired"?"Retired":"Homemaker"} — retire age & income growth not applicable</div>}
</Cd></G>
<Cd title="👶 Children" accent={C.green} style={{marginTop:10}}>
{(P.children||[]).map((ch,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:6}}>
<Inp label="Name" value={ch.name} onChange={v=>{const c=[...P.children];c[i]={...c[i],name:v};setP({...P,children:c});}} type="text" w="140px"/>
<DOBInp label="DOB" value={ch.dob} onChange={v=>{const c=[...P.children];c[i]={...c[i],dob:v};setP({...P,children:c});}} w="140px"/>
<Inp label="Age" value={calcAgeDetail(ch.dob)} disabled w="70px" type="text"/>
<Del onClick={()=>setP({...P,children:P.children.filter((_,j)=>j!==i)})}/>
</div>)}<AddBtn label="+ Child" onClick={()=>setP({...P,children:[...(P.children||[]),{name:"",dob:"01-01-2022"}]})}/>
</Cd>
<G style={{marginTop:10}}>
<Cd title="💰 Monthly Income" accent={C.green}>
{[["Salary","salary"],["Bonus","bonus"],["Business","business"],["Rental","rental"],["Investment","invest"],["Other","other"]].map(([l,k])=><Inp key={k} label={l} value={inc_[k]||0} onChange={v=>setInc({...inc_,[k]:v})} prefix="₹"/>)}
<div style={{marginTop:6,fontSize:12,fontWeight:700,color:C.green}}>Total: {fmt(totI)}</div>
</Cd>
<div><Cd title="🏠 Expenses" accent={C.orange}>
<G cols={3}>{[["Food","food"],["Rent/EMI","rent"],["Transport","conv"],["Medical","med"],["Utilities","elec"],["Mobile/Net","mobile"],["Clothes","clothes"],["Shopping","shop"],["Dining","dine"],["Travel","travel"],["Child Education","childEd"],["Parents/Siblings","parentCont"],["Child Maintenance","childMaint"],["OTT/Subscriptions","ott"],["Other","otherExp"]].map(([l,k])=><Inp key={k} label={l} value={exp_[k]||0} onChange={v=>setExp({...exp_,[k]:v})} prefix="₹"/>)}</G>
</Cd>
<Cd title="🛡️ Insurance Premiums (auto)" accent={C.cyan} style={{marginTop:8}}>
<div style={{fontSize:9,color:C.dim,marginBottom:4}}>Auto-derived from Insurance tab.</div>
<div style={{fontSize:12,fontWeight:700,color:C.cyan}}>Total: {fmt(insP)}/mo ({fmt(insP*12)}/yr)</div>
</Cd>
<Cd title="💳 EMIs (from liabilities)" accent={C.red} style={{marginTop:8}}>
<G cols={3}><Inp label="Home" value={li_.homeLoan?.emi||0} disabled prefix="₹"/><Inp label="Vehicle" value={li_.vehicleLoan?.emi||0} disabled prefix="₹"/><Inp label="Personal" value={li_.personalLoan?.emi||0} disabled prefix="₹"/></G>
</Cd></div></G>
<Cd style={{marginTop:10}} accent={surp>=0?C.green:C.red}>
<Fx><St label="Income" value={fmt(totI)} color={C.green}/><St label="Expenses" value={fmt(totE)} color={C.red}/><St label="Savings" value={fmt(sav)} color={C.accent}/><St label="SIP Invest" value={fmt(sipMo)} color={C.blue}/><St label="Surplus" value={fmt(surp)} color={surp>=0?C.green:C.red}/></Fx>
</Cd></div>}

{/* ──── 4. PORTFOLIO MODULE ──── */}
{tab==="portfolio"&&cl&&<div>
<SH icon="💼" title="Portfolio" sub="Complete asset view — funds goals, retirement & insurance"/>
<Fx style={{marginBottom:16}}><St label="Total Assets" value={fmt(totA)} color={C.green}/><St label="Liabilities" value={fmt(totL)} color={C.red}/><St label="Net Worth" value={fmt(nw)} color={nw>=0?C.green:C.red}/><St label="Monthly SIPs" value={fmt(sipMo)} color={C.blue}/></Fx>
{/* 6. Allocation pie */}
{allocData.length>0&&<Cd title="Asset Allocation" accent={C.purple} style={{marginBottom:12}}>
<ResponsiveContainer width="100%" height={200}>
<PieChart><Pie data={allocData} cx="50%" cy="50%" outerRadius={80} innerRadius={35} dataKey="value" label={({name,value,percent})=>`${name}: ${fmt(value)} (${(percent*100).toFixed(0)}%)`} labelLine={{stroke:C.dim}}>
{allocData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip content={<ChTip/>}/></PieChart></ResponsiveContainer></Cd>}
<G cols={2}>
<Cd title="📈 Equity" accent={C.green}>
{[["Equity Mutual Funds","equityMF"],["Direct Equity/Stocks","directEquity"],["ULIP","ulip"]].map(([l,k])=><div key={k}>
<Inp label={l} value={pf.equity?.[k]||0} onChange={v=>setPf(p=>({...p,equity:{...p.equity,[k]:v}}))} prefix="₹"/>
{pf.sips?.[k]!==undefined&&<div style={{display:"flex",gap:6,marginTop:2,marginBottom:4}}>
<Inp label="SIP" value={pf.sips[k]?.amt||0} onChange={v=>setPf(p=>({...p,sips:{...p.sips,[k]:{...p.sips[k],amt:v}}}))} prefix="₹" w="100px"/>
<Sel label="Freq" value={pf.sips[k]?.freq||"monthly"} onChange={v=>setPf(p=>({...p,sips:{...p.sips,[k]:{...p.sips[k],freq:v}}}))} options={FREQ_OPTS}/>
</div>}</div>)}
<div style={{fontSize:11,fontWeight:700,color:C.green,marginTop:4}}>Total: {fmt(eqTotal)}</div>
</Cd>
<Cd title="🏦 Fixed Income" accent={C.blue}>
{[["Fixed Deposits","fixedDeposits"],["Recurring Deposits","recurringDeposits"],["Bonds","bonds"],["Debt MFs","debtMF"]].map(([l,k])=><div key={k}>
<Inp label={l} value={pf.fixedIncome?.[k]||0} onChange={v=>setPf(p=>({...p,fixedIncome:{...p.fixedIncome,[k]:v}}))} prefix="₹"/>
{pf.sips?.[k]!==undefined&&<div style={{display:"flex",gap:6,marginTop:2,marginBottom:4}}>
<Inp label="SIP" value={pf.sips[k]?.amt||0} onChange={v=>setPf(p=>({...p,sips:{...p.sips,[k]:{...p.sips[k],amt:v}}}))} prefix="₹" w="100px"/>
<Sel label="Freq" value={pf.sips[k]?.freq||"monthly"} onChange={v=>setPf(p=>({...p,sips:{...p.sips,[k]:{...p.sips[k],freq:v}}}))} options={FREQ_OPTS}/>
</div>}</div>)}
<div style={{fontSize:11,fontWeight:700,color:C.blue,marginTop:4}}>Total: {fmt(fiTotal)}</div>
</Cd>
<Cd title="🏛️ Retirement Accounts" accent={C.purple}>
{[["EPF","epf"],["NPS","nps"],["PPF","ppf"]].map(([l,k])=><div key={k}>
<Inp label={l} value={pf.retirement?.[k]||0} onChange={v=>setPf(p=>({...p,retirement:{...p.retirement,[k]:v}}))} prefix="₹"/>
{pf.sips?.[k]!==undefined&&<div style={{display:"flex",gap:6,marginTop:2,marginBottom:4}}>
<Inp label="Contribution" value={pf.sips[k]?.amt||0} onChange={v=>setPf(p=>({...p,sips:{...p.sips,[k]:{...p.sips[k],amt:v}}}))} prefix="₹" w="100px"/>
<Sel label="Freq" value={pf.sips[k]?.freq||"monthly"} onChange={v=>setPf(p=>({...p,sips:{...p.sips,[k]:{...p.sips[k],freq:v}}}))} options={FREQ_OPTS}/>
</div>}</div>)}
<div style={{fontSize:11,fontWeight:700,color:C.purple,marginTop:4}}>Total: {fmt(retAccts)}</div>
</Cd>
<Cd title="📦 Small Savings" accent={C.cyan}>
{[["NSC","nsc"],["SSY","ssy"],["KVP","kvp"],["SCSS","scss"],["Post Office","postOffice"]].map(([l,k])=>
<Inp key={k} label={l} value={pf.smallSavings?.[k]||0} onChange={v=>setPf(p=>({...p,smallSavings:{...p.smallSavings,[k]:v}}))} prefix="₹"/>)}
<div style={{fontSize:11,fontWeight:700,color:C.cyan,marginTop:4}}>Total: {fmt(ssTotal)}</div>
</Cd>
<Cd title="💵 Cash & Bank" accent={C.accent}>
{[["Savings Accounts","savingsBank"],["Cash in Hand","cashInHand"],["Emergency Fund","emergency"]].map(([l,k])=>
<Inp key={k} label={l} value={pf.cash?.[k]||0} onChange={v=>setPf(p=>({...p,cash:{...p.cash,[k]:v}}))} prefix="₹"/>)}
<div style={{fontSize:11,fontWeight:700,color:C.accent,marginTop:4}}>Total: {fmt(cashTotal)}</div>
</Cd>
<Cd title="🥇 Commodities" accent={C.orange}>
{[["Gold Bars/Coins","goldBars"],["Gold Coins","goldCoins"],["Jewellery","jewellery"]].map(([l,k])=>
<Inp key={k} label={l} value={pf.commodities?.[k]||0} onChange={v=>setPf(p=>({...p,commodities:{...p.commodities,[k]:v}}))} prefix="₹"/>)}
<div style={{fontSize:11,fontWeight:700,color:C.orange,marginTop:4}}>Total: {fmt(commodTotal)}</div>
</Cd>
</G>
{/* Traditional Insurance / Endowment Policies */}
<Cd title="🏛️ Traditional Insurance / Endowment" accent={C.purple} style={{gridColumn:"1/-1",marginTop:10}}>
<div style={{fontSize:9,color:C.dim,marginBottom:6}}>Endowment, money-back, and traditional insurance plans with maturity value.</div>
{tradIns_.map((t,i)=><div key={i} style={{padding:8,background:C.bg,borderRadius:6,marginBottom:6}}>
<G cols={4}>
<Inp label="Plan Name" value={t.planName||""} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],planName:v};setTradIns(a);}} type="text"/>
<Inp label="Company" value={t.company||""} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],company:v};setTradIns(a);}} type="text"/>
<Inp label="Sum Assured" value={t.coverage||0} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],coverage:v};setTradIns(a);}} prefix="₹"/>
<Inp label="Current Value" value={t.currentValue||0} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],currentValue:v};setTradIns(a);}} prefix="₹"/>
</G>
<G cols={5} style={{marginTop:4}}>
<DOBInp label="Commencement" value={t.commenceDate||""} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],commenceDate:v};setTradIns(a);}}/>
<DOBInp label="Maturity Date" value={t.maturityDate||""} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],maturityDate:v};setTradIns(a);}}/>
<Inp label="Maturity Value" value={t.maturityValue||0} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],maturityValue:v};setTradIns(a);}} prefix="₹" hint="Expected payout"/>
<Inp label="Premium" value={t.premium||0} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],premium:v};setTradIns(a);}} prefix="₹"/>
<Sel label="Freq" value={t.freq||"yearly"} onChange={v=>{const a=[...tradIns_];a[i]={...a[i],freq:v};setTradIns(a);}} options={FREQ_OPTS}/>
</G>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
<span style={{fontSize:9,color:C.dim}}>Monthly premium: {fmt(toMo(t.premium,t.freq))}</span>
<Del onClick={()=>setTradIns(tradIns_.filter((_,j)=>j!==i))}/>
</div></div>)}
<AddBtn label="+ Add Endowment/Traditional Plan" onClick={()=>setTradIns([...tradIns_,{planName:"",company:"",coverage:0,currentValue:0,commenceDate:"",maturityDate:"",maturityValue:0,premium:0,freq:"yearly"}])}/>
{tradIns_.length>0&&<div style={{marginTop:6,fontSize:11,fontWeight:700,color:C.purple}}>Total Current Value: {fmt(tradInsTotal)} | Est. Maturity: {fmt(tradInsMaturity)}</div>}
</Cd>
{/* Step 7: Asset Allocation Tracker */}
{Object.keys(assetAllocTracker).length>0&&<Cd title="📊 Asset → Goal Allocation Tracker" accent={C.accent} style={{marginTop:10,marginBottom:10}}>
<div style={{fontSize:10,color:C.dim,marginBottom:8}}>Shows how portfolio assets are allocated across goals.</div>
<Fx style={{marginBottom:8}}>
<St label="Total Investable" value={fmt(investA)} color={C.green}/>
<St label="Allocated to Goals" value={fmt(Object.values(assetAllocTracker).reduce((s,a)=>s+a.allocated,0))} color={C.blue}/>
<St label="Unallocated" value={fmt(investA-Object.values(assetAllocTracker).reduce((s,a)=>s+a.allocated,0))} color={C.accent}/>
</Fx>
<div style={{maxHeight:200,overflowY:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><TR header cells={["Asset","Total Value","Allocated","Unallocated","Goals"]}/></thead>
<tbody>{Object.entries(assetAllocTracker).map(([k,a])=><TR key={k} cells={[
a.overAllocated?`⚠️ ${a.label}`:a.label,
{v:fmt(a.total),color:C.text},
{v:fmt(a.allocated)+(a.overAllocated?" (capped)":""),color:a.overAllocated?C.red:a.allocated>0?C.blue:C.dim},
{v:fmt(Math.max(0,a.total-a.allocated)),color:a.allocated<a.total?C.green:C.orange},
{v:a.goals.length>0?a.goals.join(", ")+(a.goals.length>1?" (shared)":""):"—",color:a.goals.length>1?C.orange:C.dim}
]}/>)}</tbody></table></div>
</Cd>}
{/* Property & Liabilities */}
<G cols={2} style={{marginTop:10}}>
<Cd title="🏠 Property (Non-Investment)" accent={C.orange}>
{[["Residential","residential"],["Vehicle","vehicle"],["Other Personal","otherPersonal"]].map(([l,k])=>
<Inp key={k} label={l} value={prop[k]||0} onChange={v=>setProp({...prop,[k]:v})} prefix="₹"/>)}
</Cd>
<Cd title="💳 Liabilities" accent={C.red}>
{[["Home Loan","homeLoan"],["Vehicle Loan","vehicleLoan"],["Personal Loan","personalLoan"]].map(([l,k])=><div key={k} style={{marginBottom:6}}>
<div style={{fontSize:10,fontWeight:600,marginBottom:2}}>{l}</div>
<G cols={3}><Inp label="Outstanding" value={li_[k]?.outstanding||0} onChange={v=>setLiab({...li_,[k]:{...li_[k],outstanding:v}})} prefix="₹"/>
<Inp label="EMI" value={li_[k]?.emi||0} onChange={v=>setLiab({...li_,[k]:{...li_[k],emi:v}})} prefix="₹" suffix="/mo"/>
<Inp label="Remaining" value={li_[k]?.remaining||0} onChange={v=>setLiab({...li_,[k]:{...li_[k],remaining:v}})} suffix="mo"/></G>
</div>)}</Cd>
</G></div>}

{/* ──── 2. INSURANCE (Need-Based Analysis) ──── */}
{tab==="insurance"&&cl&&<div>
<SH icon="🛡️" title="Insurance Planning" sub="Need-based life insurance analysis + general policies"/>
{/* Life Insurance Need Table */}
<Cd title="❤️ Life Insurance Need Analysis" accent={C.red} style={{marginBottom:12}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><TR header cells={["Particulars","Annual Amount","Total Amount"]}/></thead>
<tbody>
<TR cells={["Liabilities (loans)","—",{v:fmt(lifeInsAnalysis.liabilities),color:C.red}]}/>
<TR cells={["Dependents Living Expenses",{v:fmt(lifeInsAnalysis.depAnnExp),color:C.text},{v:fmt(lifeInsAnalysis.depCorpus),color:C.orange,bold:true}]}/>
<TR cells={[{v:`  ↳ ${lifeInsAnalysis.spouseRemYrs}y @ net real return`,color:C.dim},"",""]}/>
<TR cells={["Future Goals Funding","—",{v:fmt(lifeInsAnalysis.goalFunding),color:C.purple}]}/>
<TR hl cells={["Gross Life Insurance Required","",{v:fmt(lifeInsAnalysis.grossNeed),color:C.red,bold:true}]}/>
<TR cells={["Less: Existing Life Cover","",{v:`(${fmt(lifeInsAnalysis.existingCover)})`,color:C.green}]}/>
<TR cells={["Less: Existing Assets","",{v:`(${fmt(lifeInsAnalysis.existingAssets)})`,color:C.green}]}/>
<TR hl cells={["Additional Life Insurance Required","",{v:fmt(lifeInsAnalysis.additional),color:lifeInsAnalysis.additional>0?C.red:C.green,bold:true}]}/>
</tbody></table>
</Cd>
{/* Life Policies */}
<Cd title="Life Insurance Policies" accent={C.blue} style={{marginBottom:12}}>
{lp_.map((p,i)=><div key={i} style={{display:"flex",gap:6,alignItems:"flex-end",marginBottom:6}}>
<Inp label="Company" value={p.company||""} onChange={v=>{const a=[...lp_];a[i]={...a[i],company:v};setLP(a);}} type="text" w="120px"/>
<Inp label="Sum Assured" value={p.cover||0} onChange={v=>{const a=[...lp_];a[i]={...a[i],cover:v};setLP(a);}} prefix="₹" w="100px"/>
<Inp label="Premium" value={p.premium||0} onChange={v=>{const a=[...lp_];a[i]={...a[i],premium:v};setLP(a);}} prefix="₹" w="80px"/>
<Sel label="Freq" value={p.freq||"yearly"} onChange={v=>{const a=[...lp_];a[i]={...a[i],freq:v};setLP(a);}} options={FREQ_OPTS}/>
<div style={{minWidth:55}}><div style={{fontSize:8,color:C.dim}}>Monthly</div><div style={{fontSize:11,fontWeight:600,color:C.cyan,fontFamily:F.m}}>{fmt(toMo(p.premium,p.freq))}</div></div>
<Del onClick={()=>setLP(lp_.filter((_,j)=>j!==i))}/></div>)}
<AddBtn label="+ Life Policy" onClick={()=>setLP([...lp_,{company:"",cover:0,premium:0,freq:"yearly"}])}/>
</Cd>
{/* General Insurance */}
<Cd title="General Insurance" accent={C.green}>
{gp_.map((p,i)=><div key={i} style={{display:"flex",gap:6,alignItems:"flex-end",marginBottom:6}}>
<div style={{minWidth:80}}><div style={{fontSize:9,color:C.cyan,fontWeight:700}}>{p.type}</div></div>
<Inp label="Company" value={p.company||""} onChange={v=>{const a=[...gp_];a[i]={...a[i],company:v};setGP(a);}} type="text" w="100px"/>
<Inp label="Sum Insured" value={p.sumInsured||0} onChange={v=>{const a=[...gp_];a[i]={...a[i],sumInsured:v};setGP(a);}} prefix="₹" w="90px"/>
<Inp label="Premium" value={p.premium||0} onChange={v=>{const a=[...gp_];a[i]={...a[i],premium:v};setGP(a);}} prefix="₹" w="80px"/>
<Sel label="Freq" value={p.freq||"yearly"} onChange={v=>{const a=[...gp_];a[i]={...a[i],freq:v};setGP(a);}} options={FREQ_OPTS}/>
<div style={{minWidth:55}}><div style={{fontSize:8,color:C.dim}}>Monthly</div><div style={{fontSize:11,fontWeight:600,color:C.cyan,fontFamily:F.m}}>{fmt(toMo(p.premium,p.freq))}</div></div>
</div>)}
<div style={{marginTop:8,padding:8,background:C.bg,borderRadius:6}}>
<Fx><St label="Life Premiums" value={fmt(lifePMo)+"/mo"} color={C.cyan}/><St label="General" value={fmt(genPMo)+"/mo"} color={C.cyan}/><St label="Total" value={fmt(insP)+"/mo"} color={C.accent} sub={fmt(insP*12)+"/yr"}/></Fx>
</div></Cd>
</div>}

{/* ──── 7. GOAL PLANNING with Owner + Asset Funding ──── */}
{tab==="goals"&&cl&&<div>
<SH icon="🎯" title="Goal Planning" sub="Owner mapping • Asset-to-goal funding • Step-up SIP"/>
<Cd title="Quick Add" accent={C.accent} style={{marginBottom:12}}>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{[{i:"🎓",n:"Education",pv:2e6,y:15,inf:.10},{i:"💒",n:"Marriage",pv:1e6,y:20,inf:.06},{i:"🏠",n:"House",pv:8e6,y:8,inf:.08},{i:"🚗",n:"Car",pv:1e6,y:5,inf:.06},{i:"✈️",n:"Vacation",pv:5e5,y:3,inf:.06},{i:"📦",n:"Custom",pv:5e5,y:5,inf:.06}].map(t=>
<button key={t.n} onClick={()=>setGoals(p=>[...p,{id:Date.now()+Math.random(),name:t.n,pv:t.pv,yrs:t.y,inf:t.inf,existing:0,priority:"High",stepUp:.10,ownerType:"self",targetAge:0,fundingAssets:[]}])}
style={{padding:"8px 14px",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:11,cursor:"pointer"}}>{t.i} {t.n}</button>)}
</div>
{/* Children milestones with auto owner + targetAge */}
{(P.children||[]).length>0&&<div style={{marginTop:10}}>
<div style={{fontSize:10,fontWeight:700,color:C.dim,marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Children Milestones</div>
{P.children.map((ch,ci)=>{const ca=calcAge(ch.dob);const ot=`child_${ci}`;return(
<div key={ci} style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6,alignItems:"center"}}>
<span style={{fontSize:10,color:C.green,minWidth:80,fontWeight:600}}>{ch.name||`Child ${ci+1}`} ({ca}y):</span>
{[["📚","10th Std",3e5,15,.10],["🎒","12th Std",3e5,17,.10],["🎓","Graduation",1e6,18,.10],["🎓","Post-Grad",2e6,22,.10],["💒","Marriage",1.5e6,25,.07]].map(([icon,label,cost,tAge,inf])=>{
const yrs=Math.max(1,tAge-ca);const nm=`${ch.name||"Child"} — ${label}`;const exists=go_.some(g=>g.name===nm);
return <button key={label} disabled={exists||yrs<=0} onClick={()=>setGoals(p=>[...p,{id:Date.now()+Math.random(),name:nm,pv:cost,yrs,inf,existing:0,priority:"High",stepUp:.10,ownerType:ot,targetAge:tAge,fundingAssets:[]}])}
style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${exists?C.green+"40":C.border}`,background:exists?`${C.green}10`:C.bg,color:exists?C.green:C.text,fontSize:9,cursor:exists||yrs<=0?"default":"pointer",opacity:yrs<=0?.4:1}}>{exists?"✓ ":icon+" "}{label} ({yrs}y)</button>})}
</div>)})}
</div>}
</Cd>

{/* Goal Cards */}
{gAn.map((g,gi)=>{const pc=g.priority==="High"?C.red:g.priority==="Medium"?C.orange:C.blue;
/* Available portfolio assets with value > 0 for funding checkboxes */
const availAssets=PF_ASSETS.filter(a=>getPfVal(a.key)>0);
return(
<Cd key={g.id} style={{marginBottom:10}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:700,background:`${pc}20`,color:pc}}>{g.priority}</span>
{g.ownerName&&<span style={{padding:"2px 6px",borderRadius:4,fontSize:9,background:`${C.cyan}18`,color:C.cyan}}>👤 {g.ownerName}</span>}
<input value={g.name} onChange={e=>{const a=[...go_];a[gi]={...a[gi],name:e.target.value};setGoals(a);}} style={{background:"transparent",border:"none",color:C.text,fontSize:14,fontWeight:700,outline:"none",fontFamily:F.s,width:200}}/>
</div><Del onClick={()=>setGoals(go_.filter((_,j)=>j!==gi))}/></div>

{/* Row 1: Owner + Core fields */}
<G cols={7}>
<Sel label="Goal Owner" value={g.ownerType||"self"} onChange={v=>{const a=[...go_];const dob=getOwnerDob(v);const oAge=calcAge(dob);a[gi]={...a[gi],ownerType:v};if(g.targetAge&&oAge>0)a[gi].yrs=Math.max(1,g.targetAge-oAge);setGoals(a);}} options={ownerOpts}/>
<Inp label="Present Cost" value={g.pv||0} onChange={v=>{const a=[...go_];a[gi]={...a[gi],pv:v};setGoals(a);}} prefix="₹"/>
<Inp label="Target Age" value={g.targetAge||0} onChange={v=>{const a=[...go_];const oAge=calcAge(getOwnerDob(a[gi].ownerType||"self"));a[gi]={...a[gi],targetAge:v,yrs:oAge>0?Math.max(1,v-oAge):(g.yrs||1)};setGoals(a);}} suffix="yrs" hint={g.ownerAge>0?`Owner age: ${g.ownerAge}y`:""}/>
<Inp label="Years" value={g.yrsCalc||g.yrs||0} onChange={v=>{const a=[...go_];a[gi]={...a[gi],yrs:v,targetAge:0};setGoals(a);}} suffix="yrs" hint={g.targetAge>0?"Auto from target age":"Manual"}/>
<Inp label="Inflation" value={rr(g.inf)} onChange={v=>{const a=[...go_];a[gi]={...a[gi],inf:v/100};setGoals(a);}} suffix="%"/>
<Sel label="Priority" value={g.priority||"High"} onChange={v=>{const a=[...go_];a[gi]={...a[gi],priority:v};setGoals(a);}} options={["High","Medium","Low"]}/>
<Sel label="Step-Up" value={String(g.stepUp||0)} onChange={v=>{const a=[...go_];a[gi]={...a[gi],stepUp:parseFloat(v)};setGoals(a);}} options={STEP_OPTS.map(o=>({v:String(o.v),l:o.l}))}/>
</G>

{/* Existing savings */}
<div style={{marginTop:6}}><Inp label="Existing Savings for this Goal" value={g.existing||0} onChange={v=>{const a=[...go_];a[gi]={...a[gi],existing:v};setGoals(a);}} prefix="₹" w="200px"/></div>

{/* Step 5: Asset-to-Goal Funding Checkboxes */}
{availAssets.length>0&&<div style={{marginTop:8,padding:8,background:C.bg,borderRadius:6}}>
<div style={{fontSize:9,fontWeight:700,color:C.dim,textTransform:"uppercase",marginBottom:6}}>Funding Assets (from Portfolio)</div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{availAssets.map(a=>{const checked=(g.fundingAssets||[]).includes(a.key);const cv=getPfVal(a.key);return(
<label key={a.key} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:4,border:`1px solid ${checked?C.accent+"50":C.border}`,background:checked?C.accentBg:"transparent",cursor:"pointer",fontSize:9}}>
<input type="checkbox" checked={checked} onChange={()=>{const a2=[...go_];const cur=a2[gi].fundingAssets||[];a2[gi]={...a2[gi],fundingAssets:checked?cur.filter(k=>k!==a.key):[...cur,a.key]};setGoals(a2);}}
style={{accentColor:C.accent,width:12,height:12}}/>
<span style={{color:checked?C.accent:C.text}}>{a.label}</span>
<span style={{color:C.dim,fontFamily:F.m,fontSize:8}}>{fmt(cv)}</span>
</label>)})}
</div>
{g.fundingSrc?.length>0&&<div style={{marginTop:6,fontSize:9,color:C.dim}}>
Mapped: {g.fundingSrc.map(s=>`${s.label}${s.shared?" (shared)":""} ${fmt(s.cv)}→FV ${fmt(s.fv)}`).join(" • ")}
</div>}
</div>}

{/* Results row */}
<G cols={8} style={{marginTop:8}}>
<St label="Future Value" value={fmt(g.fv)} color={C.orange}/>
<St label="Asset Funded" value={fmt(g.assetFunded)} color={C.blue} sub={g.fundingSrc?.length?`${g.fundingSrc.length} assets`:"none"}/>
<St label="Existing (FV)" value={fmt(g.existingGrown)} color={C.cyan}/>
<St label="Total Funded" value={fmt(g.totalFunded)} color={C.green}/>
<St label="Gap" value={fmt(g.gap)} color={g.gap>0?C.red:C.green}/>
<St label="Flat SIP" value={fmt(g.sip)} color={C.dim}/>
<St label={`Step-Up SIP`} value={fmt(g.stepSIP)} color={C.accent} sub={`${STEP_OPTS.find(o=>o.v===g.stepRate)?.l||"Flat"}`}/>
{(()=>{const mc=goalMC.find(m=>m.id===g.id);return mc?<St label="🎲 MC Prob" value={`${mc.mcProb}%`} color={mc.mcProb>=75?C.green:mc.mcProb>=50?C.orange:C.red} sub={`Median: ${fmt(mc.mcMedian)}`}/>:<St label="🎲 MC" value="—" color={C.dim}/>;})()}
</G>
{/* Owner + age info */}
<div style={{marginTop:4,fontSize:9,color:C.dim}}>
Owner: {g.ownerName} {g.ownerAge>0?`(${g.ownerAge}y)`:""}  •  Age at goal: {g.ageAt}y  •  Years: {g.yrsCalc||g.yrs}y
{(()=>{const mc=goalMC.find(m=>m.id===g.id);return mc&&mc.mcProb>0?`  •  🎲 Monte Carlo: ${mc.mcProb}% success (500 sims)`:""})()}
</div>
</Cd>)})}

{/* Step 8: Goal Funding Summary */}
{go_.length>0&&<Cd title="📊 Goal Funding Summary" accent={C.accent} style={{marginBottom:10}}>
<Fx style={{marginBottom:10}}>
<St label="Total Goal Value" value={fmt(gAn.reduce((s,g)=>s+g.fv,0))} color={C.orange}/>
<St label="Assets Allocated" value={fmt(gAn.reduce((s,g)=>s+g.assetFunded,0))} color={C.blue}/>
<St label="Existing Savings" value={fmt(gAn.reduce((s,g)=>s+g.existingGrown,0))} color={C.cyan}/>
<St label="Investment Gap" value={fmt(gAn.reduce((s,g)=>s+g.gap,0))} color={C.red}/>
<St label="Total SIP" value={fmt(totGoalSIP)} color={C.accent}/>
<St label="Surplus" value={fmt(surp)} color={surp>=totGoalSIP?C.green:C.red}/>
</Fx>
{/* Step 9: Goal summary table */}
<div style={{overflowX:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
<thead><TR header cells={["Goal","Owner","Age@Goal","Future Value","Assets Alloc","Gap","Step-Up SIP","🎲 Prob"]}/></thead>
<tbody>{gAn.map(g=>{const mc=goalMC.find(m=>m.id===g.id);return <TR key={g.id} cells={[
g.name,
{v:g.ownerName,color:C.cyan},
g.ageAt+"y",
{v:fmt(g.fv),color:C.orange},
{v:fmt(g.assetFunded),color:C.blue},
{v:fmt(g.gap),color:g.gap>0?C.red:C.green},
{v:fmt(g.stepRate>0?g.stepSIP:g.sip),color:C.accent,bold:true},
{v:mc?`${mc.mcProb}%`:"—",color:mc&&mc.mcProb>=75?C.green:mc&&mc.mcProb>=50?C.orange:C.red,bold:true}
]}/>})}
<TR hl cells={["Total","","",{v:fmt(gAn.reduce((s,g)=>s+g.fv,0)),color:C.orange,bold:true},{v:fmt(gAn.reduce((s,g)=>s+g.assetFunded,0)),color:C.blue,bold:true},{v:fmt(gAn.reduce((s,g)=>s+g.gap,0)),color:C.red,bold:true},{v:fmt(totGoalSIP),color:C.accent,bold:true},""]}/>
</tbody></table></div>
</Cd>}

{/* Goal funding chart */}
{gAn.length>0&&<Cd title="Goal Funding Breakdown" accent={C.blue} style={{marginTop:10}}>
<ResponsiveContainer width="100%" height={200}>
<BarChart data={gAn.map(g=>({name:g.name.length>10?g.name.slice(0,10)+"…":g.name,FV:Math.round(g.fv),Assets:Math.round(g.assetFunded),Existing:Math.round(g.existingGrown),Gap:Math.round(g.gap)}))}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/><Legend wrapperStyle={{fontSize:9}}/>
<Bar dataKey="FV" fill={C.orange} radius={[3,3,0,0]}/><Bar dataKey="Assets" fill={C.blue} radius={[3,3,0,0]}/><Bar dataKey="Existing" fill={C.cyan} radius={[3,3,0,0]}/><Bar dataKey="Gap" fill={C.red} radius={[3,3,0,0]}/>
</BarChart></ResponsiveContainer></Cd>}
</div>}

{/* ──── 8. RETIREMENT ──── */}
{tab==="retirement"&&cl&&<div>
<SH icon="🏖️" title="Retirement Planning" sub="Accumulation → distribution. Step-up SIP + scenarios."/>
<Cd title="Post-Retirement Expenses" accent={C.orange} style={{marginBottom:10}}>
<div style={{fontSize:10,color:C.dim,marginBottom:4}}>Override monthly expense. 0 = auto from current lifestyle.</div>
<G cols={4}>
<Inp label="Post-Ret Expense/mo" value={re_.postRetExpense||0} onChange={v=>setRE({...re_,postRetExpense:v})} prefix="₹" hint={re_.postRetExpense?`Override: ${fmt(re_.postRetExpense)}`:`Auto: ${fmt(retME)}`}/>
<Inp label="Ret. Inflation %" value={re_.retInflation?rr(re_.retInflation):0} onChange={v=>setRE({...re_,retInflation:v/100})} suffix="%" hint={re_.retInflation?`Override`:`Auto: ${pct(A.retInf)}`}/>
<Inp label="Retire Age" value={P.retireAge} disabled suffix="yrs"/><Inp label="Life Expectancy" value={P.lifeExpect} disabled suffix="yrs"/>
</G></Cd>
<Cd title="Post-Retirement Income" accent={C.green} style={{marginBottom:10}}>
<G cols={3}><Inp label="Pension" value={ri_.pension||0} onChange={v=>setRI({...ri_,pension:v})} prefix="₹" suffix="/mo"/><Inp label="Rental" value={ri_.rental||0} onChange={v=>setRI({...ri_,rental:v})} prefix="₹" suffix="/mo"/><Inp label="Other" value={ri_.other||0} onChange={v=>setRI({...ri_,other:v})} prefix="₹" suffix="/mo"/></G>
</Cd>
{/* Retirement Asset Mapping — reduces corpus required */}
<Cd title="🏦 Retirement Assets (Reduce Corpus Required)" accent={C.blue} style={{marginBottom:10}}>
<div style={{fontSize:9,color:C.dim,marginBottom:8}}>Select assets earmarked for retirement. Their future value at retirement will directly reduce the corpus you need to build.</div>
<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
{[{k:"epf",l:"EPF",v:pf.retirement?.epf||0},{k:"nps",l:"NPS",v:pf.retirement?.nps||0},{k:"ppf",l:"PPF",v:pf.retirement?.ppf||0},{k:"savingsBank",l:"Savings Bank",v:pf.cash?.savingsBank||0},{k:"cashInHand",l:"Cash in Hand",v:pf.cash?.cashInHand||0},{k:"emergency",l:"Emergency Fund",v:pf.cash?.emergency||0},
...tradIns_.filter(t=>t.currentValue>0).map(t=>({k:`trad_${t.planName||"endowment"}`,l:t.planName||"Endowment",v:t.currentValue}))
].filter(a=>a.v>0).map(a=>{const checked=(retMap_||[]).includes(a.k);return(
<label key={a.k} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:5,border:`1px solid ${checked?C.blue+"60":C.border}`,background:checked?C.blue+"12":"transparent",cursor:"pointer",fontSize:10}}>
<input type="checkbox" checked={checked} style={{accentColor:C.blue,width:13,height:13}}
onChange={()=>setRetMap(checked?(retMap_||[]).filter(x=>x!==a.k):[...(retMap_||[]),a.k])}/>
<span style={{color:checked?C.blue:C.text}}>{a.l}</span>
<span style={{color:C.dim,fontFamily:F.m,fontSize:8}}>{fmt(a.v)}</span>
</label>)})}
</div>
{retMappedFV.items.length>0&&<div style={{padding:8,background:C.bg,borderRadius:6}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><TR header cells={["Mapped Asset","Current Value","Growth Rate","FV at Retirement"]}/></thead>
<tbody>{retMappedFV.items.map(i=><TR key={i.key} cells={[i.label,{v:fmt(i.cv),color:C.text},{v:pct(i.ret),color:C.blue},{v:fmt(i.fv),color:C.green,bold:true}]}/>)}
<TR hl cells={["Total Mapped",{v:fmt(retMappedFV.items.reduce((s,i)=>s+i.cv,0)),color:C.text,bold:true},"",{v:fmt(retMappedFV.total),color:C.green,bold:true}]}/></tbody></table>
<div style={{marginTop:6,fontSize:10,color:C.accent}}>Gross Corpus: {fmt(retCorpusGross)} − Mapped Assets FV: {fmt(retMappedFV.total)} = <span style={{fontWeight:700}}>Net Corpus Required: {fmt(retCorpus)}</span></div>
</div>}
</Cd>
<Fx style={{marginBottom:12}}>
<St label="Gross Corpus" value={fmt(retCorpusGross)} color={C.orange} sub="Before mapped assets"/><St label="Mapped Assets FV" value={fmt(retMappedFV.total)} color={C.blue} sub={`${retMappedFV.items.length} assets`}/><St label="Net Corpus Req" value={fmt(retCorpus)} color={C.red}/><St label="Corpus Available" value={fmt(retFunded)} color={C.green}/><St label="Gap" value={fmt(retGap)} color={retGap>0?C.red:C.green}/><St label={`Step-Up ${rr(retStepUp)}%`} value={fmt(retStepSIP)} color={C.accent} sub={`${ytr}y`}/><St label="Phase" value={`${rYrs}y`} color={C.purple} sub={`${P.retireAge}–${P.lifeExpect}`}/>
</Fx>
{/* FORMULA BREAKDOWN: How Corpus Required is calculated */}
<G cols={2} style={{marginBottom:10}}>
<Cd title="📐 Corpus Required — Derivation" accent={C.red}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><TR header cells={["Step","Formula / Value"]}/></thead>
<tbody>
<TR cells={["① Monthly Expenses (today)",{v:fmt(retExpBase)+"/mo",color:C.text,bold:true}]}/>
<TR cells={[{v:"  Lifestyle (excl child ed, parents)",color:C.dim},{v:re_.postRetExpense>0?"Manual override":`Auto: ${fmt(retME)}/mo`,color:C.dim}]}/>
<TR cells={["② Annual Expenses (today)",{v:fmt(retExpBase*12)+"/yr",color:C.text}]}/>
<TR cells={["③ Inflation Rate",{v:pct(A.inflation),color:C.orange}]}/>
<TR cells={["④ Years to Retirement",{v:ytr+" years",color:C.text}]}/>
<TR cells={["⑤ Expenses at Retirement (FV)",{v:fmt(retEF)+"/yr",color:C.orange,bold:true}]}/>
<TR cells={[{v:"  = ②×(1+③)^④",color:C.dim},{v:`${fmt(retExpBase*12)} × (1+${pct(A.inflation)})^${ytr}`,color:C.dim}]}/>
<TR cells={["⑥ Post-Retirement Income",{v:fmt(retAI)+"/yr",color:C.green}]}/>
<TR cells={[{v:"  Pension + Rental + Other",color:C.dim},{v:`(${fmt(ri_.pension||0)}+${fmt(ri_.rental||0)}+${fmt(ri_.other||0)})×12`,color:C.dim}]}/>
<TR cells={["⑦ Net Annual Need (⑤ − ⑥)",{v:fmt(retNN)+"/yr",color:C.red,bold:true}]}/>
<TR cells={["⑧ Post-Ret Return",{v:pct(A.retRet),color:C.blue}]}/>
<TR cells={["⑨ Post-Ret Inflation",{v:pct(retInflation),color:C.orange}]}/>
<TR cells={["⑩ Real Return = (1+⑧)/(1+⑨)−1",{v:pct(retNR),color:C.purple}]}/>
<TR cells={["⑪ Retirement Years (⑩ to deplete)",{v:rYrs+" years",color:C.text}]}/>
<TR hl cells={["⑫ CORPUS REQUIRED",{v:fmt(retCorpus),color:C.red,bold:true}]}/>
<TR cells={[{v:"  = ⑦ × PV annuity(⑩, ⑪)",color:C.dim},{v:`${fmt(retNN)} × ${retNR>0?((1-Math.pow(1+retNR,-rYrs))/retNR).toFixed(2):rYrs}`,color:C.dim}]}/>
</tbody></table>
</Cd>
<Cd title="📐 Corpus Available — Derivation" accent={C.green}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><TR header cells={["Step","Formula / Value"]}/></thead>
<tbody>
<TR cells={["① Current Portfolio Value",{v:fmt(investA),color:C.text,bold:true}]}/>
<TR cells={[{v:"  Equity",color:C.dim},{v:fmt(eqTotal),color:C.dim}]}/>
<TR cells={[{v:"  Fixed Income",color:C.dim},{v:fmt(fiTotal),color:C.dim}]}/>
<TR cells={[{v:"  Retirement Accounts",color:C.dim},{v:fmt(retAccts),color:C.dim}]}/>
<TR cells={[{v:"  Small Savings",color:C.dim},{v:fmt(ssTotal),color:C.dim}]}/>
<TR cells={[{v:"  Cash & Bank",color:C.dim},{v:fmt(cashTotal),color:C.dim}]}/>
<TR cells={[{v:"  Commodities",color:C.dim},{v:fmt(commodTotal),color:C.dim}]}/>
<TR cells={["② Weighted Avg Return",{v:pct(investA>0?(A.equity*eqTotal+A.debt*(fiTotal+retAccts+ssTotal)+0.04*cashTotal+0.09*commodTotal)/investA:0),color:C.blue}]}/>
<TR cells={[{v:"  = Σ(asset × return) / total",color:C.dim},{v:`(${pct(A.equity)}×Eq + ${pct(A.debt)}×FI + ...)`,color:C.dim}]}/>
<TR cells={["③ Years to Retirement",{v:ytr+" years",color:C.text}]}/>
<TR cells={["④ Portfolio FV at Retirement",{v:fmt(calcFV(investA,(A.equity*eqTotal+A.debt*(fiTotal+retAccts+ssTotal)+0.04*cashTotal+0.09*commodTotal)/(investA||1),ytr)),color:C.green,bold:true}]}/>
<TR cells={[{v:"  = ① × (1+②)^③",color:C.dim},"—"]}/>
<TR cells={["⑤ Monthly SIP Contributions",{v:fmt(sipMo)+"/mo",color:C.blue}]}/>
<TR cells={["⑥ SIP Accumulation at Retirement",{v:fmt(retFunded-calcFV(investA,(A.equity*eqTotal+A.debt*(fiTotal+retAccts+ssTotal)+0.04*cashTotal+0.09*commodTotal)/(investA||1),ytr)),color:C.blue}]}/>
<TR cells={[{v:"  = SIP×12 × FV annuity factor",color:C.dim},"—"]}/>
<TR hl cells={["⑦ CORPUS AVAILABLE (④+⑥)",{v:fmt(retFunded),color:C.green,bold:true}]}/>
</tbody></table>
<div style={{marginTop:8,padding:8,background:C.bg,borderRadius:6}}>
<G cols={3}>
<St label="Gap (Required − Available)" value={fmt(retGap)} color={retGap>0?C.red:C.green}/>
<St label="Flat SIP to Fill Gap" value={fmt(retSIP)} color={C.dim} sub={`over ${ytr}y`}/>
<St label="Step-Up SIP" value={fmt(retStepSIP)} color={C.accent} sub={`${rr(retStepUp)}% annual increase`}/>
</G></div>
</Cd>
</G>
{/* Step-Up selector for retirement */}
<Cd title="Retirement SIP Step-Up" accent={C.accent} style={{marginBottom:10}}>
<div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
<span style={{fontSize:10,color:C.dim}}>Annual step-up:</span>
{STEP_OPTS.map(o=><Pill key={o.v} label={o.l} active={retStepUp===o.v} color={C.accent} onClick={()=>setRetStepUp(o.v)}/>)}
</div>
<G cols={3} style={{marginTop:8}}>
<St label="Starting SIP (Flat)" value={fmt(retSIP)} color={C.dim}/>
<St label={`Starting SIP (${rr(retStepUp)}% step-up)`} value={fmt(retStepSIP)} color={C.accent}/>
<St label="Savings Needed" value={fmt(retGap)} color={retGap>0?C.red:C.green}/>
</G></Cd>
{/* Retirement Scenarios */}
<Cd title="🔮 Retirement Scenarios — What If?" accent={C.blue} style={{marginBottom:10}}>
<div style={{fontSize:10,color:C.dim,marginBottom:8}}>Compare early retirement, on-time, and delayed scenarios.</div>
<div style={{overflowX:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
<thead><TR header cells={["Scenario","Retire Age","Yrs to Retire","Ret Years","Corpus Req","Funded","Gap","Monthly SIP"]}/></thead>
<tbody>{retScenarios.map(s=>{const isCurrent=s.offset===0;return(
<TR key={s.offset} hl={isCurrent} cells={[
  {v:s.offset<0?`Early ${Math.abs(s.offset)}y`:s.offset>0?`Late +${s.offset}y`:"→ Current Plan",color:isCurrent?C.accent:s.offset<0?C.orange:C.green,bold:isCurrent},
  s.retireAge,s.yrsToRetire+"y",s.retYrs+"y",
  {v:fmt(s.corpus),color:C.red},{v:fmt(s.funded),color:C.green},
  {v:fmt(s.gap),color:s.gap>0?C.red:C.green,bold:true},
  {v:fmt(s.sip),color:C.accent,bold:true}
]}/>)})}</tbody></table>
</div></Cd>
{/* ── Monte Carlo Retirement Simulation ── */}
{retMC&&<Cd title="🎲 Monte Carlo Simulation" accent={"#6366f1"} style={{marginBottom:10}}>
<div style={{fontSize:10,color:C.dim,marginBottom:8}}>{mcSims} simulations with fat-tail events (5% crash probability), inflation variance, and sequence-of-returns risk.</div>
<div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
<span style={{fontSize:9,color:C.dim}}>Simulations:</span>
{[500,1000,2000,5000].map(n=><Pill key={n} label={`${n}`} active={mcSims===n} color={"#6366f1"} onClick={()=>setMcSims(n)}/>)}
</div>
<Fx style={{marginBottom:10}}>
<St label="Success Probability" value={`${retMC.successRate}%`} color={retMC.successRate>=75?C.green:retMC.successRate>=50?C.orange:C.red} sub={`≥ ${fmt(retCorpus)} target`}/>
<St label="Median Outcome" value={fmt(retMC.median)} color={C.blue}/>
<St label="10th Percentile" value={fmt(retMC.p10)} color={C.orange} sub="Pessimistic"/>
<St label="90th Percentile" value={fmt(retMC.p90)} color={C.green} sub="Optimistic"/>
<St label="Best Case" value={fmt(retMC.best)} color={C.green}/>
<St label="Worst Case" value={fmt(retMC.worst)} color={C.red}/>
</Fx>
{/* Percentile distribution bar */}
<ResponsiveContainer width="100%" height={140}>
<BarChart data={[{name:"Worst",value:retMC.worst},{name:"10th",value:retMC.p10},{name:"25th",value:retMC.p25},{name:"Median",value:retMC.median},{name:"75th",value:retMC.p75},{name:"90th",value:retMC.p90},{name:"Best",value:retMC.best}]}>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/>
<Bar dataKey="value" radius={[4,4,0,0]}>{[C.red,C.orange,C.orange,"#6366f1",C.blue,C.green,C.green].map((c,i)=><Cell key={i} fill={c}/>)}</Bar>
</BarChart></ResponsiveContainer>
{/* Yearly confidence bands */}
{retMC.bands&&retMC.bands.length>1&&<div style={{marginTop:8}}>
<div style={{fontSize:9,color:C.dim,marginBottom:4}}>Yearly portfolio growth — confidence bands</div>
<ResponsiveContainer width="100%" height={160}>
<AreaChart data={retMC.bands.filter((_,i)=>i%Math.max(1,Math.floor(retMC.bands.length/30))===0||i===retMC.bands.length-1)}>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="year" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/>
<Area type="monotone" dataKey="p90" stroke="none" fill={C.green} fillOpacity={0.08} name="90th"/>
<Area type="monotone" dataKey="p75" stroke="none" fill={C.green} fillOpacity={0.12} name="75th"/>
<Area type="monotone" dataKey="median" stroke={"#6366f1"} fill={"#6366f1"} fillOpacity={0.15} strokeWidth={2} name="Median"/>
<Area type="monotone" dataKey="p25" stroke="none" fill={C.orange} fillOpacity={0.10} name="25th"/>
<Area type="monotone" dataKey="p10" stroke="none" fill={C.red} fillOpacity={0.08} name="10th"/>
</AreaChart></ResponsiveContainer>
</div>}
<div style={{marginTop:6,padding:6,background:C.bg,borderRadius:6,fontSize:9,color:C.dim}}>
<span style={{fontWeight:700,color:C.accent}}>Interpretation:</span> {retMC.successRate}% chance your portfolio reaches ₹{fmt(retCorpus)} by retirement.
{retMC.successRate<50?" Consider increasing SIP or extending timeline.":retMC.successRate<75?" Moderate confidence — review asset allocation.":" Strong probability of meeting retirement goal."}
</div>
</Cd>}
{/* Corpus depletion chart */}
{retDepletion.length>0&&<Cd title="Corpus Depletion" accent={C.purple} style={{marginBottom:10}}>
<ResponsiveContainer width="100%" height={200}>
<ComposedChart data={retDepletion}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/><Legend wrapperStyle={{fontSize:9}}/>
<Area type="monotone" dataKey="corpus" stroke={C.purple} fill={C.purple+"20"} name="Corpus"/><Line type="monotone" dataKey="expense" stroke={C.red} dot={false} strokeWidth={1.5} name="Expense"/><Line type="monotone" dataKey="income" stroke={C.green} dot={false} strokeWidth={1.5} name="Income"/>
</ComposedChart></ResponsiveContainer></Cd>}
{/* Utilization table with formula explanation */}
<Cd title="Year-by-Year Corpus Utilization" accent={C.blue}>
<div style={{padding:10,background:C.bg,borderRadius:8,marginBottom:12}}>
<div style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:8}}>How to read this table</div>
<div style={{fontSize:10,color:C.dim,lineHeight:1.6}}>
This table tracks your retirement corpus from the day you retire until it runs out or you reach life expectancy. Each row is one year.
</div>
<div style={{marginTop:8,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
<div style={{padding:8,borderRadius:6,border:`1px solid ${C.border}`}}>
<div style={{fontSize:10,fontWeight:700,color:C.blue,marginBottom:4}}>Opening Balance</div>
<div style={{fontSize:9,color:C.dim}}>Corpus at the start of that year. Year 1 = full corpus required ({fmt(retCorpus)})</div>
</div>
<div style={{padding:8,borderRadius:6,border:`1px solid ${C.border}`}}>
<div style={{fontSize:10,fontWeight:700,color:C.green,marginBottom:4}}>Growth</div>
<div style={{fontSize:9,color:C.dim}}>= Opening × Post-Ret Return ({pct(A.retRet)})<br/>Your corpus earns returns even in retirement</div>
</div>
<div style={{padding:8,borderRadius:6,border:`1px solid ${C.border}`}}>
<div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:4}}>Expense</div>
<div style={{fontSize:9,color:C.dim}}>= First Year Expense × (1 + Ret Inflation)^year<br/>Yr 1: {fmt(retEF)} → grows at {pct(retInflation)}/yr</div>
</div>
<div style={{padding:8,borderRadius:6,border:`1px solid ${C.border}`}}>
<div style={{fontSize:10,fontWeight:700,color:C.green,marginBottom:4}}>Income</div>
<div style={{fontSize:9,color:C.dim}}>= Post-Ret Income × (1 + half inflation)^year<br/>Pension/rental/other: {fmt(retAI)}/yr, grows slower</div>
</div>
</div>
<div style={{marginTop:10,padding:8,borderRadius:6,background:`${C.accent}10`,border:`1px solid ${C.accent}30`}}>
<div style={{fontSize:10,fontWeight:700,color:C.accent,marginBottom:4}}>Closing Balance Formula</div>
<div style={{fontSize:10,color:C.text}}>Closing = Opening + Growth − (Expense − Income)</div>
<div style={{fontSize:9,color:C.dim,marginTop:4}}>
Each year: your corpus <span style={{color:C.green}}>earns returns</span>, but you <span style={{color:C.red}}>withdraw expenses</span> (reduced by any <span style={{color:C.green}}>income</span> you still earn).
When Closing hits ₹0 — your corpus is depleted. The row turns red.
</div>
<div style={{fontSize:9,color:C.dim,marginTop:4}}>
If corpus lasts past age {P.lifeExpect} → retirement is fully funded. If it depletes earlier → you have a shortfall.
</div>
</div>
</div>
<div style={{maxHeight:300,overflowY:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}><thead><TR header cells={["Age","Opening","Growth","Expense","Income","Closing"]}/></thead>
<tbody>{(()=>{let c=retCorpus;const rows=[];for(let y=0;y<rYrs&&c>0;y++){const o=c,gr=c*A.retRet,ex=retEF*Math.pow(1+retInflation,y),ic=retAI*Math.pow(1+retInflation*.5,y);c=o+gr-(ex-ic);rows.push(<TR key={y} cells={[P.retireAge+y,{v:fmt(o),color:C.blue},{v:fmt(gr),color:C.green},{v:fmt(ex),color:C.red},{v:fmt(ic),color:C.green},{v:fmt(Math.max(0,c)),color:c>0?C.text:C.red,bold:true}]} hl={c<=0}/>);}return rows;})()}</tbody></table>
</div></Cd></div>}

{/* ──── 10/11. PROJECTIONS ──── */}
{tab==="projections"&&cl&&<div>
<SH icon="📈" title="Projections & Reports" sub="Multi-year financial projections"/>
<div style={{display:"flex",gap:6,marginBottom:14}}>
{[{id:"charts",l:"📊 Charts"},{id:"tables",l:"📋 Tables"},{id:"both",l:"Both"}].map(v=>
<Pill key={v.id} label={v.l} active={projView===v.id} onClick={()=>setProjView(v.id)}/>)}
</div>

{(projView==="charts"||projView==="both")&&cfProj.length>1&&<Cd title="🗺️ Life Milestone Journey" accent={C.accent} style={{marginBottom:12}}>
<div style={{fontSize:10,color:C.dim,marginBottom:6}}>Income, expenses & net worth with goal milestones marked on the timeline.</div>
<ResponsiveContainer width="100%" height={280}>
<ComposedChart data={cfProj.filter((_,i)=>i%2===0)} margin={{top:20,right:10,bottom:5,left:10}}>
<defs><linearGradient id="msNw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.2}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
<XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/>
<YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/>
<Tooltip content={<ChTip/>}/><Legend wrapperStyle={{fontSize:9}}/>
<Area type="monotone" dataKey="netWorth" stroke={C.green} fill="url(#msNw)" strokeWidth={2} name="Net Worth"/>
<Line type="monotone" dataKey="income" stroke={C.blue} dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="Income"/>
<Line type="monotone" dataKey="expenses" stroke={C.red} dot={false} strokeWidth={1} strokeDasharray="4 2" name="Expenses"/>
{milestones.map((m,i)=><ReferenceLine key={i} x={m.age} stroke={m.color} strokeDasharray="3 3" strokeWidth={1.5}
  label={{value:`${m.name} (${m.age}y)`,position:"insideTopRight",fill:m.color,fontSize:8,fontWeight:700}}/>)}
<ReferenceLine x={P.retireAge} stroke={C.purple} strokeWidth={2} label={{value:`🏖️ Retire ${P.retireAge}`,position:"insideTopLeft",fill:C.purple,fontSize:9,fontWeight:800}}/>
</ComposedChart></ResponsiveContainer>
{/* Milestone legend */}
<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
{milestones.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:4,background:`${m.color}12`,border:`1px solid ${m.color}30`}}>
<div style={{width:8,height:8,borderRadius:4,background:m.color}}/>
<span style={{fontSize:9,color:m.color,fontWeight:600}}>{m.name}</span>
<span style={{fontSize:8,color:C.dim}}>Age {m.age} • {fmt(m.fv)}</span>
</div>)}
</div>
</Cd>}

{(projView==="charts"||projView==="both")&&<G cols={2} style={{marginBottom:12}}>
<Cd title="Net Worth Growth" accent={C.green}><ResponsiveContainer width="100%" height={200}>
<AreaChart data={cfProj.filter((_,i)=>i%2===0)}><defs><linearGradient id="nwGr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/>
<Area type="monotone" dataKey="netWorth" stroke={C.green} fill="url(#nwGr)" name="Net Worth"/>
{milestones.map((m,i)=><ReferenceLine key={i} x={m.age} stroke={m.color} strokeDasharray="4 2" strokeWidth={1} label={{value:m.name.length>8?m.name.slice(0,8)+"…":m.name,position:"top",fill:m.color,fontSize:7}}/>)}
</AreaChart></ResponsiveContainer></Cd>
<Cd title="Cash Flow Projection" accent={C.blue}><ResponsiveContainer width="100%" height={200}>
<ComposedChart data={cfProj.filter((_,i)=>i%2===0)}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/><Legend wrapperStyle={{fontSize:9}}/>
<Bar dataKey="surplus" fill={C.accent+"60"} name="Surplus"/><Line type="monotone" dataKey="income" stroke={C.green} dot={false} strokeWidth={1.5} name="Income"/><Line type="monotone" dataKey="expenses" stroke={C.red} dot={false} strokeWidth={1.5} name="Expenses"/>
</ComposedChart></ResponsiveContainer></Cd>
</G>}

{(projView==="charts"||projView==="both")&&retDepletion.length>0&&<Cd title="Retirement Corpus Depletion" accent={C.purple} style={{marginBottom:12}}>
<ResponsiveContainer width="100%" height={180}>
<AreaChart data={retDepletion}><defs><linearGradient id="rcGr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.purple} stopOpacity={0.3}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/></linearGradient></defs>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/>
<Area type="monotone" dataKey="corpus" stroke={C.purple} fill="url(#rcGr)" name="Corpus"/>
</AreaChart></ResponsiveContainer></Cd>}

{(projView==="tables"||projView==="both")&&<Cd title="Life Cash Flow" accent={C.green} style={{marginBottom:12}}>
<div style={{maxHeight:350,overflowY:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><TR header cells={["Year","Age","Income","Expenses","EMI","Insurance","Invest","Surplus","Net Worth"]}/></thead>
<tbody>{cfProj.filter((_,i)=>i%2===0).map(r=><TR key={r.year} cells={[r.year,r.age,{v:fmt(r.income),color:C.green},{v:fmt(r.expenses),color:C.red},{v:fmt(r.emi),color:C.orange},{v:fmt(r.insurance),color:C.cyan},{v:fmt(r.investments),color:C.blue},{v:fmt(r.surplus),color:r.surplus>=0?C.accent:C.red},{v:fmt(r.netWorth),color:C.text,bold:true}]} hl={r.age===P.retireAge}/>)}</tbody>
</table></div></Cd>}

{/* Summary */}
<Cd title="📑 Summary" accent={C.accent}>
<Fx style={{marginBottom:10}}><St label="Net Worth" value={fmt(nw)} color={nw>=0?C.green:C.red}/><St label="Income" value={fmt(totI)} color={C.green}/><St label="Surplus" value={fmt(surp)} color={surp>=0?C.green:C.red}/><St label="Insurance Gap" value={fmt(lifeInsAnalysis.additional)} color={lifeInsAnalysis.additional>0?C.red:C.green}/></Fx>
{gAn.length>0&&<table style={{width:"100%",borderCollapse:"collapse",marginBottom:10}}><thead><TR header cells={["Goal","Owner","Age@Goal","Future Value","Assets","Gap","Step-Up SIP"]}/></thead><tbody>
{gAn.map(g=><TR key={g.id} cells={[g.name,{v:g.ownerName,color:C.cyan},g.ageAt+"y",{v:fmt(g.fv),color:C.orange},{v:fmt(g.assetFunded),color:C.blue},{v:fmt(g.gap),color:g.gap>0?C.red:C.green},{v:fmt(g.stepRate>0?g.stepSIP:g.sip),color:C.accent,bold:true}]}/>)}
<TR hl cells={["Total","","",{v:fmt(gAn.reduce((s,g)=>s+g.fv,0)),color:C.orange,bold:true},{v:fmt(gAn.reduce((s,g)=>s+g.assetFunded,0)),color:C.blue,bold:true},{v:fmt(gAn.reduce((s,g)=>s+g.gap,0)),color:C.red,bold:true},{v:fmt(totGoalSIP),color:C.accent,bold:true}]}/></tbody></table>}
<G cols={2}>{[["Retirement Corpus",fmt(retCorpus),C.red],["Corpus Available",fmt(retFunded),C.green],["Retirement Gap",fmt(retGap),retGap>0?C.red:C.green],["Flat SIP",fmt(retSIP),C.dim],["Step-Up SIP",fmt(retStepSIP),C.accent]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.border}22`}}><span style={{fontSize:11,color:C.dim}}>{l}</span><span style={{fontSize:11,fontWeight:700,color:c,fontFamily:F.m}}>{v}</span></div>)}</G>
</Cd></div>}

{!activeId&&tab!=="registry"&&<div style={{textAlign:"center",padding:40,color:C.dim}}>Select a client from the Registry.</div>}

{/* ──── 💚 FINANCIAL HEALTH ──── */}
{tab==="health"&&cl&&<div>
<SH icon="💚" title="Financial Health Report" sub="Personal finance thumb rules — how you measure up"/>
<G cols={3}>
{finHealth.map(h=><Cd key={h.label} accent={h.status==="green"?C.green:h.status==="yellow"?C.orange:C.red}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<div style={{fontSize:13,fontWeight:700}}>{h.icon} {h.label}</div>
<span style={{padding:"3px 8px",borderRadius:10,fontSize:9,fontWeight:700,
  background:h.status==="green"?C.green+"20":h.status==="yellow"?C.orange+"20":C.red+"20",
  color:h.status==="green"?C.green:h.status==="yellow"?C.orange:C.red}}>
  {h.status==="green"?"✓ Healthy":h.status==="yellow"?"⚠ Needs Work":"✕ Critical"}</span>
</div>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
<span style={{fontSize:18,fontWeight:800,fontFamily:F.m,color:h.status==="green"?C.green:h.status==="yellow"?C.orange:C.red}}>{h.value}</span>
<span style={{fontSize:10,color:C.dim,alignSelf:"flex-end"}}>{h.target}</span>
</div>
{/* Progress bar */}
<div style={{height:6,borderRadius:3,background:C.bg,overflow:"hidden",marginBottom:6}}>
<div style={{height:"100%",borderRadius:3,width:`${Math.min(100,Math.max(3,(h.ratio||0)*100))}%`,background:h.status==="green"?C.green:h.status==="yellow"?C.orange:C.red,transition:"width .3s"}}/>
</div>
<div style={{fontSize:9,color:C.dim}}>{h.tip}</div>
</Cd>)}
</G>
{/* 7. Life Timeline Visualization */}
<Cd title="🗺️ Life Timeline" accent={C.accent} style={{marginTop:12}}>
<div style={{position:"relative",padding:"20px 0",overflow:"hidden"}}>
<div style={{height:4,background:C.border,borderRadius:2,position:"relative"}}>
{/* Timeline markers */}
{[{age:selfAge,label:"Now",color:C.green},...milestones].map((m,i)=>{
  const pctPos=Math.min(95,Math.max(2,((m.age-selfAge)/(P.lifeExpect-selfAge))*100));
  return <div key={i} style={{position:"absolute",left:`${pctPos}%`,top:-14,transform:"translateX(-50%)",textAlign:"center"}}>
  <div style={{width:10,height:10,borderRadius:5,background:m.color,border:`2px solid ${C.card}`,margin:"0 auto"}}/>
  <div style={{fontSize:7,color:m.color,fontWeight:600,marginTop:2,whiteSpace:"nowrap"}}>{m.label||m.name}</div>
  <div style={{fontSize:7,color:C.dim}}>{m.age}y</div>
  </div>})}
</div>
<div style={{display:"flex",justifyContent:"space-between",marginTop:20,fontSize:8,color:C.dim}}>
<span>📊 Accumulation Phase ({ytr}y)</span>
<span>🏖️ Distribution Phase ({rYrs}y)</span>
</div>
</div></Cd>
</div>}

{/* ──── 🧮 CALCULATORS (enhanced with SWP + Home Loan) ──── */}
{tab==="calculators"&&cl&&(()=>{
const mr=sipCalc.rate/12,n=sipCalc.years*12;
let plainFV=0;for(let i=0;i<n;i++)plainFV=(plainFV+sipCalc.monthly)*(1+mr);
let stepFV=0,stepInvested=0,curSIP=sipCalc.monthly;
for(let yr=0;yr<sipCalc.years;yr++){for(let mo=0;mo<12;mo++){stepFV=(stepFV+curSIP)*(1+mr);stepInvested+=curSIP;}curSIP*=(1+sipCalc.stepUp);}
const plainInvested=sipCalc.monthly*n;
const lsFV=calcFV(lsCalc.amount,lsCalc.rate,lsCalc.years);
const gcFV=calcFV(goalCalc.cost,goalCalc.inf,goalCalc.years);
const gcExGrown=calcFV(goalCalc.existing,goalCalc.ret,goalCalc.years);
const gcGap=Math.max(0,gcFV-gcExGrown);
const gcFlat=calcSIP(gcGap,goalCalc.ret,goalCalc.years);
const gcStep=calcStepUpSIP(gcGap,goalCalc.ret,goalCalc.years,goalCalc.stepUp);
/* 6. SWP Calculator */
const swpData=(()=>{let c=swpCalc.corpus;const rows=[];for(let y=0;y<swpCalc.years&&c>0;y++){const o=c;const gr=c*swpCalc.retRate;const w=(swpCalc.withdrawal*12)*Math.pow(1+swpCalc.infRate,y);c=o+gr-w;rows.push({year:y+1,opening:Math.round(o),growth:Math.round(gr),withdrawal:Math.round(w),closing:Math.max(0,Math.round(c)),realCorpus:Math.round(Math.max(0,c)/Math.pow(1+swpCalc.infRate,y))});}return rows;})();
const swpSurvives=swpData.length>=swpCalc.years&&swpData[swpData.length-1]?.closing>0;
/* 5. Home Loan vs SIP */
const hlLoan=hlCalc.price*(1-hlCalc.down/100);const hlMR=hlCalc.rate/12;const hlN=hlCalc.tenure*12;
const hlEMI=hlMR>0?hlLoan*hlMR*Math.pow(1+hlMR,hlN)/(Math.pow(1+hlMR,hlN)-1):hlLoan/hlN;
const hlTotalPaid=hlEMI*hlN;const hlTotalInt=hlTotalPaid-hlLoan;
const hlSIPFV=calcSIPFV(hlEMI,hlCalc.sipReturn,hlCalc.tenure);
return <div>
<SH icon="🧮" title="Calculators" sub="SIP, Step-Up, SWP, Home Loan & Goal calculators"/>
<G cols={2}>
<Cd title="📊 SIP & Step-Up Calculator" accent={C.accent}>
<G cols={2}>
<Inp label="Monthly SIP" value={sipCalc.monthly} onChange={v=>setSipCalc({...sipCalc,monthly:v})} prefix="₹"/>
<Inp label="Expected Return" value={rr(sipCalc.rate)} onChange={v=>setSipCalc({...sipCalc,rate:v/100})} suffix="%"/>
<Sel label="Step-Up Rate" value={String(sipCalc.stepUp)} onChange={v=>setSipCalc({...sipCalc,stepUp:parseFloat(v)})} options={STEP_OPTS.map(o=>({v:String(o.v),l:o.l}))}/>
<Inp label="Years" value={sipCalc.years} onChange={v=>setSipCalc({...sipCalc,years:v})} suffix="yrs"/>
</G>
<div style={{marginTop:12,padding:10,background:C.bg,borderRadius:8}}>
<G cols={2}>
<St label="Plain SIP Value" value={fmt(plainFV)} color={C.blue}/>
<St label={`Step-Up ${rr(sipCalc.stepUp)}% Value`} value={fmt(stepFV)} color={C.accent}/>
<St label="Plain Invested" value={fmt(plainInvested)} color={C.dim}/>
<St label="Step-Up Invested" value={fmt(stepInvested)} color={C.dim}/>
<St label="Plain Gain" value={fmt(plainFV-plainInvested)} color={C.green}/>
<St label="Step-Up Gain" value={fmt(stepFV-stepInvested)} color={C.green}/>
</G>
<div style={{marginTop:8,fontSize:10,color:C.accent,fontWeight:600}}>Step-up advantage: +{fmt(stepFV-plainFV)} ({plainFV>0?((stepFV/plainFV-1)*100).toFixed(0):0}% more)</div>
</div></Cd>
<Cd title="💰 Lumpsum Calculator" accent={C.green}>
<G cols={3}>
<Inp label="Lumpsum Amount" value={lsCalc.amount} onChange={v=>setLsCalc({...lsCalc,amount:v})} prefix="₹"/>
<Inp label="Return" value={rr(lsCalc.rate)} onChange={v=>setLsCalc({...lsCalc,rate:v/100})} suffix="%"/>
<Inp label="Years" value={lsCalc.years} onChange={v=>setLsCalc({...lsCalc,years:v})} suffix="yrs"/>
</G>
<div style={{marginTop:12,padding:10,background:C.bg,borderRadius:8}}>
<Fx><St label="Future Value" value={fmt(lsFV)} color={C.green}/><St label="Gain" value={fmt(lsFV-lsCalc.amount)} color={C.accent}/><St label="Multiplier" value={`${(lsFV/(lsCalc.amount||1)).toFixed(1)}x`} color={C.blue}/></Fx>
</div></Cd>
{/* 5. Home Loan vs SIP Calculator */}
<Cd title="🏠 Home Loan vs SIP" accent={C.orange} style={{gridColumn:"1/-1"}}>
<G cols={5}>
<Inp label="Property Price" value={hlCalc.price} onChange={v=>setHlCalc({...hlCalc,price:v})} prefix="₹"/>
<Inp label="Down Payment" value={hlCalc.down} onChange={v=>setHlCalc({...hlCalc,down:v})} suffix="%"/>
<Inp label="Loan Rate" value={rr(hlCalc.rate)} onChange={v=>setHlCalc({...hlCalc,rate:v/100})} suffix="%"/>
<Inp label="Tenure" value={hlCalc.tenure} onChange={v=>setHlCalc({...hlCalc,tenure:v})} suffix="yrs"/>
<Inp label="SIP Return" value={rr(hlCalc.sipReturn)} onChange={v=>setHlCalc({...hlCalc,sipReturn:v/100})} suffix="%"/>
</G>
<div style={{marginTop:12,padding:10,background:C.bg,borderRadius:8}}>
<G cols={2}>
<div>
<div style={{fontSize:10,fontWeight:700,color:C.orange,marginBottom:6}}>🏠 Home Loan</div>
<G cols={2}><St label="Loan Amount" value={fmt(hlLoan)} color={C.text}/><St label="EMI" value={fmt(hlEMI)} color={C.red} sub="/month"/></G>
<G cols={2} style={{marginTop:4}}><St label="Total Paid" value={fmt(hlTotalPaid)} color={C.orange}/><St label="Total Interest" value={fmt(hlTotalInt)} color={C.red}/></G>
</div>
<div>
<div style={{fontSize:10,fontWeight:700,color:C.green,marginBottom:6}}>📈 If EMI = SIP instead</div>
<G cols={2}><St label="SIP Amount" value={fmt(hlEMI)} color={C.blue} sub="/month"/><St label="SIP Return" value={pct(hlCalc.sipReturn)} color={C.green}/></G>
<G cols={2} style={{marginTop:4}}><St label="SIP Corpus" value={fmt(hlSIPFV)} color={C.green}/><St label="vs Interest Paid" value={fmt(hlSIPFV-hlTotalInt)} color={hlSIPFV>hlTotalInt?C.green:C.red} sub={hlSIPFV>hlTotalInt?"SIP wins":"Loan wins"}/></G>
</div>
</G></div></Cd>
{/* 6. SWP Simulator */}
<Cd title="📤 SWP — Systematic Withdrawal Plan" accent={C.purple} style={{gridColumn:"1/-1"}}>
<G cols={5}>
<Inp label="Corpus" value={swpCalc.corpus} onChange={v=>setSwpCalc({...swpCalc,corpus:v})} prefix="₹"/>
<Inp label="Monthly Withdrawal" value={swpCalc.withdrawal} onChange={v=>setSwpCalc({...swpCalc,withdrawal:v})} prefix="₹"/>
<Inp label="Return Rate" value={rr(swpCalc.retRate)} onChange={v=>setSwpCalc({...swpCalc,retRate:v/100})} suffix="%"/>
<Inp label="Inflation" value={rr(swpCalc.infRate)} onChange={v=>setSwpCalc({...swpCalc,infRate:v/100})} suffix="%"/>
<Inp label="Years" value={swpCalc.years} onChange={v=>setSwpCalc({...swpCalc,years:v})} suffix="yrs"/>
</G>
<div style={{marginTop:6,padding:6,borderRadius:6,background:swpSurvives?C.green+"12":C.red+"12",border:`1px solid ${swpSurvives?C.green+"40":C.red+"40"}`}}>
<span style={{fontSize:11,fontWeight:700,color:swpSurvives?C.green:C.red}}>{swpSurvives?`✓ Corpus survives ${swpCalc.years} years — closing: ${fmt(swpData[swpData.length-1]?.closing)}`:`✕ Corpus depleted in year ${swpData.length} of ${swpCalc.years}`}</span>
</div>
{swpData.length>0&&<div style={{marginTop:8}}>
<ResponsiveContainer width="100%" height={180}>
<ComposedChart data={swpData.filter((_,i)=>i%Math.max(1,Math.floor(swpData.length/25))===0||i===swpData.length-1)}>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="year" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/><Legend wrapperStyle={{fontSize:9}}/>
<Area type="monotone" dataKey="closing" stroke={C.purple} fill={C.purple+"20"} name="Nominal Corpus"/>
<Area type="monotone" dataKey="realCorpus" stroke={C.cyan} fill={C.cyan+"10"} name="Real Corpus"/>
<Line type="monotone" dataKey="withdrawal" stroke={C.red} dot={false} strokeWidth={1.5} name="Withdrawal"/>
</ComposedChart></ResponsiveContainer>
<div style={{maxHeight:200,overflowY:"auto",marginTop:6}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><TR header cells={["Year","Opening","Growth","Withdrawal","Closing","Real Value"]}/></thead>
<tbody>{swpData.filter((_,i)=>i%Math.max(1,Math.floor(swpData.length/15))===0||i===swpData.length-1).map(r=><TR key={r.year} cells={[r.year,{v:fmt(r.opening),color:C.blue},{v:fmt(r.growth),color:C.green},{v:fmt(r.withdrawal),color:C.red},{v:fmt(r.closing),color:r.closing>0?C.text:C.red,bold:true},{v:fmt(r.realCorpus),color:C.cyan}]} hl={r.closing<=0}/>)}</tbody>
</table></div></div>}
</Cd>
<Cd title="🎯 Goal Calculator" accent={C.orange} style={{gridColumn:"1/-1"}}>
<G cols={6}>
<Inp label="Goal Cost Today" value={goalCalc.cost} onChange={v=>setGoalCalc({...goalCalc,cost:v})} prefix="₹"/>
<Inp label="Inflation" value={rr(goalCalc.inf)} onChange={v=>setGoalCalc({...goalCalc,inf:v/100})} suffix="%"/>
<Inp label="Years" value={goalCalc.years} onChange={v=>setGoalCalc({...goalCalc,years:v})} suffix="yrs"/>
<Inp label="Existing Savings" value={goalCalc.existing} onChange={v=>setGoalCalc({...goalCalc,existing:v})} prefix="₹"/>
<Inp label="Return" value={rr(goalCalc.ret)} onChange={v=>setGoalCalc({...goalCalc,ret:v/100})} suffix="%"/>
<Sel label="Step-Up" value={String(goalCalc.stepUp)} onChange={v=>setGoalCalc({...goalCalc,stepUp:parseFloat(v)})} options={STEP_OPTS.map(o=>({v:String(o.v),l:o.l}))}/>
</G>
<div style={{marginTop:12,padding:10,background:C.bg,borderRadius:8}}>
<G cols={3}>
<St label="Future Cost" value={fmt(gcFV)} color={C.orange}/><St label="Existing (FV)" value={fmt(gcExGrown)} color={C.blue}/><St label="Gap" value={fmt(gcGap)} color={gcGap>0?C.red:C.green}/>
<St label="Flat SIP Required" value={fmt(gcFlat)} color={C.dim}/><St label={`Step-Up ${rr(goalCalc.stepUp)}% SIP`} value={fmt(gcStep)} color={C.accent}/><St label="Monthly Savings" value={fmt(gcFlat)} color={C.blue} sub="Start with this"/>
</G></div></Cd>
</G></div>})()}

{/* ══════════════════════════════════════════════════════════════════
    🎬 PRESENTATION VIEW — Advisor-to-Client walkthrough
   ══════════════════════════════════════════════════════════════════ */}
{tab==="present"&&cl&&(()=>{
const SL=({num,title,icon,children})=><div style={{marginBottom:24,pageBreakInside:"avoid"}}>
<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:8,borderBottom:`2px solid ${C.accent}33`}}>
<div style={{width:32,height:32,borderRadius:16,background:C.accentBg,border:`2px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:C.accent,fontFamily:F.m,flexShrink:0}}>{num}</div>
<div><div style={{fontSize:16,fontWeight:800,color:C.text}}>{icon} {title}</div></div>
</div>{children}</div>;
const KB=({label,value,color,big})=><div style={{flex:1,minWidth:big?160:100,padding:big?"14px 12px":"10px 8px",background:C.bg,borderRadius:8,borderLeft:`3px solid ${color||C.accent}`}}>
<div style={{fontSize:big?10:8,color:C.dim,textTransform:"uppercase",letterSpacing:".5px"}}>{label}</div>
<div style={{fontSize:big?22:16,fontWeight:800,color:color||C.text,fontFamily:F.m,marginTop:2}}>{value}</div></div>;
const AG=({items})=><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{items.map(([l,v,c],i)=><KB key={i} label={l} value={v} color={c}/>)}</div>;
const goodBad=(v,good)=>v?C.green:C.red;
const healthG=finHealth.filter(h=>h.status==="green").length;
const healthY=finHealth.filter(h=>h.status==="yellow").length;
const healthR=finHealth.filter(h=>h.status==="red").length;
return <div style={{maxWidth:900,margin:"0 auto"}}>
{/* Header */}
<div style={{textAlign:"center",padding:"20px 0 30px",borderBottom:`2px solid ${C.accent}`}}>
<div style={{fontSize:11,color:C.accent,textTransform:"uppercase",letterSpacing:"2px",fontWeight:600}}>Financial Planning Review</div>
<div style={{fontSize:28,fontWeight:900,color:C.text,marginTop:6}}>{P.name||cl.name}</div>
<div style={{fontSize:12,color:C.dim,marginTop:4}}>Age {selfAge} • {P.work} • Prepared {new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div>
{P.spouseName&&<div style={{fontSize:11,color:C.dim}}>Spouse: {P.spouseName} (Age {spAge}){(P.children||[]).length>0?` • ${P.children.length} child${P.children.length>1?"ren":""}`:"" }</div>}
</div>

{/* SLIDE 1: Where You Stand Today */}
<SL num={1} title="Where You Stand Today" icon="📊">
<AG items={[["Net Worth",fmt(nw),nw>=0?C.green:C.red],["Monthly Income",fmt(totI),C.green],["Monthly Expenses",fmt(totE),C.red],["Monthly Savings",fmt(sav),sav>0?C.green:C.red],["Surplus after SIPs",fmt(surp),surp>=0?C.green:C.red]]}/>
<div style={{marginTop:10,padding:10,background:C.bg,borderRadius:8}}>
<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
<span style={{color:C.dim}}>Total Assets</span><span style={{color:C.green,fontWeight:700,fontFamily:F.m}}>{fmt(totA)}</span></div>
<div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:4}}>
<span style={{color:C.dim}}>Total Liabilities</span><span style={{color:C.red,fontWeight:700,fontFamily:F.m}}>{fmt(totL)}</span></div>
</div></SL>

{/* SLIDE 2: Portfolio & Asset Allocation */}
<SL num={2} title="Portfolio & Asset Allocation" icon="💼">
<div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
<div style={{flex:1,minWidth:200}}>
{allocData.length>0?<ResponsiveContainer width="100%" height={180}>
<PieChart><Pie data={allocData} cx="50%" cy="50%" outerRadius={70} innerRadius={30} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
{allocData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip content={<ChTip/>}/></PieChart></ResponsiveContainer>
:<div style={{padding:20,textAlign:"center",color:C.dim}}>No portfolio data</div>}
</div>
<div style={{flex:1,minWidth:200}}>
<AG items={[["Equity",fmt(eqTotal),C.green],["Fixed Income",fmt(fiTotal),C.blue],["Retirement Accts",fmt(retAccts),C.purple],["Cash & Others",fmt(cashTotal+commodTotal),C.accent]]}/>
<div style={{marginTop:8,fontSize:10,color:C.dim}}>Monthly SIP contributions: <span style={{color:C.blue,fontWeight:700}}>{fmt(sipMo)}</span></div>
</div></div></SL>

{/* SLIDE 3: Risk Profile */}
<SL num={3} title="Risk Profile" icon="🎯">
<div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
<div style={{width:100,height:100,borderRadius:50,background:`${rProf.color||C.accent}18`,border:`3px solid ${rProf.color||C.accent}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
<div style={{fontSize:24,fontWeight:900,fontFamily:F.m,color:rProf.color||C.accent}}>{rScore}</div>
<div style={{fontSize:8,color:C.dim}}>/{RISK_QS.length*10}</div>
</div>
<div style={{flex:1}}>
<div style={{fontSize:20,fontWeight:800,color:rProf.color||C.accent}}>{rProf.n}</div>
<div style={{fontSize:11,color:C.dim,marginTop:4,lineHeight:1.5}}>{rProf.desc||""}</div>
{rProf.alloc&&<div style={{display:"flex",gap:6,marginTop:8}}>
{Object.entries(rProf.alloc).map(([k,v])=><div key={k} style={{padding:"4px 10px",borderRadius:4,fontSize:10,fontWeight:700,background:`${k==="equity"?C.green:k==="debt"?C.blue:k==="gold"?C.accent:C.cyan}15`,color:k==="equity"?C.green:k==="debt"?C.blue:k==="gold"?C.accent:C.cyan}}>{k}: {v}%</div>)}
</div>}
</div></div></SL>

{/* SLIDE 4: Financial Health Scorecard */}
<SL num={4} title="Financial Health Scorecard" icon="💚">
<div style={{display:"flex",gap:8,marginBottom:12}}>
<KB label="Healthy" value={healthG} color={C.green} big/><KB label="Needs Work" value={healthY} color={C.orange} big/><KB label="Critical" value={healthR} color={C.red} big/>
</div>
<G cols={3}>{finHealth.map(h=><div key={h.label} style={{padding:10,borderRadius:8,background:C.bg,borderLeft:`3px solid ${h.status==="green"?C.green:h.status==="yellow"?C.orange:C.red}`}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontSize:11,fontWeight:700}}>{h.icon} {h.label}</span>
<span style={{fontSize:9,fontWeight:700,color:h.status==="green"?C.green:h.status==="yellow"?C.orange:C.red}}>{h.status==="green"?"✓":h.status==="yellow"?"⚠":"✕"}</span>
</div>
<div style={{fontSize:14,fontWeight:800,fontFamily:F.m,color:h.status==="green"?C.green:h.status==="yellow"?C.orange:C.red,marginTop:4}}>{h.value}</div>
<div style={{fontSize:8,color:C.dim,marginTop:2}}>Target: {h.target}</div>
</div>)}</G></SL>

{/* SLIDE 5: Insurance Analysis */}
<SL num={5} title="Insurance Analysis" icon="🛡️">
<AG items={[["Gross Need",fmt(lifeInsAnalysis.grossNeed),C.orange],["Existing Cover",fmt(lifeInsAnalysis.existingCover),C.green],["Existing Assets",fmt(lifeInsAnalysis.existingAssets),C.blue],["Additional Required",fmt(lifeInsAnalysis.additional),lifeInsAnalysis.additional>0?C.red:C.green]]}/>
{lifeInsAnalysis.additional>0&&<div style={{marginTop:8,padding:8,background:C.red+"10",borderRadius:6,border:`1px solid ${C.red}30`,fontSize:11,color:C.red}}>
⚠ Action: Purchase additional term insurance of <span style={{fontWeight:700}}>{fmt(lifeInsAnalysis.additional)}</span> sum assured.
</div>}
{lifeInsAnalysis.additional<=0&&<div style={{marginTop:8,padding:8,background:C.green+"10",borderRadius:6,border:`1px solid ${C.green}30`,fontSize:11,color:C.green}}>
✓ Adequate: Life insurance coverage meets requirements.
</div>}
</SL>

{/* SLIDE 6: Goal Planning with Achievement Progress */}
<SL num={6} title="Goal Planning — Achievement Status" icon="🎯">
{gAn.length>0?<div>
{/* Per-goal achievement cards with progress bars */}
<G cols={2} style={{marginBottom:10}}>
{gAn.map(g=>{const mc=goalMC.find(m=>m.id===g.id);const fundPct=g.fv>0?Math.min(100,(g.totalFunded/g.fv)*100):0;
return <div key={g.id} style={{padding:10,background:C.bg,borderRadius:8,borderLeft:`3px solid ${g.priority==="High"?C.red:g.priority==="Medium"?C.orange:C.blue}`}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
<div style={{fontSize:11,fontWeight:700}}>{g.name}</div>
<span style={{fontSize:9,color:C.cyan}}>{g.ownerName} • {g.ageAt}y</span>
</div>
<div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.dim,marginBottom:4}}>
<span>Goal: {fmt(g.fv)}</span><span>Funded: {fmt(g.totalFunded)} ({fundPct.toFixed(0)}%)</span>
</div>
{/* Progress bar */}
<div style={{height:8,borderRadius:4,background:C.card,overflow:"hidden",marginBottom:6}}>
<div style={{height:"100%",borderRadius:4,background:fundPct>=100?C.green:fundPct>=50?C.accent:C.orange,width:`${Math.max(2,fundPct)}%`,transition:"width .3s"}}/>
</div>
<div style={{display:"flex",justifyContent:"space-between",fontSize:9}}>
<span style={{color:g.gap>0?C.red:C.green}}>Gap: {fmt(g.gap)}</span>
<span style={{color:C.accent}}>SIP: {fmt(g.stepRate>0?g.stepSIP:g.sip)}/mo</span>
{mc&&<span style={{color:mc.mcProb>=75?C.green:mc.mcProb>=50?C.orange:C.red}}>🎲 {mc.mcProb}%</span>}
</div></div>})}
</G>
{/* Summary table */}
<div style={{overflowX:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse",marginBottom:8}}>
<thead><TR header cells={["Goal","Owner","Age","Future Value","Funded","% Achieved","Gap","SIP/mo","🎲 Prob"]}/></thead>
<tbody>{gAn.map(g=>{const mc=goalMC.find(m=>m.id===g.id);const fundPct=g.fv>0?((g.totalFunded/g.fv)*100).toFixed(0):0;return <TR key={g.id} cells={[
g.name,{v:g.ownerName,color:C.cyan},g.ageAt+"y",
{v:fmt(g.fv),color:C.orange},{v:fmt(g.totalFunded),color:C.blue},
{v:`${fundPct}%`,color:fundPct>=100?C.green:fundPct>=50?C.accent:C.red,bold:true},
{v:fmt(g.gap),color:g.gap>0?C.red:C.green},
{v:fmt(g.stepRate>0?g.stepSIP:g.sip),color:C.accent,bold:true},
{v:mc?`${mc.mcProb}%`:"—",color:mc&&mc.mcProb>=75?C.green:mc&&mc.mcProb>=50?C.orange:C.red}
]}/>})}
<TR hl cells={["Total","","",{v:fmt(gAn.reduce((s,g)=>s+g.fv,0)),color:C.orange,bold:true},{v:fmt(gAn.reduce((s,g)=>s+g.totalFunded,0)),color:C.blue,bold:true},"",{v:fmt(gAn.reduce((s,g)=>s+g.gap,0)),color:C.red,bold:true},{v:fmt(totGoalSIP),color:C.accent,bold:true},""]}/></tbody></table></div>
{surp<totGoalSIP&&<div style={{padding:8,background:C.red+"10",borderRadius:6,border:`1px solid ${C.red}30`,fontSize:11,color:C.red}}>
⚠ Current surplus ({fmt(surp)}) is {fmt(totGoalSIP-surp)} short of required goal SIPs.
</div>}
{/* Goal funding bar chart */}
{gAn.length>0&&<div style={{marginTop:8}}><ResponsiveContainer width="100%" height={160}>
<BarChart data={gAn.map(g=>({name:g.name.length>10?g.name.slice(0,10)+"…":g.name,FV:Math.round(g.fv),Funded:Math.round(g.totalFunded),Gap:Math.round(g.gap)}))}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/><Legend wrapperStyle={{fontSize:9}}/>
<Bar dataKey="FV" fill={C.orange} radius={[3,3,0,0]}/><Bar dataKey="Funded" fill={C.blue} radius={[3,3,0,0]}/><Bar dataKey="Gap" fill={C.red} radius={[3,3,0,0]}/>
</BarChart></ResponsiveContainer></div>}
</div>:<div style={{padding:16,textAlign:"center",color:C.dim}}>No goals created yet.</div>}
</SL>

{/* SLIDE 7: Retirement Readiness */}
<SL num={7} title="Retirement Readiness" icon="🏖️">
<AG items={[["Retire Age",P.retireAge+"y",C.purple],["Years Left",ytr+"y",C.text],["Corpus Required",fmt(retCorpus),C.red],["Corpus Available",fmt(retFunded),C.green],["Gap",fmt(retGap),retGap>0?C.red:C.green],["Monthly SIP",fmt(retSIP),C.accent]]}/>
{retMC&&<div style={{marginTop:10,padding:10,background:C.bg,borderRadius:8}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<div style={{width:60,height:60,borderRadius:30,background:`${retMC.successRate>=75?C.green:retMC.successRate>=50?C.orange:C.red}18`,border:`3px solid ${retMC.successRate>=75?C.green:retMC.successRate>=50?C.orange:C.red}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,fontFamily:F.m,color:retMC.successRate>=75?C.green:retMC.successRate>=50?C.orange:C.red}}>{retMC.successRate}%</div>
<div><div style={{fontSize:12,fontWeight:700}}>Monte Carlo Success Probability</div>
<div style={{fontSize:10,color:C.dim}}>{retMC.successRate>=75?"Strong confidence in meeting retirement goal.":retMC.successRate>=50?"Moderate — consider increasing SIP or adjusting timeline.":"Low probability — significant action needed."}</div>
</div></div></div>}
{/* Corpus depletion chart */}
{retDepletion.length>0&&<div style={{marginTop:10}}>
<div style={{fontSize:10,fontWeight:700,color:C.dim,marginBottom:4}}>Post-Retirement Corpus Depletion</div>
<ResponsiveContainer width="100%" height={160}>
<ComposedChart data={retDepletion}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/><Legend wrapperStyle={{fontSize:8}}/>
<Area type="monotone" dataKey="corpus" stroke={C.purple} fill={C.purple+"18"} name="Corpus"/>
<Line type="monotone" dataKey="expense" stroke={C.red} dot={false} strokeWidth={1} name="Expense"/>
<Line type="monotone" dataKey="income" stroke={C.green} dot={false} strokeWidth={1} name="Income"/>
</ComposedChart></ResponsiveContainer></div>}
{retGap>0&&<div style={{marginTop:8,padding:8,background:C.red+"10",borderRadius:6,border:`1px solid ${C.red}30`,fontSize:11,color:C.red}}>
⚠ Action: Start additional SIP of <span style={{fontWeight:700}}>{fmt(retSIP)}</span>/month (or {fmt(retStepSIP)} with 10% annual step-up) to close the retirement gap.
</div>}
{retGap<=0&&<div style={{marginTop:8,padding:8,background:C.green+"10",borderRadius:6,border:`1px solid ${C.green}30`,fontSize:11,color:C.green}}>
✓ On track: Current investments and SIPs are projected to meet retirement corpus.
</div>}
</SL>

{/* SLIDE 8: Cash Flow Projection */}
<SL num={8} title="Cash Flow Projection" icon="💵">
{cfProj.length>1&&<div>
<div style={{marginBottom:8}}>
<AG items={[["Current Income",fmt(totI)+"/mo",C.green],["At Retirement",fmt(cfProj.find(r=>r.age===P.retireAge)?.income||0)+"/yr",C.blue],["Current Expenses",fmt(totE)+"/mo",C.red],["Retirement Expense",fmt(retEF)+"/yr",C.orange]]}/>
</div>
<ResponsiveContainer width="100%" height={200}>
<ComposedChart data={cfProj.filter((_,i)=>i%2===0)} margin={{top:8,right:8,bottom:5,left:8}}>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/><Legend wrapperStyle={{fontSize:9}}/>
<Bar dataKey="surplus" fill={C.accent+"50"} name="Surplus"/>
<Line type="monotone" dataKey="income" stroke={C.green} dot={false} strokeWidth={1.5} name="Income"/>
<Line type="monotone" dataKey="expenses" stroke={C.red} dot={false} strokeWidth={1.5} name="Expenses"/>
<ReferenceLine x={P.retireAge} stroke={C.purple} strokeWidth={2} strokeDasharray="4 2" label={{value:"Retire",position:"top",fill:C.purple,fontSize:8}}/>
</ComposedChart></ResponsiveContainer>
<div style={{fontSize:9,color:C.dim,marginTop:4}}>
Pre-retirement: income grows at {pct(P.incGrowth)}, expenses at {pct(A.inflation)}. Post-retirement: expenses inflated, income from pension/rental.
</div></div>}
</SL>

{/* SLIDE 9: Net Worth Growth */}
<SL num={9} title="Net Worth Growth" icon="📈">
{cfProj.length>1&&<div>
<div style={{marginBottom:8}}>
<AG items={[["Today",fmt(nw),nw>=0?C.green:C.red],["At Retirement",fmt(cfProj.find(r=>r.age===P.retireAge)?.netWorth||0),C.green],["Peak",fmt(Math.max(...cfProj.map(r=>r.netWorth))),C.accent]]}/>
</div>
<ResponsiveContainer width="100%" height={200}>
<AreaChart data={cfProj.filter((_,i)=>i%2===0)} margin={{top:8,right:8,bottom:5,left:8}}>
<defs><linearGradient id="prNw2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.25}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/>
<Area type="monotone" dataKey="netWorth" stroke={C.green} fill="url(#prNw2)" strokeWidth={2} name="Net Worth"/>
{milestones.map((m,i)=><ReferenceLine key={i} x={m.age} stroke={m.color} strokeDasharray="3 3" strokeWidth={1} label={{value:m.name.length>8?m.name.slice(0,8)+"…":m.name,position:"top",fill:m.color,fontSize:7}}/>)}
</AreaChart></ResponsiveContainer></div>}
</SL>

{/* SLIDE 10: Life Journey Timeline */}
<SL num={10} title="Life Milestone Journey" icon="🗺️">
{cfProj.length>1&&<ResponsiveContainer width="100%" height={220}>
<ComposedChart data={cfProj.filter((_,i)=>i%3===0)} margin={{top:16,right:8,bottom:5,left:8}}>
<defs><linearGradient id="prNw3" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.2}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
<CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="age" tick={{fontSize:8,fill:C.dim}} axisLine={false}/><YAxis tick={{fontSize:8,fill:C.dim}} axisLine={false} tickFormatter={v=>fmt(v)}/><Tooltip content={<ChTip/>}/>
<Area type="monotone" dataKey="netWorth" stroke={C.green} fill="url(#prNw3)" strokeWidth={2} name="Net Worth"/>
<Line type="monotone" dataKey="income" stroke={C.blue} dot={false} strokeWidth={1} strokeDasharray="4 2" name="Income"/>
<Line type="monotone" dataKey="expenses" stroke={C.red} dot={false} strokeWidth={1} strokeDasharray="4 2" name="Expenses"/>
{milestones.map((m,i)=><ReferenceLine key={i} x={m.age} stroke={m.color} strokeDasharray="3 3" strokeWidth={1.5} label={{value:m.name.length>10?m.name.slice(0,10)+"…":m.name,position:"insideTopRight",fill:m.color,fontSize:7,fontWeight:700}}/>)}
</ComposedChart></ResponsiveContainer>}
<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
{milestones.map((m,i)=><span key={i} style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:`${m.color}15`,color:m.color}}>{m.name} — Age {m.age} — {fmt(m.fv)}</span>)}
</div></SL>

{/* SLIDE 11: Detailed Action Plan */}
<SL num={11} title="Your Action Plan" icon="✅">
<div style={{display:"flex",flexDirection:"column",gap:10}}>

{/* ── INSURANCE ── */}
<div style={{padding:10,borderRadius:8,background:C.bg,borderLeft:`3px solid ${lifeInsAnalysis.additional>0?C.red:C.green}`}}>
<div style={{fontSize:11,fontWeight:700,color:lifeInsAnalysis.additional>0?C.red:C.green}}>🛡️ {lifeInsAnalysis.additional>0?`Buy Term Insurance — ${fmt(lifeInsAnalysis.additional)} cover`:"✓ Insurance — Adequate coverage"}</div>
<div style={{fontSize:9,color:C.dim}}>{lifeInsAnalysis.additional>0?`Current cover ${fmt(lifeInsAnalysis.existingCover)} is short by ${fmt(lifeInsAnalysis.additional)}. Get pure term plan.`:`Existing cover of ${fmt(lifeInsAnalysis.existingCover)} meets the need.`}</div>
</div>

{/* ── PER-GOAL ACTIONS ── */}
{gAn.length>0&&<div style={{padding:12,borderRadius:8,background:C.accent+"06",border:`1px solid ${C.accent}18`}}>
<div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:8}}>🎯 Goal-wise Action Plan</div>
{gAn.map(g=>{const mc=goalMC.find(m=>m.id===g.id);const fundPct=g.fv>0?((g.totalFunded/g.fv)*100):0;const sipNeeded=g.stepRate>0?g.stepSIP:g.sip;const isOk=g.gap<=0;const color=isOk?C.green:fundPct>=50?C.orange:C.red;
return <div key={g.id} style={{padding:8,borderRadius:6,background:C.bg,borderLeft:`3px solid ${color}`,marginBottom:6}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontSize:11,fontWeight:700,color:color}}>{isOk?"✓":"⚠"} {g.name} — {g.ownerName}</span>
{mc&&mc.mcProb>0&&<span style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:`${mc.mcProb>=75?C.green:mc.mcProb>=50?C.orange:C.red}18`,color:mc.mcProb>=75?C.green:mc.mcProb>=50?C.orange:C.red,fontWeight:700}}>🎲 {mc.mcProb}%</span>}
</div>
<div style={{display:"flex",gap:14,marginTop:4,fontSize:9,color:C.dim,flexWrap:"wrap"}}>
<span>Target: {fmt(g.fv)} at age {g.ageAt} ({g.yrsCalc||g.yrs}y)</span>
<span>Funded: {fmt(g.totalFunded)} ({fundPct.toFixed(0)}%)</span>
{g.gap>0&&<span style={{color:C.red,fontWeight:600}}>Gap: {fmt(g.gap)}</span>}
</div>
{g.gap>0&&<div style={{marginTop:4,fontSize:10,color:C.accent,fontWeight:600}}>
→ Start SIP: {fmt(sipNeeded)}/mo {g.stepRate>0?`(${rr(g.stepRate)}% annual step-up)`:"(flat)"}
{g.stepRate===0&&<span style={{color:C.dim,fontWeight:400}}> | 10% step-up option: {fmt(calcStepUpSIP(g.gap,g.ret,g.yrsCalc||g.yrs,.10))}/mo</span>}
</div>}
{g.gap<=0&&<div style={{marginTop:4,fontSize:10,color:C.green}}>✓ Fully funded — no additional SIP needed</div>}
</div>})}
<div style={{marginTop:8,padding:8,background:C.card,borderRadius:6,display:"flex",justifyContent:"space-between",fontSize:10}}>
<span style={{color:C.dim}}>Total goal SIPs: <span style={{color:C.accent,fontWeight:700}}>{fmt(totGoalSIP)}/mo</span></span>
<span style={{color:surp>=totGoalSIP?C.green:C.red}}>{surp>=totGoalSIP?`✓ Covered by surplus (${fmt(surp)})`:`⚠ Short by ${fmt(totGoalSIP-surp)}/mo`}</span>
</div>
</div>}

{/* ── RETIREMENT — with 3 options ── */}
<div style={{padding:12,borderRadius:8,background:retGap>0?C.red+"06":C.green+"06",border:`1px solid ${retGap>0?C.red:C.green}18`}}>
<div style={{fontSize:12,fontWeight:700,color:retGap>0?C.orange:C.green,marginBottom:8}}>🏖️ Retirement Plan</div>
<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
<KB label="Required" value={fmt(retCorpus)} color={C.red}/>
<KB label="Available" value={fmt(retFunded)} color={C.green}/>
<KB label="Gap" value={fmt(retGap)} color={retGap>0?C.red:C.green}/>
{retMC&&<KB label="MC Success" value={`${retMC.successRate}%`} color={retMC.successRate>=75?C.green:retMC.successRate>=50?C.orange:C.red}/>}
</div>
{retGap>0?<div>
<div style={{fontSize:10,fontWeight:600,marginBottom:6}}>Options to close {fmt(retGap)} gap over {ytr} years:</div>
{[["Flat SIP",retSIP,"Same amount monthly"],["10% Step-up",retStepSIP,"Increase 10% yearly"],["15% Step-up",calcStepUpSIP(retGap,ytr>10?A.equity:(A.equity+A.debt)/2,ytr,.15),"Increase 15% yearly"]].map(([label,amt,desc])=>
<div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 8px",borderRadius:4,background:C.bg,marginBottom:3}}>
<div><div style={{fontSize:10,fontWeight:600}}>{label}</div><div style={{fontSize:8,color:C.dim}}>{desc}</div></div>
<span style={{fontSize:13,fontWeight:800,color:C.accent,fontFamily:F.m}}>{fmt(amt)}/mo</span>
</div>)}
</div>
:<div style={{fontSize:11,color:C.green}}>✓ On track — current investments meet the target of {fmt(retCorpus)}.</div>}
</div>

{/* ── FINANCIAL HEALTH fixes ── */}
{(healthR>0||healthY>0)&&<div style={{padding:12,borderRadius:8,background:C.bg,border:`1px solid ${C.border}`}}>
<div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:6}}>💚 Financial Health Fixes</div>
{finHealth.filter(h=>h.status!=="green").map(h=><div key={h.label} style={{padding:6,borderLeft:`3px solid ${h.status==="red"?C.red:C.orange}`,paddingLeft:10,marginBottom:4}}>
<div style={{fontSize:10,fontWeight:700,color:h.status==="red"?C.red:C.orange}}>{h.status==="red"?"Fix":"Improve"}: {h.label}</div>
<div style={{fontSize:9,color:C.dim}}>{h.tip}. Current: {h.value} → Target: {h.target}</div>
</div>)}</div>}

{/* ── ALL CLEAR ── */}
{healthR===0&&healthY===0&&retGap<=0&&lifeInsAnalysis.additional<=0&&gAn.every(g=>g.gap<=0)&&<div style={{padding:14,borderRadius:8,background:C.green+"10",border:`1px solid ${C.green}30`,textAlign:"center"}}>
<div style={{fontSize:14,fontWeight:700,color:C.green}}>✓ Excellent Financial Health</div>
<div style={{fontSize:11,color:C.dim,marginTop:4}}>All goals funded, retirement on track, insurance adequate. Review annually.</div>
</div>}

{/* ── TOTAL COMMITMENT TABLE ── */}
<div style={{padding:12,borderRadius:8,background:C.accent+"08",border:`1px solid ${C.accent}25`}}>
<div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:8}}>📊 Monthly Commitment Summary</div>
<table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
{[["Existing Portfolio SIPs",fmt(sipMo),C.blue],
["Goal SIPs Required",fmt(totGoalSIP),C.orange],
["Retirement SIP Required",fmt(retGap>0?retSIP:0),retGap>0?C.red:C.green],
["Total SIP Required",fmt(totGoalSIP+(retGap>0?retSIP:0)),C.accent],
["Monthly Surplus",fmt(surp),surp>=0?C.green:C.red],
["Additional Needed",fmt(Math.max(0,(totGoalSIP+(retGap>0?retSIP:0))-surp)),(totGoalSIP+(retGap>0?retSIP:0))>surp?C.red:C.green]
].map(([l,v,c])=><tr key={l}><td style={{padding:"4px 0",fontSize:10,color:C.dim,borderBottom:`1px solid ${C.border}22`}}>{l}</td><td style={{padding:"4px 0",fontSize:11,fontWeight:700,color:c,fontFamily:F.m,textAlign:"right",borderBottom:`1px solid ${C.border}22`}}>{v}</td></tr>)}
</tbody></table>
{(totGoalSIP+(retGap>0?retSIP:0))>surp&&<div style={{marginTop:6,fontSize:10,color:C.orange}}>
💡 Bridge the gap: increase income by {fmt((totGoalSIP+(retGap>0?retSIP:0))-surp)}/mo, reduce discretionary expenses, or extend goal timelines.
</div>}
</div>
</div></SL>

{/* Footer */}
<div style={{textAlign:"center",padding:"20px 0",borderTop:`1px solid ${C.border}`,marginTop:20}}>
<div style={{fontSize:9,color:C.dim}}>Prepared by Fund Your Goals • {new Date().toLocaleDateString("en-IN")} • This is a projection based on assumed returns and may vary.</div>
</div>
</div>})()}

</div></div>);
}
