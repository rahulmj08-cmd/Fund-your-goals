'use client'
import { useState, useEffect } from 'react'

const C={bg:'#0F172A',bg2:'#1E293B',border:'rgba(255,255,255,0.08)',text:'#F1F5F9',text2:'#94A3B8',text3:'#64748B',blue:'#3B82F6',blueD:'#2563EB',blueL:'rgba(59,130,246,.12)',gold:'#D4A843',green:'#10B981'}

const catColors={Investing:'#3B82F6','Personal Finance':'#10B981',Retirement:'#F59E0B','SIP Strategy':'#8B5CF6',Behaviour:'#EC4899','Book Review':'#A16207'}

export default function BlogPage(){
  const [posts,setPosts]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(false)
  const [filter,setFilter]=useState('All')

  useEffect(()=>{
    const fetchPosts=async()=>{
      try{
        const res=await fetch('/api/blog')
        const data=await res.json()
        if(data.posts&&data.posts.length>0){
          setPosts(data.posts)
        }else{
          setError(true)
        }
      }catch(e){
        setError(true)
      }
      setLoading(false)
    }
    fetchPosts()
  },[])

  const categories=['All',...new Set(posts.map(p=>p.category).filter(Boolean))]
  const filtered=filter==='All'?posts:posts.filter(p=>p.category===filter)

  return(
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .blog-card{background:rgba(255,255,255,0.03);border:1px solid ${C.border};border-radius:16px;padding:28px;text-decoration:none;color:${C.text};transition:all .4s;display:block}
        .blog-card:hover{background:rgba(255,255,255,0.06);transform:translateY(-6px);box-shadow:0 16px 48px rgba(0,0,0,.2);border-color:rgba(59,130,246,.15)}
        .blog-card h2{font-size:20px;font-weight:700;margin-bottom:10px;line-height:1.4;font-family:'Playfair Display',serif}
        .blog-card p{font-size:13px;color:${C.text2};line-height:1.7}
        .blog-date{font-size:11px;color:${C.text3};margin-top:14px}
        .blog-arrow{margin-top:14px;font-size:13px;color:${C.blue};font-weight:700}
        .blog-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
        .blog-featured{grid-column:span 2}
        .cat-pill{padding:7px 16px;border-radius:50px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ${C.border};background:transparent;color:${C.text2};transition:all .25s;font-family:'Plus Jakarta Sans',sans-serif}
        .cat-pill:hover{border-color:${C.blue};color:${C.blue}}
        .cat-pill.active{background:${C.blue};color:#fff;border-color:${C.blue}}
        .skeleton{background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:16px}
        @media(max-width:768px){.blog-grid{grid-template-columns:1fr}.blog-featured{grid-column:span 1}.cat-pills{flex-wrap:wrap!important}}
      `}</style>

      <div style={{padding:'14px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(15,23,42,.92)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:10}}>
        <a href="/" style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:C.text,textDecoration:'none'}}>Fund Your <span style={{color:C.blue}}>Goals</span></a>
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          <a href="/" style={{fontSize:12,color:C.text2,textDecoration:'none'}}>← Home</a>
          <a href="https://rahulmj.substack.com/" target="_blank" rel="noopener" style={{fontSize:12,color:C.blue,textDecoration:'none',fontWeight:600}}>Subscribe on Substack →</a>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'48px 24px 80px'}}>
        <div style={{textAlign:'center',marginBottom:40,animation:'fadeUp .6s ease both'}}>
          <div style={{display:'inline-block',padding:'6px 16px',borderRadius:50,fontSize:11,fontWeight:700,color:C.blue,background:C.blueL,marginBottom:16,letterSpacing:.5}}>Blog & Newsletter</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:700,marginBottom:12,lineHeight:1.2}}>
            Rahul MJ's <span style={{color:C.blue,fontStyle:'italic'}}>Fin Focus</span>
          </h1>
          <p style={{fontSize:15,color:C.text2,lineHeight:1.7,maxWidth:500,margin:'0 auto'}}>
            Insights on investing, personal finance, and building long-term wealth.
          </p>
        </div>

        {!loading&&posts.length>0&&categories.length>2&&<div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:36,flexWrap:'wrap'}} className="cat-pills">
          {categories.map(c=>(<button key={c} className={`cat-pill${filter===c?' active':''}`} onClick={()=>setFilter(c)}>{c}</button>))}
        </div>}

        {loading&&<div className="blog-grid">
          {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:200}}/>)}
        </div>}

        {error&&!loading&&<div style={{textAlign:'center',padding:60}}>
          <div style={{fontSize:48,marginBottom:16}}>📝</div>
          <h3 style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:12}}>Articles coming soon</h3>
          <p style={{fontSize:14,color:C.text2,marginBottom:24,lineHeight:1.7}}>Meanwhile, read our latest insights directly on Substack.</p>
          <a href="https://rahulmj.substack.com/" target="_blank" rel="noopener" style={{display:'inline-block',padding:'14px 36px',borderRadius:50,background:C.blue,color:'#fff',textDecoration:'none',fontSize:15,fontWeight:700}}>Visit Substack →</a>
        </div>}

        {!loading&&!error&&filtered.length>0&&<div className="blog-grid">
          {filtered.map((post,i)=>(
            <a key={i} href={post.url||'https://rahulmj.substack.com/'} target="_blank" rel="noopener" className={`blog-card${i===0&&filter==='All'?' blog-featured':''}`} style={{animation:`fadeUp .5s ease both ${.05+i*.06}s`}}>
              {post.category&&<div style={{display:'inline-block',padding:'4px 12px',borderRadius:50,fontSize:10,fontWeight:700,color:catColors[post.category]||C.blue,background:(catColors[post.category]||C.blue)+'18',marginBottom:12,letterSpacing:.5,textTransform:'uppercase'}}>{post.category}</div>}
              <h2 style={i===0&&filter==='All'?{fontSize:26}:{}}>{post.title}</h2>
              <p>{post.subtitle}</p>
              <div className="blog-date">📅 {post.date}</div>
              <div className="blog-arrow">Read on Substack →</div>
            </a>
          ))}
        </div>}

        {!loading&&!error&&filtered.length===0&&posts.length>0&&<div style={{textAlign:'center',padding:60,color:C.text3}}>
          <p>No articles in this category yet.</p>
        </div>}

        <div style={{textAlign:'center',marginTop:60,padding:40,background:C.bg2,borderRadius:20,border:`1px solid ${C.border}`}}>
          <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:8}}>Never miss an insight</h3>
          <p style={{fontSize:14,color:C.text2,marginBottom:24}}>Subscribe to get weekly investing wisdom delivered to your inbox.</p>
          <a href="https://rahulmj.substack.com/subscribe" target="_blank" rel="noopener" style={{display:'inline-block',padding:'14px 36px',borderRadius:50,background:C.blue,color:'#fff',textDecoration:'none',fontSize:15,fontWeight:700}}>Subscribe Free →</a>
        </div>
      </div>
    </div>
  )
}
