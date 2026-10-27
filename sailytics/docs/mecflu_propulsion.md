<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <!-- NATIVE MOBILE ZOOM/PAN: Forces browser to render desktop width -->
    <meta name="viewport" content="width=1280">
    <title>Ultimate Marine Physics Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>

    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;700&display=swap');
        
        body { 
            background-color: #020617; 
            color: #f1f5f9; 
            margin: 0; 
            font-family: 'Inter', sans-serif; 
            /* Enforce minimum dimensions to allow zooming without breaking layout */
            min-width: 1280px; 
            min-height: 800px;
            height: 100vh;
            overflow: auto;
        }

        .dashboard {
            display: grid;
            grid-template-columns: 320px 1fr 450px;
            grid-template-rows: 64px 1fr;
            height: 100%;
            min-height: 800px;
            gap: 1px;
            background: #1e293b;
        }

        .header { grid-column: 1 / -1; background: #0f172a; display: flex; align-items: center; padding: 0 1.5rem; justify-content: space-between; border-bottom: 1px solid #334155; }
        .sidebar { background: #0f172a; overflow-y: auto; padding: 1.25rem; }
        .main-view { background: #020617; display: flex; flex-direction: column; position: relative; }
        .right-telemetry { background: #0f172a; border-left: 1px solid #334155; display: flex; flex-direction: column; }

        .panel-header { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #38bdf8; margin-bottom: 0.75rem; letter-spacing: 0.1em; border-left: 3px solid #38bdf8; padding-left: 0.5rem; }
        
        .input-group { margin-bottom: 1rem; }
        .label-row { display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.25rem; font-weight: 600; }
        .val-display { color: #38bdf8; font-family: 'JetBrains Mono', monospace; }
        
        input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #38bdf8; cursor: pointer; margin-top: -6px; border: 2px solid #0f172a; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: #334155; border-radius: 2px; }

        .data-card { background: #1e293b; padding: 0.75rem; border-radius: 4px; border: 1px solid #334155; margin-bottom: 0.5rem; }
        .data-label { font-size: 0.6rem; color: #94a3b8; text-transform: uppercase; display: block; }
        .data-value { font-size: 1.1rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

        .btn-prop { flex: 1; padding: 0.5rem; font-size: 0.7rem; font-weight: 700; border: 1px solid #334155; background: #1e293b; color: #94a3b8; cursor: pointer; }
        .btn-prop.active { background: #38bdf8; color: #0f172a; border-color: #7dd3fc; }

        #canvas-2d-container { flex: 1; position: relative; background: radial-gradient(circle, #0f172a 0%, #020617 100%); }
        #container-3d { flex: 1; min-height: 400px; border-bottom: 1px solid #334155; position: relative; }
    </style>
</head>
<body>

<div class="dashboard">
    <!-- HEADER -->
    <div class="header">
        <div class="flex items-center gap-4">
            <h1 class="text-xl font-black tracking-tighter text-white">MAR-PHYS <span class="text-sky-400">PRO</span></h1>
            <div class="h-6 w-px bg-slate-700"></div>
            <p class="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest">Localized Vector Mapping & Dual Compass</p>
        </div>
        <div class="flex gap-1 bg-slate-800 p-1 rounded">
            <button id="mode-sail" class="btn-prop active rounded-l" onclick="setMode('sail')">SAIL</button>
            <button id="mode-rotor" class="btn-prop" onclick="setMode('rotor')">ROTOR</button>
            <button id="mode-hybrid" class="btn-prop rounded-r" onclick="setMode('hybrid')">HYBRID</button>
        </div>
    </div>

    <!-- SIDEBAR: INPUTS -->
    <aside class="sidebar">
        <div class="panel-header">Navigation & Env</div>
        <div class="input-group">
            <div class="label-row"><span>True Wind Dir</span><span class="val-display" id="disp-twd">45°T</span></div>
            <input type="range" id="twd" min="0" max="360" value="45">
        </div>
        <div class="input-group">
            <div class="label-row"><span>True Wind Speed</span><span class="val-display" id="disp-tws">15 kts</span></div>
            <input type="range" id="tws" min="0" max="50" value="15">
        </div>
        <div class="input-group">
            <div class="label-row"><span>Magnetic Declination</span><span class="val-display text-red-400" id="disp-decl">10°E</span></div>
            <input type="range" id="decl" min="-30" max="30" value="10" step="1">
        </div>

        <div class="panel-header mt-6">Vessel Kinematics</div>
        <div class="input-group">
            <div class="label-row"><span>Heading (True)</span><span class="val-display" id="disp-hdg">0°T</span></div>
            <input type="range" id="hdg" min="0" max="360" value="0">
        </div>
        <div class="input-group">
            <div class="label-row"><span>Boat Speed</span><span class="val-display" id="disp-bs">6 kts</span></div>
            <input type="range" id="bs" min="0" max="30" value="6">
        </div>
        <div class="input-group">
            <div class="label-row"><span>Displacement (Mass)</span><span class="val-display" id="disp-mass">5000 kg</span></div>
            <input type="range" id="mass" min="1000" max="50000" value="5000" step="500">
        </div>

        <div id="ui-sail" class="mt-6">
            <div class="panel-header text-pink-400 border-pink-400">Sail Configuration</div>
            <div class="input-group">
                <div class="label-row"><span>Sail Trim</span><span class="val-display" id="disp-sang">35°</span></div>
                <input type="range" id="sang" min="-90" max="90" value="35">
            </div>
            <div class="input-group">
                <div class="label-row"><span>Sail Area</span><span class="val-display" id="disp-sarea">35 m²</span></div>
                <input type="range" id="sarea" min="5" max="150" value="35">
            </div>
        </div>

        <div id="ui-rotor" class="mt-6" style="display:none">
            <div class="panel-header text-orange-400 border-orange-400">Rotor Configuration</div>
            <div class="input-group">
                <div class="label-row"><span>Rotor RPM</span><span class="val-display text-orange-400" id="disp-rpm">180</span></div>
                <input type="range" id="rpm" min="-500" max="500" value="180" step="10">
            </div>
            <div class="input-group">
                <div class="label-row"><span>Rotor Height</span><span class="val-display" id="disp-rh">12 m</span></div>
                <input type="range" id="rh" min="4" max="25" value="12">
            </div>
        </div>
    </aside>

    <!-- MAIN VIEW: 2D ANALYSIS -->
    <main class="main-view">
        <div id="canvas-2d-container">
            <canvas id="canvas-2d"></canvas>
            
            <div class="absolute top-4 left-4 p-3 bg-slate-900/90 border border-slate-700 rounded-lg pointer-events-none">
                <h4 class="text-[0.6rem] font-bold text-slate-500 uppercase mb-2">Dual Compass</h4>
                <div class="flex items-center gap-2 text-[0.7rem]"><span class="w-3 h-1 bg-slate-400"></span> True North</div>
                <div class="flex items-center gap-2 text-[0.7rem]"><span class="w-3 h-1 bg-red-500"></span> Magnetic North</div>
            </div>

            <div class="absolute bottom-4 left-4 p-3 bg-slate-900/90 border border-slate-700 rounded-lg pointer-events-none">
                <h4 class="text-[0.6rem] font-bold text-slate-500 uppercase mb-2">Localized Vector Map</h4>
                <div class="grid grid-cols-2 gap-x-6 gap-y-1">
                    <div class="flex items-center gap-2 text-[0.65rem]"><span class="w-3 h-1 bg-blue-500"></span> True Wind (Global)</div>
                    <div class="flex items-center gap-2 text-[0.65rem]"><span class="w-3 h-1 bg-cyan-400"></span> App. Wind (Bow)</div>
                    <div class="flex items-center gap-2 text-[0.65rem]"><span class="w-3 h-1 bg-pink-500"></span> Lift (Mast/Rotor)</div>
                    <div class="flex items-center gap-2 text-[0.65rem]"><span class="w-3 h-1 bg-orange-500"></span> Aero Drag (Mast/Rotor)</div>
                    <div class="flex items-center gap-2 text-[0.65rem]"><span class="w-3 h-1 bg-green-500"></span> Total Drive (CG)</div>
                    <div class="flex items-center gap-2 text-[0.65rem]"><span class="w-3 h-1 bg-red-600"></span> Total Heel (CG)</div>
                    <div class="flex items-center gap-2 text-[0.65rem] col-span-2"><span class="w-3 h-1 bg-indigo-500"></span> Hull Water Drag (Keel)</div>
                </div>
            </div>
        </div>
    </main>

    <!-- RIGHT: 3D & DATA -->
    <aside class="right-telemetry">
        <div id="container-3d">
            <!-- ThreeJS -->
        </div>
        <div class="p-4 overflow-y-auto flex-1 bg-slate-900">
            <div class="panel-header">Real-Time Telemetry</div>
            <div class="grid grid-cols-2 gap-2">
                <div class="data-card"><span class="data-label">AWS</span><span class="data-value text-cyan-400" id="out-aws">0.0 kts</span></div>
                <div class="data-card"><span class="data-label">AWA</span><span class="data-value text-cyan-400" id="out-awa">0°</span></div>
                <div class="data-card col-span-2"><span class="data-label">Net Acceleration</span><span class="data-value text-yellow-400" id="out-acc">0.000 m/s²</span></div>
                <div class="data-card"><span class="data-label">Total Drive Force</span><span class="data-value text-green-400" id="out-drive">0 N</span></div>
                <div class="data-card"><span class="data-label">Total Heeling Force</span><span class="data-value text-red-500" id="out-heel">0 N</span></div>
                <div class="data-card"><span class="data-label">Hull Resistance</span><span class="data-value text-indigo-400" id="out-hdrag">0 N</span></div>
                <div class="data-card"><span class="data-label">Spin Ratio (α)</span><span class="data-value text-orange-400" id="out-alpha">0.0</span></div>
            </div>
        </div>
    </aside>
</div>

<script>
    // ==========================================
    // 1. PHYSICS ENGINE
    // ==========================================
    const KTS_TO_MS = 0.51444;
    const RHO_AIR = 1.225;
    const RHO_WATER = 1025;
    const HULL_DRAG_COEF = 0.08;

    let cfg = {
        mode: 'sail', tws: 15, twd: 45, decl: 10, bs: 6, hdg: 0, mass: 5000,
        sang: 35, sarea: 35, rpm: 180, rh: 12, rd: 2.5
    };

    let phys = {
        vTW: {x:0,y:0}, vBoat: {x:0,y:0}, vAW: {x:0,y:0}, awa: 0, aws: 0,
        sail: { L:0, D:0, vL:{x:0,y:0}, vD:{x:0,y:0}, drive:0, heel:0 },
        rotor: { L:0, D:0, vL:{x:0,y:0}, vD:{x:0,y:0}, drive:0, heel:0, alpha:0 },
        driveN: 0, heelN: 0, hullDragN: 0, acc: 0,
        vTotDrive: {x:0,y:0}, vTotHeel: {x:0,y:0}, vHullDrag: {x:0,y:0}
    };

    const Vec = {
        fromAng: (deg, mag) => { const r = deg * Math.PI / 180; return { x: mag * Math.sin(r), y: mag * Math.cos(r) }; },
        add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
        sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
        mag: (v) => Math.sqrt(v.x*v.x + v.y*v.y),
        norm: (v) => { const m = Vec.mag(v); return m === 0 ? {x:0,y:0} : {x: v.x/m, y: v.y/m}; },
        mult: (v, n) => ({ x: v.x * n, y: v.y * n }),
        dot: (v1, v2) => (v1.x * v2.x + v1.y * v2.y),
        angle: (v) => Math.atan2(v.x, v.y) * 180 / Math.PI
    };

    function updatePhysics() {
        const tws = cfg.tws * KTS_TO_MS;
        const bs = cfg.bs * KTS_TO_MS;
        
        phys.vTW = Vec.fromAng(cfg.twd + 180, tws);
        phys.vBoat = Vec.fromAng(cfg.hdg, bs);
        phys.vAW = Vec.sub(phys.vTW, phys.vBoat);
        phys.aws = Vec.mag(phys.vAW);
        
        const awDir = Vec.angle(phys.vAW);
        const awNorm = Vec.norm(phys.vAW);

        let awa = (awDir + 180) % 360 - cfg.hdg;
        if (awa > 180) awa -= 360; if (awa < -180) awa += 360;
        phys.awa = awa;

        const dynP = 0.5 * RHO_AIR * Math.pow(phys.aws, 2);
        const fwd = Vec.fromAng(cfg.hdg, 1);
        const side = Vec.fromAng(cfg.hdg + 90, 1);

        phys.sail = { L:0, D:0, vL:{x:0,y:0}, vD:{x:0,y:0}, drive:0, heel:0 };
        phys.rotor = { L:0, D:0, vL:{x:0,y:0}, vD:{x:0,y:0}, alpha:0, drive:0, heel:0 };

        if (cfg.mode === 'sail' || cfg.mode === 'hybrid') {
            const sailRad = (cfg.hdg + cfg.sang) * Math.PI / 180;
            const aoa = Math.atan2(phys.vAW.y, phys.vAW.x) - Math.atan2(Math.cos(sailRad), Math.sin(sailRad));
            const cl = 1.4 * Math.sin(2 * aoa);
            const cd = 0.15 + 1.1 * Math.pow(Math.sin(aoa), 2);
            const liftDir = Vec.fromAng(awDir - 90 * Math.sign(cl), 1);
            
            phys.sail.L = dynP * cfg.sarea * Math.abs(cl);
            phys.sail.D = dynP * cfg.sarea * cd;
            phys.sail.vL = Vec.mult(liftDir, phys.sail.L);
            phys.sail.vD = Vec.mult(awNorm, phys.sail.D);
            const tot = Vec.add(phys.sail.vL, phys.sail.vD);
            phys.sail.drive = Vec.dot(tot, fwd);
            phys.sail.heel = Vec.dot(tot, side);
        }

        if (cfg.mode === 'rotor' || cfg.mode === 'hybrid') {
            const omega = cfg.rpm * (2 * Math.PI / 60);
            const U = omega * (cfg.rd / 2);
            const alpha = (phys.aws > 0.1) ? (U / phys.aws) : 0;
            phys.rotor.alpha = alpha;
            const cl = Math.min(Math.abs(alpha) * 2.6, 9.5);
            const cd = 0.6 + 0.45 * Math.abs(alpha);
            const liftSign = cfg.rpm >= 0 ? -1 : 1;
            const liftDir = Vec.fromAng(awDir + 90 * liftSign, 1);

            phys.rotor.L = dynP * (cfg.rh * cfg.rd) * cl;
            phys.rotor.D = dynP * (cfg.rh * cfg.rd) * cd;
            phys.rotor.vL = Vec.mult(liftDir, phys.rotor.L);
            phys.rotor.vD = Vec.mult(awNorm, phys.rotor.D);
            const tot = Vec.add(phys.rotor.vL, phys.rotor.vD);
            phys.rotor.drive = Vec.dot(tot, fwd);
            phys.rotor.heel = Vec.dot(tot, side);
        }

        phys.driveN = phys.sail.drive + phys.rotor.drive;
        phys.heelN = phys.sail.heel + phys.rotor.heel;
        phys.hullDragN = HULL_DRAG_COEF * RHO_WATER * Math.pow(bs, 2);
        
        phys.vTotDrive = Vec.mult(fwd, phys.driveN);
        phys.vTotHeel = Vec.mult(side, phys.heelN);
        phys.vHullDrag = Vec.mult(Vec.fromAng(cfg.hdg + 180, 1), phys.hullDragN);

        phys.acc = (phys.driveN - phys.hullDragN) / cfg.mass;
        updateHUD();
    }

    function updateHUD() {
        document.getElementById('out-aws').innerText = (phys.aws / KTS_TO_MS).toFixed(1) + ' kts';
        document.getElementById('out-awa').innerText = Math.abs(Math.round(phys.awa)) + '° ' + (phys.awa > 0 ? 'S' : 'P');
        document.getElementById('out-drive').innerText = Math.round(phys.driveN).toLocaleString() + ' N';
        document.getElementById('out-heel').innerText = Math.round(phys.heelN).toLocaleString() + ' N';
        document.getElementById('out-hdrag').innerText = Math.round(phys.hullDragN).toLocaleString() + ' N';
        
        const accEl = document.getElementById('out-acc');
        accEl.innerText = `${phys.acc > 0 ? '+' : ''}${phys.acc.toFixed(3)} m/s²`;
        accEl.className = `data-value ${phys.acc >= 0 ? 'text-yellow-400' : 'text-red-500'}`;
        
        document.getElementById('out-alpha').innerText = phys.rotor.alpha.toFixed(2);
    }

    // ==========================================
    // 2. 2D CANVAS: DUAL COMPASS & LOCALIZED VECTORS
    // ==========================================
    const canvas2d = document.getElementById('canvas-2d');
    const ctx = canvas2d.getContext('2d');
    const container2d = document.getElementById('canvas-2d-container');

    function resize2D() { canvas2d.width = container2d.clientWidth; canvas2d.height = container2d.clientHeight; }
    window.addEventListener('resize', resize2D); resize2D();

    function drawArrow(x, y, vx, vy, color, width=2) {
        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return;
        const head = 8; const angle = Math.atan2(vy, vx);
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vx, y + vy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + vx, y + vy);
        ctx.lineTo(x + vx - head * Math.cos(angle - Math.PI/7), y + vy - head * Math.sin(angle - Math.PI/7));
        ctx.lineTo(x + vx - head * Math.cos(angle + Math.PI/7), y + vy - head * Math.sin(angle + Math.PI/7));
        ctx.fill();
    }

    function render2D() {
        const w = canvas2d.width, h = canvas2d.height;
        const scale = Math.min(w, h) / 100;
        ctx.clearRect(0,0,w,h);
        ctx.save();
        ctx.translate(w/2, h/2);
        ctx.scale(1, -1);

        // --- DUAL COMPASS ROSE ---
        const crRadius = 45 * scale;
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0,0, crRadius, 0, Math.PI*2); ctx.stroke();
        
        // True North Markers
        ctx.fillStyle = '#64748b'; ctx.font = "10px Inter";
        ctx.save(); ctx.scale(1,-1); ctx.fillText("N", -4, -crRadius - 5); ctx.restore();
        for(let i=0; i<360; i+=30) {
            const v = Vec.fromAng(i, crRadius);
            ctx.beginPath(); ctx.moveTo(v.x*0.95, v.y*0.95); ctx.lineTo(v.x, v.y); ctx.stroke();
        }

        // Magnetic North Indicator
        const magV = Vec.fromAng(cfg.decl, crRadius * 0.95);
        drawArrow(0,0, magV.x, magV.y, '#ef4444', 1.5);
        ctx.save(); ctx.scale(1,-1); ctx.fillStyle='#ef4444'; 
        ctx.fillText("M", magV.x - 4, -magV.y - 5); 
        ctx.restore();

        // --- BOAT RENDERING ---
        const boatLen = 22 * scale;
        ctx.save();
        ctx.rotate(-cfg.hdg * Math.PI / 180);
        
        ctx.fillStyle = '#f8fafc'; ctx.beginPath();
        ctx.moveTo(0, boatLen/2); ctx.bezierCurveTo(7*scale, 5*scale, 6*scale, -10*scale, 5*scale, -boatLen/2);
        ctx.lineTo(-5*scale, -boatLen/2); ctx.bezierCurveTo(-6*scale, -10*scale, -7*scale, 5*scale, 0, boatLen/2);
        ctx.fill(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.stroke();
        
        // Origins
        const bowP = { x: 0, y: boatLen/2 };
        const sailP = { x: 0, y: cfg.mode === 'hybrid' ? 4*scale : 2*scale };
        const rotorP = { x: 0, y: cfg.mode === 'hybrid' ? -6*scale : 2*scale };
        const keelP = { x: 0, y: 0 };

        // Scale factors for visual representation
        const maxF = Math.max(Math.abs(phys.driveN), Math.abs(phys.heelN), 1000);
        const fScl = (25 * scale) / maxF;
        const awScl = scale * 1.5;

        // --- LOCALIZED VECTORS ---
        
        // 1. Apparent Wind (Originates from Bow)
        // Note: The vector itself is global, but we draw it originating from the bow to show local effect
        // Wait, rotating the canvas rotated our coordinate system. 
        // We need to rotate the global vectors BACK by HDG to draw them correctly in the boat's local space.
        
        function rotateVec(v, angle) {
            const r = angle * Math.PI / 180;
            return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) };
        }

        const awLocal = rotateVec(phys.vAW, cfg.hdg);
        drawArrow(bowP.x, bowP.y, awLocal.x * awScl, awLocal.y * awScl, '#22d3ee', 2.5);

        if(cfg.mode !== 'rotor') {
            const lLocal = rotateVec(phys.sail.vL, cfg.hdg);
            const dLocal = rotateVec(phys.sail.vD, cfg.hdg);
            ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(sailP.x, sailP.y, 3, 0, Math.PI*2); ctx.fill();
            drawArrow(sailP.x, sailP.y, lLocal.x*fScl, lLocal.y*fScl, '#f472b6', 2);
            drawArrow(sailP.x, sailP.y, dLocal.x*fScl, dLocal.y*fScl, '#fb923c', 2);
        }
        if(cfg.mode !== 'sail') {
            const lLocal = rotateVec(phys.rotor.vL, cfg.hdg);
            const dLocal = rotateVec(phys.rotor.vD, cfg.hdg);
            ctx.fillStyle = '#fdba74'; ctx.beginPath(); ctx.arc(rotorP.x, rotorP.y, 4, 0, Math.PI*2); ctx.fill();
            drawArrow(rotorP.x, rotorP.y, lLocal.x*fScl, lLocal.y*fScl, '#f472b6', 2);
            drawArrow(rotorP.x, rotorP.y, dLocal.x*fScl, dLocal.y*fScl, '#fb923c', 2);
        }

        // Hull Water Drag (Originates from Keel, points backwards)
        const hdLocal = rotateVec(phys.vHullDrag, cfg.hdg);
        drawArrow(keelP.x, keelP.y, hdLocal.x*fScl, hdLocal.y*fScl, '#4f46e5', 3);
        
        ctx.restore(); // Restore to Global Coordinates

        // True Wind (Global Origin)
        drawArrow(0,0, phys.vTW.x*awScl, phys.vTW.y*awScl, '#3b82f6', 2);
        
        // Total Outcomes (Global Origin, but represents CG)
        drawArrow(0,0, phys.vTotDrive.x*fScl, phys.vTotDrive.y*fScl, '#22c55e', 4);
        drawArrow(0,0, phys.vTotHeel.x*fScl, phys.vTotHeel.y*fScl, '#ef4444', 4);
        
        ctx.restore();
    }

    // ==========================================
    // 3. 3D VIEW: ENHANCED GRAPHICS & VECTORS
    // ==========================================
    const c3d = document.getElementById('container-3d');
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#020617');
    const camera = new THREE.PerspectiveCamera(45, c3d.clientWidth / c3d.clientHeight, 0.1, 1000);
    camera.position.set(35, 25, 35);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(c3d.clientWidth, c3d.clientHeight);
    c3d.appendChild(renderer.domElement);
    const ctrl = new THREE.OrbitControls(camera, renderer.domElement);
    ctrl.enableDamping = true;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(50, 50, 20); scene.add(sun);

    // Reflective Water
    const waterG = new THREE.PlaneGeometry(500, 500);
    const waterM = new THREE.MeshPhysicalMaterial({ 
        color: 0x0c4a6e, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.1,
        transmission: 0.5, clearcoat: 1.0
    });
    const water = new THREE.Mesh(waterG, waterM);
    water.rotation.x = -Math.PI / 2; scene.add(water);
    scene.add(new THREE.GridHelper(200, 50, 0x1e293b, 0x0f172a));

    // Dynamic Wake
    const wakeG = new THREE.BufferGeometry();
    const wakeV = new Float32Array([ 0,0,0, -3,0,10, 3,0,10 ]);
    wakeG.setAttribute('position', new THREE.BufferAttribute(wakeV, 3));
    const wakeM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const wake = new THREE.Mesh(wakeG, wakeM);
    wake.position.y = 0.05; scene.add(wake);

    // 3D Compass Rose (True North)
    const roseG = new THREE.RingGeometry(20, 22, 64);
    const roseM = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const rose = new THREE.Mesh(roseG, roseM);
    rose.rotation.x = -Math.PI / 2; rose.position.y = -0.5; scene.add(rose);
    // North Marker
    const nMarker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 4), new THREE.MeshBasicMaterial({color: 0x38bdf8}));
    nMarker.position.set(0, -0.5, -21); scene.add(nMarker);

    // --- BOAT ASSETS ---
    const boat = new THREE.Group(); scene.add(boat);

    // Hull
    const hullS = new THREE.Shape(); 
    hullS.moveTo(0, 7); hullS.bezierCurveTo(2, 4, 3, -4, 2, -7); hullS.lineTo(-2, -7); hullS.bezierCurveTo(-3, -4, -2, 4, 0, 7);
    const hullG = new THREE.ExtrudeGeometry(hullS, { depth: 2, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3 });
    hullG.rotateX(Math.PI/2); hullG.translate(0, 0.5, 0);
    const hullMesh = new THREE.Mesh(hullG, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 }));
    boat.add(hullMesh);

    // Keel (Underwater)
    const keelG = new THREE.BoxGeometry(0.4, 3, 4);
    const keel = new THREE.Mesh(keelG, new THREE.MeshStandardMaterial({ color: 0x334155 }));
    keel.position.set(0, -1.5, 0); boat.add(keel);

    // Wooden Deck
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 13.5), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
    deck.rotation.x = -Math.PI/2; deck.position.y = 2.51; boat.add(deck);

    // Mast & Sail
    const sailGrp = new THREE.Group(); boat.add(sailGrp);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 18), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    mast.position.y = 9; sailGrp.add(mast);
    const sailG = new THREE.PlaneGeometry(6, 14); sailG.translate(0, 8, 3.5);
    const sail = new THREE.Mesh(sailG, new THREE.MeshStandardMaterial({ color: 0xfde047, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    sailGrp.add(sail);

    // Rotor
    const rotorGrp = new THREE.Group(); boat.add(rotorGrp);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1, 32), new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.5 }));
    rotorGrp.add(cyl);
    for(let i=0; i<4; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 2.6), new THREE.MeshStandardMaterial({color: 0xea580c}));
        rib.rotation.y = (Math.PI/4)*i; cyl.add(rib);
    }

    // --- 3D ARROW HELPERS (LOCALIZED) ---
    // Scene Global
    const twArr = new THREE.ArrowHelper(new THREE.Vector3(0,0,-1), new THREE.Vector3(0,15,0), 10, 0x3b82f6, 1.5, 1); scene.add(twArr);
    
    // Boat Local
    const awArr = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(0, 3, -7), 10, 0x22d3ee, 2, 1); boat.add(awArr); // Bow
    const drArr = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(0, 3, 0), 10, 0x22c55e, 3, 1.5); boat.add(drArr); // CG
    const hlArr = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(0, 3, 0), 10, 0xef4444, 3, 1.5); boat.add(hlArr); // CG
    const kDragArr = new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0, -2, 0), 10, 0x4f46e5, 2, 1); boat.add(kDragArr); // Keel bottom
    
    // Mast Local
    const sLiftArr = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(0, 6, 0), 10, 0xf472b6, 1.5, 1); sailGrp.add(sLiftArr);
    const sDragArr = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(0, 6, 0), 10, 0xfb923c, 1.5, 1); sailGrp.add(sDragArr);
    
    // Rotor Local
    const rLiftArr = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(0, 6, 0), 10, 0xf472b6, 1.5, 1); rotorGrp.add(rLiftArr);
    const rDragArr = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(0, 6, 0), 10, 0xfb923c, 1.5, 1); rotorGrp.add(rDragArr);


    function setMode(m) {
        cfg.mode = m;
        document.querySelectorAll('.btn-prop').forEach(b => b.classList.remove('active'));
        document.getElementById('mode-'+m).classList.add('active');
        document.getElementById('ui-sail').style.display = (m==='sail'||m==='hybrid') ? 'block' : 'none';
        document.getElementById('ui-rotor').style.display = (m==='rotor'||m==='hybrid') ? 'block' : 'none';
        
        sailGrp.visible = (m==='sail'||m==='hybrid');
        rotorGrp.visible = (m==='rotor'||m==='hybrid');
        sLiftArr.visible = sailGrp.visible; sDragArr.visible = sailGrp.visible;
        rLiftArr.visible = rotorGrp.visible; rDragArr.visible = rotorGrp.visible;

        sailGrp.position.z = (m==='hybrid') ? -2.5 : 0;
        rotorGrp.position.z = (m==='hybrid') ? 3 : 0;
    }

    // --- UI EVENTS ---
    const inputs = ['tws', 'twd', 'decl', 'bs', 'hdg', 'mass', 'sang', 'sarea', 'rpm', 'rh'];
    inputs.forEach(id => document.getElementById(id).addEventListener('input', (e) => {
        cfg[id] = parseFloat(e.target.value);
        let unit = '';
        if(id==='tws'||id==='bs') unit=' kts'; else if(id==='mass') unit=' kg'; else if(id==='sarea') unit=' m²'; else if(id==='rh') unit=' m'; else if(id!=='rpm') unit='°';
        document.getElementById('disp-'+id).innerText = cfg[id] + unit;
        if(id==='twd'||id==='hdg') document.getElementById('disp-'+id).innerText += 'T';
        if(id==='decl') document.getElementById('disp-'+id).innerText = Math.abs(cfg[id]) + '°' + (cfg[id]>=0?'E':'W');
    }));

    // --- RENDER LOOP ---
    let lastT = 0;
    function run(t) {
        const dt = (t - lastT) / 1000; lastT = t;
        updatePhysics();
        render2D();

        // --- Update 3D Transformations ---
        // 3D Engine mapping: +X=Right, +Y=Up, -Z=Forward
        // Math Engine mapping: +X=Right, +Y=Forward
        
        boat.rotation.y = -cfg.hdg * Math.PI / 180;
        sailGrp.rotation.y = -cfg.sang * Math.PI / 180;
        
        if(rotorGrp.visible) {
            cyl.rotation.y -= (cfg.rpm * 2 * Math.PI / 60) * dt;
            cyl.scale.set(1, cfg.rh, 1); 
            cyl.position.y = cfg.rh/2 + 2.5;
            rLiftArr.position.y = cfg.rh/2 + 2.5;
            rDragArr.position.y = cfg.rh/2 + 2.5;
        }

        wake.position.set(boat.position.x, 0.05, boat.position.z);
        wake.rotation.y = boat.rotation.y;
        const wkScl = Math.max(0, (cfg.bs - 2) / 5);
        wake.scale.set(wkScl, 1, wkScl * 2);
        wake.visible = cfg.bs > 2;

        // --- Update 3D Arrows ---
        function mathTo3D(v) { return new THREE.Vector3(v.x, 0, -v.y); }
        function setArr(arr, vecMath, scaleFactor=0.005, minL=0.1) {
            if(Vec.mag(vecMath) < 0.1) { arr.setLength(0.01); return; }
            arr.setDirection(mathTo3D(Vec.norm(vecMath)));
            arr.setLength(Math.max(minL, Vec.mag(vecMath) * scaleFactor));
        }

        // Global Vectors
        setArr(twArr, phys.vTW, 0.5, 2);
        
        // Convert Math vectors to boat's local space for local arrows
        const hdgRad = cfg.hdg * Math.PI / 180;
        const localAW = {
            x: phys.vAW.x * Math.cos(hdgRad) + phys.vAW.y * Math.sin(hdgRad),
            y: -phys.vAW.x * Math.sin(hdgRad) + phys.vAW.y * Math.cos(hdgRad)
        };
        setArr(awArr, localAW, 0.5, 2);

        // Drive & Heel (Local by definition)
        const vDLocal = {x: 0, y: phys.driveN};
        const vHLocal = {x: phys.heelN, y: 0};
        
        // Logarithmic scaling for massive physical forces so they fit on screen
        const forceScale = val => Math.log10(Math.abs(val) + 1) * 2.5;
        
        if(Math.abs(phys.driveN) > 1) { drArr.setDirection(mathTo3D(Vec.norm(vDLocal))); drArr.setLength(forceScale(phys.driveN)); } else drArr.setLength(0.01);
        if(Math.abs(phys.heelN) > 1) { hlArr.setDirection(mathTo3D(Vec.norm(vHLocal))); hlArr.setLength(forceScale(phys.heelN)); } else hlArr.setLength(0.01);
        
        if(phys.hullDragN > 1) kDragArr.setLength(forceScale(phys.hullDragN)); else kDragArr.setLength(0.01);

        // Mast/Rotor Local Vectors (Need to un-rotate by HDG, and then un-rotate by sail angle for mast)
        const unRot = (v, ang) => { const r = ang * Math.PI / 180; return { x: v.x * Math.cos(r) + v.y * Math.sin(r), y: -v.x * Math.sin(r) + v.y * Math.cos(r) }; };
        
        if(sailGrp.visible) {
            const sLAng = cfg.hdg + cfg.sang;
            setArr(sLiftArr, unRot(phys.sail.vL, sLAng), 0.002);
            setArr(sDragArr, unRot(phys.sail.vD, sLAng), 0.002);
        }
        if(rotorGrp.visible) {
            setArr(rLiftArr, unRot(phys.rotor.vL, cfg.hdg), 0.002);
            setArr(rDragArr, unRot(phys.rotor.vD, cfg.hdg), 0.002);
        }

        ctrl.update();
        renderer.render(scene, camera);
        requestAnimationFrame(run);
    }

    window.onload = () => { setMode('sail'); requestAnimationFrame(run); };
    window.addEventListener('resize', () => {
        camera.aspect = c3d.clientWidth / c3d.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(c3d.clientWidth, c3d.clientHeight);
        resize2D();
    });
</script>
</body>
</html>
