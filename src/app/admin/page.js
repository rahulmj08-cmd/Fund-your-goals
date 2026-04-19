'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'

const Planner = dynamic(() => import('./planner'), { 
  ssr: false,
  loading: () => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0a0a10',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:32,marginBottom:12}}>📊</div>
        <div style={{fontSize:16,fontWeight:700,color:'#e4e2df'}}>Loading Fund Your Goals...</div>
        <div style={{fontSize:11,color:'#5e5e70',marginTop:4}}>Financial Planning Suite</div>
      </div>
    </div>
  )
})

const GOOGLE_CLIENT_ID = '558198233669-86qivi9ec7p2vk2vqrk9b69dal4pt43u.apps.googleusercontent.com'
const ALLOWED_EMAIL = 'rahulmj08@gmail.com'

export default function AdminPage() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [gsiLoaded, setGsiLoaded] = useState(false)

  // Check saved session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('fyg_admin_user')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.email === ALLOWED_EMAIL) {
          setUser(parsed)
        }
      }
    } catch {}
    setChecking(false)
  }, [])

  // Handle Google credential response
  const handleCredentialResponse = useCallback((response) => {
    try {
      // Decode JWT token (Google ID token is a JWT)
      const payload = JSON.parse(atob(response.credential.split('.')[1]))
      const email = payload.email
      const name = payload.name
      const picture = payload.picture

      if (email === ALLOWED_EMAIL) {
        const userData = { email, name, picture }
        sessionStorage.setItem('fyg_admin_user', JSON.stringify(userData))
        setUser(userData)
        setError('')
      } else {
        setError(`Access denied. ${email} is not authorized.`)
      }
    } catch (e) {
      setError('Login failed. Please try again.')
    }
  }, [])

  // Initialize Google Sign-In when GSI script loads
  useEffect(() => {
    if (!gsiLoaded || user) return
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      })
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { 
          theme: 'filled_black', 
          size: 'large', 
          width: 300,
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'left'
        }
      )
    }
  }, [gsiLoaded, user, handleCredentialResponse])

  const handleLogout = () => {
    sessionStorage.removeItem('fyg_admin_user')
    setUser(null)
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }

  if (checking) return null

  // ═══ LOGIN SCREEN ═══
  if (!user) return (
    <>
      <Script 
        src="https://accounts.google.com/gsi/client" 
        onLoad={() => setGsiLoaded(true)}
        strategy="afterInteractive"
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes orbFloat{0%,100%{transform:translate(0,0)}50%{transform:translate(15px,-10px)}}
        .login-orb{position:fixed;border-radius:50%;filter:blur(80px);pointer-events:none;animation:orbFloat 18s ease-in-out infinite}
        .a1{opacity:0;animation:fadeUp .6s ease forwards;animation-delay:.1s}
        .a2{opacity:0;animation:fadeUp .6s ease forwards;animation-delay:.2s}
        .a3{opacity:0;animation:fadeUp .6s ease forwards;animation-delay:.3s}
        .a4{opacity:0;animation:fadeUp .6s ease forwards;animation-delay:.4s}
        .a5{opacity:0;animation:fadeUp .6s ease forwards;animation-delay:.5s}
      `}</style>
      <div style={{
        display:'flex',alignItems:'center',justifyContent:'center',
        height:'100vh',background:'#0a0a10',fontFamily:"'Outfit',sans-serif",
        position:'relative',overflow:'hidden'
      }}>
        {/* Background orbs */}
        <div className="login-orb" style={{width:250,height:250,background:'rgba(201,168,76,.06)',top:'15%',right:'15%'}}/>
        <div className="login-orb" style={{width:200,height:200,background:'rgba(100,130,255,.04)',bottom:'20%',left:'10%',animationDelay:'5s'}}/>

        <div style={{
          width:380,padding:44,background:'rgba(17,17,27,.9)',borderRadius:24,
          border:'1px solid rgba(255,255,255,.06)',textAlign:'center',
          backdropFilter:'blur(20px)',position:'relative',zIndex:5,
          boxShadow:'0 20px 60px rgba(0,0,0,.4)'
        }}>
          {/* Logo */}
          <div className="a1" style={{fontSize:36,marginBottom:12}}>📊</div>
          <div className="a2" style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:700,color:'#e4e2df',marginBottom:4}}>
            Fund Your <span style={{color:'#c9a84c'}}>Goals</span>
          </div>
          <div className="a3" style={{fontSize:12,color:'#5e5e70',marginBottom:32}}>
            Financial Planning Suite
          </div>
          
          {/* Google Sign-In Button */}
          <div className="a4" style={{display:'flex',justifyContent:'center',marginBottom:16}}>
            <div id="google-signin-btn"></div>
          </div>

          {!gsiLoaded && (
            <div className="a4" style={{fontSize:12,color:'#5e5e70'}}>Loading Google Sign-In...</div>
          )}
          
          {error && (
            <div style={{
              fontSize:12,color:'#f43f5e',marginTop:12,
              padding:'10px 16px',borderRadius:8,
              background:'rgba(244,63,94,.08)',
              border:'1px solid rgba(244,63,94,.15)'
            }}>
              {error}
            </div>
          )}
          
          <div className="a5" style={{marginTop:24,fontSize:10,color:'#3a3a4c'}}>
            Authorized access only
          </div>
          
          <a href="/" className="a5" style={{display:'inline-block',marginTop:12,fontSize:11,color:'#5e5e70',textDecoration:'none'}}>
            ← Back to website
          </a>
        </div>
      </div>
    </>
  )

  // ═══ PLANNER APP (authenticated) ═══
  return (
    <div style={{position:'relative'}}>
      {/* User info + logout button */}
      <button 
        onClick={handleLogout}
        style={{
          position:'fixed',bottom:8,right:8,zIndex:9999,
          padding:'4px 12px',borderRadius:6,fontSize:9,
          background:'#1c1c2e',color:'#5e5e70',border:'1px solid #1c1c2e33',
          cursor:'pointer',fontFamily:"'DM Sans',sans-serif",
          display:'flex',alignItems:'center',gap:6
        }}
      >
        {user.picture && <img src={user.picture} alt="" style={{width:14,height:14,borderRadius:7}}/>}
        {user.name || user.email} • Logout
      </button>
      <Planner />
    </div>
  )
}
