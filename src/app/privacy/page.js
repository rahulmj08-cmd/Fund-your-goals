'use client'
const C={bg:'#0F172A',text:'#F1F5F9',text2:'#94A3B8',blue:'#3B82F6',gold:'#D4A843',border:'rgba(255,255,255,0.08)'}
export default function Privacy(){return(
<div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.text}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');`}</style>
<div style={{padding:'14px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(15,23,42,.95)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:10}}>
  <a href="/" style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:C.text,textDecoration:'none'}}>Fund Your <span style={{color:C.blue}}>Goals</span></a>
  <a href="/" style={{fontSize:12,color:C.text2,textDecoration:'none'}}>← Back to Home</a>
</div>
<div style={{maxWidth:720,margin:'0 auto',padding:'60px 24px 80px'}}>
  <div style={{fontSize:11,fontWeight:700,color:C.blue,textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>Legal</div>
  <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:700,marginBottom:8}}>Privacy Policy</h1>
  <p style={{fontSize:13,color:C.text2,marginBottom:40}}>Last updated: April 2026</p>

  <div style={{fontSize:15,color:C.text2,lineHeight:1.9}}>
    <p style={{marginBottom:24}}>We value your privacy and are committed to protecting your personal information.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Information We Collect</h2>
    <p style={{marginBottom:24}}>Any data shared with us, including your name, contact details, and financial information, is used solely for the purpose of providing mutual fund distribution and related services.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>How We Use Your Data</h2>
    <p style={{marginBottom:24}}>Your information is used to understand your financial goals, recommend suitable mutual fund schemes, process transactions through our platform partner, and provide ongoing service and support.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Data Sharing</h2>
    <p style={{marginBottom:24}}>We do not sell your personal information to third parties. However, your data may be shared with trusted service providers such as Asset Management Companies (AMCs), our platform partner Wealthy.in, or regulatory authorities, as required for service delivery and compliance.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Data Security</h2>
    <p style={{marginBottom:24}}>We implement reasonable security measures to safeguard your data against unauthorized access and misuse. All data transmission is encrypted using industry-standard SSL technology.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Cookies</h2>
    <p style={{marginBottom:24}}>Our website may use basic cookies to improve your browsing experience and analyse website traffic. These cookies do not store personally identifiable information.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Your Consent</h2>
    <p style={{marginBottom:24}}>By using our website and services, you consent to the collection and use of your information as described in this policy. You may contact us at any time to request access to, correction of, or deletion of your personal data.</p>

    <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:12,marginTop:36}}>Contact</h2>
    <p>For any privacy-related queries, reach us via WhatsApp at <a href="https://wa.me/919663327789" style={{color:C.blue,textDecoration:'none'}}>+91 96633 27789</a>.</p>
  </div>
</div>
</div>
)}
