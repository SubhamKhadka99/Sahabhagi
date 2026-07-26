import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const TICKETS = [
  { id: "#SB-2847", loc: "New Baneshwor", status: "In Progress", cls: "progress" },
  { id: "#SB-3011", loc: "Boudha", status: "Acknowledged", cls: "ack" },
  { id: "#SB-2839", loc: "Kalanki", status: "Resolved", cls: "resolved" },
  { id: "#SB-2988", loc: "Balaju", status: "Reported", cls: "reported" },
  { id: "#SB-2855", loc: "Maitighar", status: "In Progress", cls: "progress" },
  { id: "#SB-3102", loc: "Koteshwor", status: "Acknowledged", cls: "ack" },
  { id: "#SB-2833", loc: "Naxal", status: "Resolved", cls: "resolved" },
  { id: "#SB-2960", loc: "Thapathali", status: "Reported", cls: "reported" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  // Scroll-triggered reveal animation, ported from the original vanilla build.
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    document.querySelectorAll(".sb-landing .reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Smooth in-page anchor scrolling, scoped to this page only (restored on unmount).
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = prev; };
  }, []);

  return (
    <div className="sb-landing">
      <style>{`
        .sb-landing{
          --navy:#0A192F; --navy2:#122A4D; --navy-800:#0E2340;
          --cyan:#00B4D8; --cyan2:#0EA5C4; --amber:#D97706; --teal:#0D7C66; --green:#1E8F5F; --red:#DC2626;
          --bg:#FFFFFF; --bg-2:#F8FAFC; --surface-muted:#F1F5F9; --border:#E2E8F0;
          --text:#0A192F; --text-2:#475569; --text-muted:#64748B;
          --font-body:'Inter',sans-serif; --font-mono:'JetBrains Mono',monospace; --font-dev:'Noto Sans Devanagari',sans-serif;
          --ease: cubic-bezier(.16,.84,.44,1);
          margin:0; font-family:var(--font-body); color:var(--text); background:var(--bg);
          -webkit-font-smoothing:antialiased; line-height:1.5; overflow-x:hidden;
        }
        .sb-landing *, .sb-landing *::before, .sb-landing *::after{ box-sizing:border-box; }
        @media (prefers-reduced-motion: reduce){
          .sb-landing *, .sb-landing *::before, .sb-landing *::after{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
        }
        .sb-landing img,.sb-landing svg{display:block; max-width:100%;}
        .sb-landing a{color:inherit;}
        .sb-landing .wrap{max-width:1280px; margin:0 auto; padding:0 32px;}
        @media (max-width:640px){ .sb-landing .wrap{padding:0 20px;} }

        .sb-landing .reveal{opacity:0; transform:translateY(24px); transition:opacity .8s var(--ease), transform .8s var(--ease);}
        .sb-landing .reveal.in{opacity:1; transform:translateY(0);}
        .sb-landing .reveal-delay-1{transition-delay:.06s;} .sb-landing .reveal-delay-2{transition-delay:.12s;}
        .sb-landing .reveal-delay-3{transition-delay:.18s;} .sb-landing .reveal-delay-4{transition-delay:.24s;}

        .sb-landing .nav{position:sticky; top:0; left:0; right:0; z-index:100; background:rgba(255,255,255,.85); backdrop-filter:blur(14px) saturate(160%); -webkit-backdrop-filter:blur(14px) saturate(160%); border-bottom:1px solid rgba(226,232,240,.7);}
        .sb-landing .nav-inner{max-width:1280px; margin:0 auto; padding:0 32px; height:72px; display:flex; align-items:center; justify-content:space-between;}
        @media (max-width:640px){ .sb-landing .nav-inner{padding:0 20px; height:64px;} }
        .sb-landing .brand{display:flex; align-items:center; gap:11px; text-decoration:none;}
        .sb-landing .brand-mark{width:34px; height:34px; flex-shrink:0; object-fit:contain;}
        .sb-landing .brand-word{display:flex; flex-direction:column; line-height:1.05;}
        .sb-landing .brand-word b{font-weight:800; font-size:17px; letter-spacing:-.01em; color:var(--text);}
        .sb-landing .brand-word span{font-family:var(--font-dev); font-size:11px; color:var(--text-muted); font-weight:500;}
        .sb-landing .nav-links{display:flex; align-items:center; gap:34px;}
        .sb-landing .nav-links a{font-size:14px; font-weight:600; color:var(--text-2); text-decoration:none; letter-spacing:-.005em; transition:color .2s var(--ease); cursor:pointer;}
        .sb-landing .nav-links a:hover{color:var(--cyan2);}
        @media (max-width:920px){ .sb-landing .nav-links{display:none;} }
        .sb-landing .btn{display:inline-flex; align-items:center; gap:8px; font-family:var(--font-body); font-weight:700; font-size:14.5px; padding:11px 22px; border-radius:8px; text-decoration:none; border:1.5px solid transparent; cursor:pointer; transition:transform .25s var(--ease), box-shadow .25s var(--ease), background .25s var(--ease), border-color .25s var(--ease); letter-spacing:-.005em;}
        .sb-landing .btn:active{transform:translateY(1px);}
        .sb-landing .btn-primary{background:var(--navy); color:#fff; box-shadow:0 1px 2px rgba(10,25,47,.15), 0 8px 20px -8px rgba(10,25,47,.45);}
        .sb-landing .btn-primary:hover{background:var(--navy2); box-shadow:0 2px 6px rgba(10,25,47,.2), 0 14px 28px -10px rgba(10,25,47,.5); transform:translateY(-1px);}
        .sb-landing .btn-ghost{background:transparent; color:var(--text); border-color:var(--border);}
        .sb-landing .btn-ghost:hover{border-color:var(--cyan2); color:var(--cyan2); background:#EFFBFD;}
        .sb-landing .btn-cyan{background:var(--cyan); color:#fff; box-shadow:0 1px 2px rgba(0,180,216,.2), 0 10px 22px -8px rgba(0,180,216,.5);}
        .sb-landing .btn-cyan:hover{background:var(--cyan2); transform:translateY(-1px);}
        .sb-landing .btn-white{background:#fff; color:var(--navy); box-shadow:0 4px 14px -4px rgba(0,0,0,.15);}
        .sb-landing .btn-white:hover{transform:translateY(-1px); box-shadow:0 8px 22px -6px rgba(0,0,0,.22);}

        .sb-landing .label-tag{font-family:var(--font-mono); font-size:11.5px; font-weight:600; letter-spacing:.05em; text-transform:uppercase; color:var(--text-muted);}
        .sb-landing h1,.sb-landing h2,.sb-landing h3{font-family:var(--font-body); margin:0; letter-spacing:-.03em; color:var(--text);}

        .sb-landing .hero{position:relative; padding:64px 0 90px; background:var(--bg); overflow:hidden;}
        .sb-landing .hero-grid{position:relative; z-index:1; display:grid; grid-template-columns:1fr 1.05fr; gap:56px; align-items:center;}
        @media (max-width:980px){ .sb-landing .hero-grid{grid-template-columns:1fr; gap:48px;} }
        .sb-landing .hero h1{font-size:clamp(2.5rem, 5vw, 4.2rem); font-weight:900; line-height:1.02; letter-spacing:-.035em;}
        .sb-landing .hero h1 em{font-style:normal; color:var(--cyan2);}
        .sb-landing .hero-sub{font-size:18.5px; color:var(--text-2); max-width:520px; margin:24px 0 0; font-weight:450; line-height:1.6;}
        .sb-landing .hero-actions{display:flex; align-items:center; gap:16px; margin-top:34px; flex-wrap:wrap;}
        .sb-landing .hero-note{font-size:13px; color:var(--text-muted); margin-top:18px; font-weight:500; max-width:420px; line-height:1.5;}

        .sb-landing .map-visual{position:relative; border-radius:18px; overflow:hidden; box-shadow:0 30px 70px -22px rgba(10,25,47,.28), 0 4px 18px -6px rgba(10,25,47,.15); border:1px solid var(--border);}
        .sb-landing .map-visual img{width:100%; display:block;}
        .sb-landing .map-pulse{position:absolute; width:10px; height:10px; border-radius:50%; background:#EF4444; box-shadow:0 0 0 2px rgba(255,255,255,.9);}
        .sb-landing .map-pulse::after{content:''; position:absolute; inset:-5px; border-radius:50%; border:2px solid rgba(239,68,68,.55); animation:sbRingPulse 2.4s var(--ease) infinite;}
        @keyframes sbRingPulse{0%{transform:scale(.55); opacity:1;} 100%{transform:scale(2.8); opacity:0;}}
        .sb-landing .map-caption{position:absolute; left:14px; bottom:14px; background:rgba(10,25,47,.85); color:#D8ECFA; font-family:var(--font-mono); font-size:11px; padding:6px 11px; border-radius:7px; backdrop-filter:blur(4px);}

        .sb-landing .ticker-wrap{margin-top:60px; border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:15px 0; overflow:hidden; position:relative;}
        .sb-landing .ticker-wrap::before, .sb-landing .ticker-wrap::after{content:''; position:absolute; top:0; bottom:0; width:70px; z-index:2;}
        .sb-landing .ticker-wrap::before{left:0; background:linear-gradient(90deg,#fff, rgba(255,255,255,0));}
        .sb-landing .ticker-wrap::after{right:0; background:linear-gradient(-90deg,#fff, rgba(255,255,255,0));}
        .sb-landing .ticker-track{display:flex; gap:38px; width:max-content; animation:sbTickerMove 34s linear infinite;}
        @keyframes sbTickerMove{ from{transform:translateX(0);} to{transform:translateX(-50%);} }
        .sb-landing .ticket{display:flex; align-items:center; gap:9px; font-family:var(--font-mono); font-size:12.5px; color:var(--text-muted); white-space:nowrap;}
        .sb-landing .ticket b{color:var(--text-2); font-weight:600;}
        .sb-landing .dot{width:6px; height:6px; border-radius:50%; flex-shrink:0;}
        .sb-landing .dot.reported{background:#3B82F6;} .sb-landing .dot.ack{background:#F59E0B;} .sb-landing .dot.progress{background:#F97316;} .sb-landing .dot.resolved{background:#1E8F5F;}

        .sb-landing section{position:relative;}
        .sb-landing .section-pad{padding:112px 0;}
        @media (max-width:768px){ .sb-landing .section-pad{padding:72px 0;} }
        .sb-landing .kicker-row{display:flex; align-items:flex-end; justify-content:space-between; gap:40px; margin-bottom:52px; flex-wrap:wrap;}
        .sb-landing .kicker-row h2{font-size:clamp(1.85rem,3.2vw,2.6rem); font-weight:800; max-width:640px;}
        .sb-landing .kicker-row p{color:var(--text-2); font-size:16px; max-width:340px; margin:0; line-height:1.6;}

        .sb-landing .problem{background:var(--bg-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border);}
        .sb-landing .problem-grid{display:grid; grid-template-columns:.9fr 1.1fr; gap:64px; align-items:start;}
        @media (max-width:900px){ .sb-landing .problem-grid{grid-template-columns:1fr;} }
        .sb-landing .stat-huge{font-weight:900; letter-spacing:-.045em; line-height:.9; color:var(--navy);}
        .sb-landing .stat-huge .num{font-size:clamp(3rem,6.6vw,6rem); display:block;}
        .sb-landing .stat-huge .cap{font-family:var(--font-mono); font-weight:500; font-size:12.5px; letter-spacing:.03em; color:var(--text-muted); text-transform:uppercase; display:block; margin-top:10px;}
        .sb-landing .versus-line{display:flex; align-items:center; gap:18px; margin:30px 0;}
        .sb-landing .versus-line .vs{font-family:var(--font-mono); font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); border-radius:6px; padding:3px 8px; background:#fff;}
        .sb-landing .problem-list{display:flex; flex-direction:column;}
        .sb-landing .problem-item{display:grid; grid-template-columns:auto 1fr; gap:20px; padding:24px 0; border-top:1px solid var(--border);}
        .sb-landing .problem-item:last-child{border-bottom:1px solid var(--border);}
        .sb-landing .problem-item .mark{font-family:var(--font-mono); font-size:12px; color:var(--red); font-weight:700; padding-top:3px;}
        .sb-landing .problem-item h4{margin:0 0 6px; font-size:16.5px; font-weight:700; letter-spacing:-.01em;}
        .sb-landing .problem-item p{margin:0; color:var(--text-2); font-size:14.5px; line-height:1.6;}

        .sb-landing .record{background:var(--bg);}
        .sb-landing .record-grid{display:grid; grid-template-columns:1fr 1fr; gap:34px; align-items:start;}
        @media (max-width:860px){ .sb-landing .record-grid{grid-template-columns:1fr;} }
        .sb-landing .record-card{border:1px solid var(--border); border-radius:16px; overflow:hidden; background:#fff; box-shadow:0 24px 50px -28px rgba(10,25,47,.18); display:flex; flex-direction:column;}
        .sb-landing .record-card .rc-head{display:flex; align-items:center; gap:10px; padding:16px 18px; border-bottom:1px solid var(--border);}
        .sb-landing .record-card .rc-head .who{width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;}
        .sb-landing .record-card.citizen .who{background:#E6F7FB; color:var(--cyan2);}
        .sb-landing .record-card.officer .who{background:#0A192F; color:#00B4D8;}
        .sb-landing .record-card .rc-head b{font-size:14px; font-weight:700;}
        .sb-landing .record-card .rc-head span{display:block; font-size:12px; color:var(--text-muted); font-weight:500;}
        /* Fix: both shots sit in a shared fixed-height frame with
           object-fit:contain (letterboxed on a soft background) so a tall
           mobile screenshot and a wide desktop screenshot read as the same
           visual "size" without cropping any content out of either. */
        .sb-landing .record-shot{height:520px; display:flex; align-items:flex-start; justify-content:center; background:var(--bg-2); overflow:hidden;}
        .sb-landing .record-shot img{width:100%; height:100%; object-fit:contain; display:block;}
        @media (max-width:640px){ .sb-landing .record-shot{height:420px;} }
        .sb-landing .record-note{grid-column:1/-1; font-size:13.5px; color:var(--text-muted); text-align:center; margin-top:8px; line-height:1.6;}

        .sb-landing .flow{background:var(--bg-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border);}
        .sb-landing .flow-steps{display:grid; grid-template-columns:repeat(4,1fr); gap:26px; position:relative;}
        @media (max-width:860px){ .sb-landing .flow-steps{grid-template-columns:1fr; gap:18px;} }
        .sb-landing .flow-step{background:#fff; border:1px solid var(--border); border-radius:16px; padding:26px 22px; position:relative;}
        .sb-landing .flow-step .step-index{width:50px; height:50px; border-radius:50%; background:#fff; border:2px solid var(--cyan2); display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-weight:700; font-size:14.5px; color:var(--cyan2); margin-bottom:18px;}
        .sb-landing .flow-step:nth-child(2) .step-index{border-color:#F59E0B; color:#F59E0B;}
        .sb-landing .flow-step:nth-child(3) .step-index{border-color:#F97316; color:#F97316;}
        .sb-landing .flow-step:nth-child(4) .step-index{border-color:var(--green); color:var(--green);}
        .sb-landing .flow-step h4{font-size:16.5px; font-weight:700; margin:0 0 8px; letter-spacing:-.01em;}
        .sb-landing .flow-step p{margin:0; font-size:14px; color:var(--text-2); line-height:1.55;}
        .sb-landing .flow-step .tag{display:inline-block; margin-top:14px; font-family:var(--font-mono); font-size:10.5px; letter-spacing:.03em; color:var(--text-muted); background:var(--surface-muted); padding:3px 8px; border-radius:5px; text-transform:uppercase;}

        .sb-landing .citizen{background:var(--bg); overflow:hidden;}
        .sb-landing .citizen-grid{display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center;}
        @media (max-width:900px){ .sb-landing .citizen-grid{grid-template-columns:1fr; gap:52px;} .sb-landing .phone-col{order:-1;} }
        .sb-landing .citizen h2{font-size:clamp(1.85rem,3vw,2.5rem); font-weight:800; max-width:520px;}
        .sb-landing .citizen-copy p{font-size:16.5px; color:var(--text-2); line-height:1.7; max-width:460px; margin:18px 0 26px;}
        .sb-landing .feature-line{display:flex; gap:14px; align-items:flex-start; padding:15px 0; border-top:1px solid var(--border);}
        .sb-landing .feature-line:first-child{border-top:none;}
        .sb-landing .feature-line .dot-icon{width:22px; height:22px; border-radius:6px; flex-shrink:0; display:flex; align-items:center; justify-content:center; margin-top:2px; font-size:12px;}
        .sb-landing .feature-line h5{margin:0 0 3px; font-size:14.5px; font-weight:700;}
        .sb-landing .feature-line p{margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.5;}

        .sb-landing .phone-col{display:flex; justify-content:center; position:relative;}
        .sb-landing .phone-stack{position:relative; width:280px;}
        .sb-landing .phone{width:280px; border-radius:34px; background:#0A192F; padding:10px; box-shadow:0 40px 80px -30px rgba(10,25,47,.45), 0 10px 30px -10px rgba(10,25,47,.3);}
        .sb-landing .phone img{border-radius:24px; width:100%; display:block;}
        .sb-landing .phone.behind{position:absolute; top:34px; left:-96px; width:220px; transform:rotate(-9deg); opacity:.94; z-index:0; filter:saturate(.94);}
        .sb-landing .phone.front{position:relative; z-index:1;}

        .sb-landing .dashboard{background:var(--navy); color:#fff; position:relative; overflow:hidden;}
        .sb-landing .dashboard::before{content:''; position:absolute; inset:0; z-index:0; background-image:radial-gradient(circle at 15% 20%, rgba(255,255,255,.05), transparent 45%), radial-gradient(circle at 85% 80%, rgba(0,180,216,.1), transparent 40%);}
        .sb-landing .dashboard .kicker-row p{color:#9FC2E0;}
        .sb-landing .dashboard h2{color:#fff;}
        .sb-landing .browser{position:relative; z-index:1; border-radius:16px; overflow:hidden; background:#0E1A2B; border:1px solid rgba(255,255,255,.1); box-shadow:0 40px 90px -30px rgba(0,0,0,.5);}
        .sb-landing .browser-bar{display:flex; align-items:center; gap:8px; padding:12px 16px; background:#101E31; border-bottom:1px solid rgba(255,255,255,.08);}
        .sb-landing .browser-bar i{width:10px; height:10px; border-radius:50%;}
        .sb-landing .browser-bar i:nth-child(1){background:#FF5F57;} .sb-landing .browser-bar i:nth-child(2){background:#FEBC2E;} .sb-landing .browser-bar i:nth-child(3){background:#28C840;}
        .sb-landing .browser-bar .url{margin-left:14px; font-family:var(--font-mono); font-size:11.5px; color:#9FB6CC; background:rgba(255,255,255,.06); padding:4px 12px; border-radius:6px;}
        .sb-landing .browser img{width:100%; display:block;}
        .sb-landing .dash-thumbs{display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:20px; position:relative; z-index:1;}
        @media (max-width:760px){ .sb-landing .dash-thumbs{grid-template-columns:1fr;} }
        .sb-landing .dash-thumb{border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,.12); cursor:default;}
        .sb-landing .dash-thumb img{width:100%; display:block; transition:transform .5s var(--ease);}
        .sb-landing .dash-thumb:hover img{transform:scale(1.04);}
        .sb-landing .dash-thumb-label{font-family:var(--font-mono); font-size:11px; color:#9FC2E0; padding:9px 12px; background:#101E31; border-top:1px solid rgba(255,255,255,.08);}
        .sb-landing .dashboard-note{margin-top:22px; font-size:13px; color:#8AA9C4; text-align:center; position:relative; z-index:1; line-height:1.6;}

        .sb-landing .data-section{background:var(--bg); position:relative;}
        .sb-landing .contour-bg{position:absolute; inset:0; z-index:0; opacity:.5; pointer-events:none; -webkit-mask-image:linear-gradient(to bottom, transparent, black 18%, black 82%, transparent); mask-image:linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);}
        .sb-landing .data-grid{display:grid; grid-template-columns:1fr 1fr; gap:70px; align-items:center; position:relative; z-index:1;}
        @media (max-width:900px){ .sb-landing .data-grid{grid-template-columns:1fr;} }
        .sb-landing .data-copy h2{font-size:clamp(1.85rem,3vw,2.5rem); font-weight:800; max-width:520px;}
        .sb-landing .data-copy p{font-size:16.5px; color:var(--text-2); line-height:1.7; max-width:480px; margin:18px 0 28px;}
        .sb-landing .buyer-chips{display:flex; flex-wrap:wrap; gap:10px;}
        .sb-landing .chip{font-family:var(--font-mono); font-size:12.5px; font-weight:600; color:var(--text-2); border:1px solid var(--border); padding:7px 14px; border-radius:100px; background:#fff;}
        .sb-landing .dataset-card{border:1px solid var(--border); border-radius:18px; padding:30px; background:linear-gradient(180deg,#fff,#F9FBFD); box-shadow:0 30px 60px -30px rgba(10,25,47,.15);}
        .sb-landing .dataset-row{display:flex; align-items:center; justify-content:space-between; padding:13px 0; border-top:1px dashed var(--border);}
        .sb-landing .dataset-row:first-child{border-top:none; padding-top:0;}
        .sb-landing .dataset-row .label{font-size:13px; color:var(--text-muted); font-weight:600;}
        .sb-landing .dataset-row .value{font-family:var(--font-mono); font-size:13.5px; font-weight:700; color:var(--text);}
        .sb-landing .dataset-row .value.green{color:var(--green);}

        .sb-landing .tryit{background:var(--bg-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border);}
        .sb-landing .tryit-grid{display:grid; grid-template-columns:1fr .78fr; gap:60px; align-items:center;}
        @media (max-width:900px){ .sb-landing .tryit-grid{grid-template-columns:1fr;} }
        .sb-landing .tryit h2{font-size:clamp(1.9rem,3.4vw,2.7rem); font-weight:800; max-width:560px;}
        .sb-landing .tryit p.lead{font-size:17px; color:var(--text-2); max-width:480px; margin:18px 0 32px; line-height:1.65;}
        .sb-landing .demo-btns{display:flex; flex-direction:column; gap:14px; max-width:420px;}
        .sb-landing .demo-btn{display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 22px; border-radius:14px; border:1.5px solid var(--border); background:#fff; text-decoration:none; transition:all .25s var(--ease); cursor:pointer;}
        .sb-landing .demo-btn:hover{border-color:var(--cyan2); box-shadow:0 14px 30px -14px rgba(0,180,216,.35); transform:translateY(-2px);}
        .sb-landing .demo-btn .db-left b{display:block; font-size:15.5px; font-weight:700; color:var(--text);}
        .sb-landing .demo-btn .db-left span{display:block; font-size:13px; color:var(--text-muted); margin-top:2px;}
        .sb-landing .demo-btn .db-arrow{width:34px; height:34px; border-radius:50%; background:var(--surface-muted); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:15px; color:var(--navy);}
        .sb-landing .tryit-note{font-size:13px; color:var(--text-muted); margin-top:20px; max-width:420px; line-height:1.6;}
        .sb-landing .tryit-shot{border-radius:20px; overflow:hidden; box-shadow:0 30px 70px -24px rgba(10,25,47,.3); border:1px solid var(--border); max-width:340px; margin:0 auto;}
        .sb-landing .tryit-shot img{width:100%; display:block;}

        .sb-landing .cta{background:linear-gradient(160deg,#0A192F 0%, #0E2340 100%); position:relative; overflow:hidden;}
        .sb-landing .cta::before{content:''; position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size:44px 44px; -webkit-mask-image:radial-gradient(ellipse 70% 80% at 50% 30%, black, transparent 75%); mask-image:radial-gradient(ellipse 70% 80% at 50% 30%, black, transparent 75%);}
        .sb-landing .cta-inner{position:relative; z-index:1; text-align:center;}
        .sb-landing .cta h2{color:#fff; font-size:clamp(2rem,3.8vw,2.9rem); font-weight:900; letter-spacing:-.035em; max-width:720px; margin:0 auto;}
        .sb-landing .cta p{color:#BFDCF4; font-size:16.5px; max-width:520px; margin:18px auto 0; line-height:1.6;}
        .sb-landing .cta-paths{display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:760px; margin:40px auto 0;}
        @media (max-width:700px){ .sb-landing .cta-paths{grid-template-columns:1fr;} }
        .sb-landing .cta-path{background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); border-radius:16px; padding:26px 24px; text-align:left; backdrop-filter:blur(6px);}
        .sb-landing .cta-path .p-eyebrow{font-family:var(--font-mono); font-size:11.5px; color:#7FD4EE; text-transform:uppercase; letter-spacing:.04em; font-weight:700;}
        .sb-landing .cta-path h3{color:#fff; font-size:18.5px; font-weight:800; margin:10px 0 8px;}
        .sb-landing .cta-path p{color:#B9D2E6; font-size:13.5px; margin:0 0 18px; text-align:left;}

        .sb-landing footer{background:var(--navy); padding:56px 0 30px; color:#B9D2E6;}
        .sb-landing .footer-top{display:flex; justify-content:space-between; gap:40px; flex-wrap:wrap; padding-bottom:36px; border-bottom:1px solid rgba(255,255,255,.1);}
        .sb-landing .footer-brand .brand-word b{color:#fff;} .sb-landing .footer-brand .brand-word span{color:#8AA9C4;}
        .sb-landing .footer-brand p{max-width:280px; font-size:13.5px; line-height:1.6; color:#8AA9C4; margin-top:14px;}
        .sb-landing .footer-cols{display:flex; gap:64px; flex-wrap:wrap;}
        .sb-landing .footer-col h5{font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:#6C93B4; font-weight:700; margin:0 0 16px; font-family:var(--font-mono);}
        .sb-landing .footer-col a{display:block; font-size:14px; color:#D8ECFA; text-decoration:none; margin-bottom:11px; font-weight:500; cursor:pointer;}
        .sb-landing .footer-col a:hover{color:#fff;}
        .sb-landing .footer-bottom{display:flex; justify-content:space-between; align-items:center; padding-top:26px; flex-wrap:wrap; gap:12px;}
        .sb-landing .footer-bottom span{font-size:12.5px; color:#6C93B4;}
        .sb-landing .footer-bottom .dev{font-family:var(--font-dev); color:#8AA9C4;}

        .sb-landing ::selection{background:var(--navy); color:#fff;}
      `}</style>

      <nav className="nav">
        <div className="nav-inner">
          <a className="brand" href="#top">
            <img className="brand-mark" src="/landing/logo-mark.png" alt="Sahabhagi" />
            <span className="brand-word"><b>Sahabhagi</b><span>सहभागी</span></span>
          </a>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#dashboard">Officer dashboard</a>
            <a href="#try-it">Try the app</a>
          </div>
          <Link to="/login" className="btn btn-primary">Open the app →</Link>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap">
          <div className="hero-grid">
            <div className="hero-copy reveal in">
              <span className="label-tag">Civic hazard reporting · Kathmandu</span>
              <h1 style={{ marginTop: 16 }}>A blocked drain becomes<br />a hotspot <em>no ward office</em><br />can scroll past.</h1>
              <p className="hero-sub">A resident photographs a hazard in 10 seconds. It's geo-tagged and dropped onto a live map. When fifty neighbours report the same drain, the officer doesn't see fifty messages — they see one hotspot ranked at the top of their queue.</p>
              <div className="hero-actions">
                <Link to="/login" className="btn btn-primary">Open the live app →</Link>
                <a href="#how-it-works" className="btn btn-ghost">See how it works</a>
              </div>
              <div className="hero-note">सहभागी — "co-participant." Built to run in any of Kathmandu's 32 wards, not just one.</div>
            </div>

            <div className="map-col reveal reveal-delay-2 in">
              <div className="map-visual">
                <img src="/landing/hero-map.jpg" alt="Live hotspot map of Kathmandu showing clustered citizen reports across the city" />
                <div className="map-pulse" style={{ top: "45.4%", left: "42.8%" }} />
                <div className="map-pulse" style={{ top: "57.4%", left: "54.9%" }} />
                <div className="map-pulse" style={{ top: "61.0%", left: "29.5%" }} />
                <div className="map-caption">Actual dashboard screenshot · demo data</div>
              </div>
            </div>
          </div>

          <div className="ticker-wrap reveal reveal-delay-3 in">
            <div className="ticker-track">
              {[...TICKETS, ...TICKETS].map((t, i) => (
                <div className="ticket" key={i}>
                  <span className={`dot ${t.cls}`} /><b>{t.id}</b> · {t.loc} · {t.status}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="problem section-pad" id="problem">
        <div className="wrap">
          <div className="problem-grid">
            <div className="reveal">
              <div className="stat-huge">
                <span className="num">1.7M</span>
                <span className="cap">People living in Kathmandu today</span>
              </div>
              <div className="versus-line">
                <span className="vs">VS</span>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
              </div>
              <div className="stat-huge" style={{ color: "var(--red)" }}>
                <span className="num">150K</span>
                <span className="cap">People the drainage network was designed for</span>
              </div>
              <p style={{ marginTop: 26, fontSize: 15, color: "var(--text-2)", maxWidth: 420, lineHeight: 1.65 }}>
                Every ward in the valley carries some version of this gap. The same blocked drains and flooded lanes show up each monsoon, reported nowhere that adds up to anything.
              </p>
            </div>

            <div className="problem-list reveal reveal-delay-2">
              <div className="problem-item">
                <span className="mark">01</span>
                <div><h4>No single place to report a hazard</h4><p>Filing a paper Nibedan means visiting the Ward office during working hours, in formal Nepali — a half-day cost most residents can't absorb.</p></div>
              </div>
              <div className="problem-item">
                <span className="mark">02</span>
                <div><h4>Zero feedback after filing</h4><p>No SMS, no reference number, no way to know if a complaint was received at all. People who report once and hear nothing stop reporting.</p></div>
              </div>
              <div className="problem-item">
                <span className="mark">03</span>
                <div><h4>Officers triage by hand, ward after ward</h4><p>Phone calls, WhatsApp threads, political referrals — with zero geo-data behind any of it. No way to see which single location keeps coming up.</p></div>
              </div>
              <div className="problem-item">
                <span className="mark">04</span>
                <div><h4>Attention follows connections, not severity</h4><p>A problem near a well-connected household gets fixed fast. Eighty reports from a dense, unconnected settlement carry no more weight than one.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="record section-pad" id="record">
        <div className="wrap">
          <div className="kicker-row reveal">
            <h2>Same ticket. Two logins. No gap between them.</h2>
            <p>A resident's report and an officer's queue are pulled from the exact same record — not two systems trying to stay in sync.</p>
          </div>
          <div className="record-grid reveal reveal-delay-2">
            <div className="record-card citizen">
              <div className="rc-head">
                <div className="who">📱</div>
                <div><b>What the resident sees</b><span>Citizen app · report detail</span></div>
              </div>
              <div className="record-shot">
                <img src="/landing/record-citizen.jpg" alt="Citizen app community feed showing recent resident reports" />
              </div>
            </div>
            <div className="record-card officer">
              <div className="rc-head">
                <div className="who">🖥️</div>
                <div><b>What the officer sees</b><span>Ward dashboard · same report, opened</span></div>
              </div>
              <div className="record-shot">
                <img src="/landing/record-officer.jpg" alt="Officer dashboard modal showing the same report with a status tracker and comments" />
              </div>
            </div>
            <p className="record-note">Both screens above are pulled from the live demo build, not mockups — vote score, tracker stage, and comments carry over exactly as submitted.</p>
          </div>
        </div>
      </section>

      <section className="flow section-pad" id="how-it-works">
        <div className="wrap">
          <div className="kicker-row reveal">
            <h2>Every report follows one visible, public pipeline.</h2>
            <p>Not a private complaint. A record both sides can watch move, in order.</p>
          </div>
          <div className="flow-steps reveal reveal-delay-2">
            <div className="flow-step">
              <div className="step-index">01</div>
              <h4>Reported</h4>
              <p>A photo, a category, GPS attached automatically. A ticket is issued before the officer even sees it.</p>
              <span className="tag">Ticket issued instantly</span>
            </div>
            <div className="flow-step">
              <div className="step-index">02</div>
              <h4>Acknowledged</h4>
              <p>The officer sees it ranked by urgency, not buried in a WhatsApp thread. Acknowledgment is timestamped and visible.</p>
              <span className="tag">Target: under 72 hrs</span>
            </div>
            <div className="flow-step">
              <div className="step-index">03</div>
              <h4>Dispatched</h4>
              <p>An officer note goes up — what's happening, who's on it. No more guessing whether anyone read the report.</p>
              <span className="tag">Progress note required</span>
            </div>
            <div className="flow-step">
              <div className="step-index">04</div>
              <h4>Resolved</h4>
              <p>Marked fixed, with a note attached. Nearby reporters can upvote or dispute it — not just the government marking its own homework.</p>
              <span className="tag">Community-scored</span>
            </div>
          </div>
        </div>
      </section>

      <section className="citizen section-pad" id="citizen">
        <div className="wrap">
          <div className="citizen-grid">
            <div className="citizen-copy reveal">
              <span className="label-tag">Citizen app</span>
              <h2 style={{ marginTop: 16 }}>Built for a mid-range phone, on a bad connection.</h2>
              <p>Most residents are on Android, mid-range devices, 3G or 4G. Every screen is designed for that phone, not a demo laptop on office WiFi.</p>
              <div className="feature-line">
                <div className="dot-icon" style={{ background: "#E6F7FB" }}>📷</div>
                <div><h5>Photo evidence, one tap</h5><p>Nine issue types, a photo, an optional landmark note — reports with photos are more likely to get resolved.</p></div>
              </div>
              <div className="feature-line">
                <div className="dot-icon" style={{ background: "#FEF3E4" }}>🏆</div>
                <div><h5>Civic score and a real leaderboard</h5><p>Top reporters climb a weekly ranking. It's a visible, comparative record — not a private point total.</p></div>
              </div>
              <div className="feature-line">
                <div className="dot-icon" style={{ background: "#E7F6EC" }}>✓</div>
                <div><h5>Community scoring</h5><p>Neighbours upvote or downvote a report's urgency and confirm resolutions — closures aren't just self-reported.</p></div>
              </div>
              <div className="feature-line">
                <div className="dot-icon" style={{ background: "#F1F5F9" }}>🕵</div>
                <div><h5>Post anonymously</h5><p>One toggle removes your name from the public feed for residents who'd rather not attach their identity to a report.</p></div>
              </div>
            </div>

            <div className="phone-col reveal reveal-delay-2">
              <div className="phone-stack">
                <div className="phone behind"><img src="/landing/phone-map.jpg" alt="Live ward map inside the citizen app" /></div>
                <div className="phone front"><img src="/landing/phone-feed.jpg" alt="Community feed inside the citizen app, showing recent reports" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard section-pad" id="dashboard">
        <div className="wrap">
          <div className="kicker-row reveal">
            <h2>Replaces the WhatsApp inbox with a ranked queue.</h2>
            <p>Ten seconds to post a status update. No training session required — and a performance record the officer can point to.</p>
          </div>

          <div className="browser reveal reveal-delay-2">
            <div className="browser-bar">
              <i /><i /><i />
              <span className="url">sahabhagi.app/admin</span>
            </div>
            <img src="/landing/dashboard-overview.jpg" alt="Officer dashboard overview showing report stats, status breakdown, and top reports" />
          </div>

          <div className="dash-thumbs reveal reveal-delay-3">
            <div className="dash-thumb">
              <img src="/landing/dashboard-queue.jpg" alt="Report management queue, sorted by community vote and age" />
              <div className="dash-thumb-label">Report Management — active queue</div>
            </div>
            <div className="dash-thumb">
              <img src="/landing/dashboard-stats.jpg" alt="Stats and data view of ward performance" />
              <div className="dash-thumb-label">Stats & Data</div>
            </div>
            <div className="dash-thumb">
              <img src="/landing/dashboard-leaderboard.jpg" alt="Leaderboard view from the officer side" />
              <div className="dash-thumb-label">Leaderboard</div>
            </div>
          </div>
          <p className="dashboard-note">These screens are running against the same seeded demo dataset used in the walkthrough above — the layout doesn't change from ward to ward, only the data in it.</p>
        </div>
      </section>

      <section className="data-section section-pad" id="data">
        <svg className="contour-bg" viewBox="0 0 1280 500" preserveAspectRatio="none">
          <g fill="none" stroke="#0A192F" strokeWidth="1">
            <path d="M-50 250 Q 200 100 500 220 T 1000 180 T 1400 260" opacity=".16" />
            <path d="M-50 300 Q 220 160 520 270 T 1020 230 T 1400 310" opacity=".12" />
            <path d="M-50 350 Q 240 220 540 320 T 1040 280 T 1400 360" opacity=".09" />
            <path d="M-50 200 Q 180 60 480 170 T 980 130 T 1400 210" opacity=".09" />
          </g>
        </svg>
        <div className="wrap">
          <div className="data-grid">
            <div className="data-copy reveal">
              <span className="label-tag">Beyond the report itself</span>
              <h2 style={{ marginTop: 16 }}>Satellites see the flood zone. Residents see the exact culvert.</h2>
              <p>A few months of reporting in any ward produces a geo-tagged, photo-verified, street-level hazard record — the layer satellite imagery and annual surveys were never built to capture, and one that scales the same way whether it's one ward or all thirty-two.</p>
              <div className="buyer-chips">
                <span className="chip">ICIMOD</span>
                <span className="chip">UN-Habitat</span>
                <span className="chip">UNDP Nepal</span>
                <span className="chip">Urban research bodies</span>
              </div>
            </div>
            <div className="dataset-card reveal reveal-delay-2">
              <div className="dataset-row"><span className="label">Data type</span><span className="value">Geo-tagged · photo-verified</span></div>
              <div className="dataset-row"><span className="label">Granularity</span><span className="value">Street-level, per report</span></div>
              <div className="dataset-row"><span className="label">Coverage model</span><span className="value">Same schema, any ward</span></div>
              <div className="dataset-row"><span className="label">Seasonal signal</span><span className="value">Same drain flagged every monsoon</span></div>
              <div className="dataset-row"><span className="label">Anonymization</span><span className="value">PII stripped at ingestion</span></div>
              <div className="dataset-row"><span className="label">Comparable source cost</span><span className="value green">Satellite + annual survey</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="tryit section-pad" id="try-it">
        <div className="wrap">
          <div className="tryit-grid">
            <div className="reveal">
              <span className="label-tag">No sign-up required</span>
              <h2 style={{ marginTop: 16 }}>Stop reading about it. Open it.</h2>
              <p className="lead">The live build is running right now with seeded demo data. Sign in or create an account — it only takes a minute either way.</p>
              <div className="demo-btns">
                <button className="demo-btn" onClick={() => navigate("/login")}>
                  <div className="db-left"><b>Continue as a resident</b><span>Report an issue, browse the feed, check the leaderboard</span></div>
                  <div className="db-arrow">→</div>
                </button>
                <button className="demo-btn" onClick={() => navigate("/login")}>
                  <div className="db-left"><b>Continue as a ward officer</b><span>Triage the queue, open a report, post a status update</span></div>
                  <div className="db-arrow">→</div>
                </button>
              </div>
              <p className="tryit-note">Both open the same sign-in screen — tap "Citizen demo" or "Officer demo" for one-tap access, no account needed.</p>
            </div>
            <div className="reveal reveal-delay-2">
              <div className="tryit-shot">
                <img src="/landing/login-screen.jpg" alt="Sahabhagi sign-in screen" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta section-pad" id="cta">
        <div className="wrap cta-inner reveal">
          <span className="label-tag" style={{ color: "#7FD4EE" }}>Together for a safer, stronger Kathmandu</span>
          <h2 style={{ marginTop: 18 }}>Sahabhagi is a partnership, not a surveillance tool.</h2>
          <p>The Ward Chairman co-authors the recognition system. The resident gets a record that doesn't disappear. Two logins, one map.</p>
          <div className="cta-paths">
            <div className="cta-path">
              <span className="p-eyebrow">For residents</span>
              <h3>Bring it to your ward</h3>
              <p>Share the app with your tole or Ward office — it works the same way in any of Kathmandu's 32 wards.</p>
              <Link to="/login" className="btn btn-white" style={{ width: "100%", justifyContent: "center" }}>Open the app →</Link>
            </div>
            <div className="cta-path">
              <span className="p-eyebrow">For wards & partners</span>
              <h3>Talk to us about your ward</h3>
              <p>For Ward Chairmen, officers, INGOs, and CSR partners exploring what this looks like for a specific ward.</p>
              <a href="#top" className="btn btn-cyan" style={{ width: "100%", justifyContent: "center" }}>Start a conversation →</a>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="brand-word"><b>Sahabhagi</b><span>सहभागी</span></div>
              <p>A citizen reporting layer and ward intelligence dashboard for Kathmandu — built to run in any ward, not just one.</p>
            </div>
            <div className="footer-cols">
              <div className="footer-col">
                <h5>Product</h5>
                <a href="#how-it-works">How it works</a>
                <a href="#dashboard">Officer dashboard</a>
                <a href="#data">Data & partners</a>
              </div>
              <div className="footer-col">
                <h5>Get started</h5>
                <a onClick={() => navigate("/login")}>Open the app</a>
                <a onClick={() => navigate("/login")}>Sign in</a>
                <a onClick={() => navigate("/login")}>Create account</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Sahabhagi.</span>
            <span className="dev">तपाईंको सहर। तपाईंको आवाज। तपाईंको वडा।</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
