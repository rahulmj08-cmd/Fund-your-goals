'use client'
const C={bg:'#0F172A',text:'#F1F5F9',text2:'#94A3B8',blue:'#3B82F6',gold:'#D4A843',border:'rgba(255,255,255,0.08)'}
export default function Disclaimer(){return(
<div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.text}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');`}</style>
<div style={{padding:'14px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(15,23,42,.95)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:10}}>
  <a href="/" style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:C.text,textDecoration:'none'}}>Fund Your <span style={{color:C.blue}}>Goals</span></a>
  <a href="/" style={{fontSize:12,color:C.text2,textDecoration:'none'}}>← Back to Home</a>
</div>
<div style={{maxWidth:720,margin:'0 auto',padding:'60px 24px 80px'}}>
  <div style={{fontSize:11,fontWeight:700,color:C.blue,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>Legal</div>
  <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:700,marginBottom:8}}>Disclaimer</h1>
  <p style={{fontSize:13,color:C.text2,marginBottom:40}}>Last updated: April 2026</p>

  <div style={{fontSize:15,color:C.text2,lineHeight:1.9}}>
    <div style={{padding:20,borderRadius:12,background:'rgba(244,63,94,.06)',border:'1px solid rgba(244,63,94,.12)',marginBottom:32}}>
      <p style={{fontWeight:600,color:C.text,marginBottom:8}}>⚠️ Important Notice</p>
      <p>Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully before investing.</p>
    </div>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>No Guarantee of Returns</h2>
    <p style={{marginBottom:24}}>Past performance is not indicative of future returns. There is no guarantee of returns or capital protection on any investment made through our services.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Role as Distributor</h2>
    <p style={{marginBottom:24}}>FundYourGoals acts as a mutual fund distributor registered with AMFI (ARN-266912) and does not act as an investment advisor. All recommendations are based on mutual fund distribution guidelines and are intended to help clients make informed decisions.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Investment Decisions</h2>
    <p style={{marginBottom:24}}>Investment decisions should be made based on your individual financial goals, risk appetite, and investment horizon. You are solely responsible for your investment decisions. We encourage you to consult with a qualified financial advisor if needed.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Commission Disclosure</h2>
    <p style={{marginBottom:24}}>We may earn commissions from Asset Management Companies (AMCs) for distribution services. This is a standard industry practice and is governed by SEBI and AMFI regulations.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Platform Partner</h2>
    <p style={{marginBottom:24}}>Investment transactions and reporting are facilitated through our platform partner, Wealthy.in. FundYourGoals is not responsible for any technical issues or service disruptions on the platform side.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Contact</h2>
    <p>For any queries regarding this disclaimer, reach us via WhatsApp at <a href="https://wa.me/919663327789" style={{color:C.blue,textDecoration:'none'}}>+91 96633 27789</a>.</p>
  </div>
</div>
</div>
)}
