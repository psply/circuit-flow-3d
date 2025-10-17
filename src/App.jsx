// Circuit Flow 3D - Full Game (5 auto-generated levels)
// Features: 5 auto-generated levels, top dot selector, click-to-rotate, smooth animations, BFS path detection, energy particles, UI instructions, reset (R), fullscreen, sci-fi theme

import React, { useRef, useState, useMemo, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

// ---------------- CONFIG ----------------
const SPACING = 1.6
const BG = '#071022'
const ACCENT = '#00E5FF'
const LEVEL_COUNT = 10

// ---------------- HELPERS ----------------
const opposites = { '+x':'-x','-x':'+x','+y':'-y','-y':'+y','+z':'-z','-z':'+z' }
const rotateYOrder = ['+x','+z','-x','-z']
function rotateConnections(base, rotSteps){
  const res = []
  base.forEach(c=>{
    if(c==='+y' || c==='-y'){ res.push(c); return }
    const idx = rotateYOrder.indexOf(c)
    if(idx===-1) return
    res.push(rotateYOrder[(idx+rotSteps)%4])
  })
  return Array.from(new Set(res))
}
function posKey(g){ return `${g[0]},${g[1]},${g[2]}` }

// ---------------- LEVEL GENERATOR ----------------
function generateLevel(n){
  // n from 1..LEVEL_COUNT, increasing complexity
  const nodes = []
  let id=1
  function add(grid, type, base, rot=0){ nodes.push({ id: id++, grid, type, base, rot, position:[grid[0]*SPACING, grid[1]*SPACING, grid[2]*SPACING] }) }

  if(n===1){
    // simple straight 3 in a row
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+x'],1)
    add([2,0,0],'target',['-x'],0)
  } else if(n===2){
    // one corner
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+z'],1)
    add([1,0,1],'wire',['-z','+x'],0)
    add([2,0,1],'target',['-x'],0)
  } else if(n===3){
    // small 3D: up and across
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+y'],0)
    add([1,1,0],'wire',['-y','+x'],1)
    add([2,1,0],'wire',['-x','+z'],0)
    add([2,1,1],'target',['-z'],0)
  } else if(n===4){
    // branching puzzle
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+x','+z'],0)
    add([2,0,0],'wire',['-x','+z'],1)
    add([2,0,1],'wire',['-z','+y'],0)
    add([2,1,1],'target',['-y'],0)
    add([1,1,0],'wire',['-y','+z'],0)
    add([1,1,1],'wire',['-z','+x'],2)
    add([3,0,1],'wire',['+y','-y'],0) // distractor
  } else if(n===5) {
    // n===5 complex 3D cross
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+x'],3)  // rot=3: +z/-z (no -x from source, needs 1 rot)
    add([2,0,0],'wire',['-x','+z'],2)  // rot=2: +x/-z (misdirect to new distractor below, needs 2 rots)
    add([2,0,1],'wire',['-z','+y'],3)  // rot=3: -x/+y (no -z from prev, needs 1 rot)
    add([2,1,1],'wire',['-y','+x'],1)  // rot=1: -y/+z (misdirect up-Z to empty, needs 3 rots to +x)
    add([3,1,1],'wire',['-x','+z'],1)  // rot=1: +z/-z (no -x from prev, needs 3 rots)
    add([3,1,2],'target',['-z'],0)     // Receives +z from Wire6
    // Distractors: vertical stubs + new dead-end branch for max confusion
    add([1,1,0],'wire',['+y','-y'],0)
    add([0,1,0],'wire',['+y','-y'],0)
    add([3,0,0],'wire',['-x','+y'],0)  // New: looks connectable from Wire3 -z? But +y dead-ends
  } else if(n===6){
    // Extended branching: 2 dead ends, choose path (~4 rots total)
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+x','+y'],3)  // rot=3: +z/-z mis (no -x), need 1 rot
    add([2,0,0],'wire',['-x','+x','+y'],3)  // rot=3: +z/-y mis, need 1 rot for +y up
    add([2,0,1],'wire',['-z','+x'],1)  // Dead: +z/-y mis to empty
    add([2,1,0],'wire',['-y','+z'],2)  // rot=2: -y/-z mis, need 2 rots for +z to target
    add([2,1,1],'target',['-z'],0)
    add([1,1,0],'wire',['-y','+x'],3)  // Dead up: +z/-y mis
    add([0,1,0],'wire',['+y','-y'],0)
  } else if(n===7){
    // Loop risk: cycle misdirect (~6 rots)
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+x','+z'],3)  // rot=3: -z/+z mis, need 1 rot for +z to Wire3
    add([1,0,1],'wire',['-z','+y','+x'],2)  // rot=2: -y/+x mis, need 2 rots for +y to id7
    add([2,0,1],'wire',['-x','-z'],3)  // Dead: rot=3 +y/+x loop bait to empty
    add([2,1,1],'wire',['-y','-x','+z'],3)  // rot=3: -y/-z/+x mis, need 2 rots for -x/+z
    add([2,1,2],'target',['-z'],0)
    add([1,1,1],'wire',['-y','+x'],1)  // Loop conn: rot=1 +z/-y bait, need 3 rots for +x to Wire5
    add([2,1,0],'wire',['+y','-y'],0)
  } else if(n===8){
    // Multi-layer deep Y+Z (~8 rots)
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+y'],3)  // Mis -y
    add([1,1,0],'wire',['-y','+z'],1)
    add([1,1,1],'wire',['-z','+y'],3)
    add([1,2,1],'wire',['-y','+x'],1)
    add([2,2,1],'wire',['-x','+z'],3)
    add([2,2,2],'target',['-z'],0)
    add([0,1,0],'wire',['+y','-y'],0)
    add([2,1,1],'wire',['+y','-y'],0)
  } else if(n===9){
    // High density crowded cross (~10 rots, 11 nodes)
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+x','+z'],3)  // rot=3: +x/+z/-z mis (no -x), need 1 rot
    add([1,0,1],'wire',['-z','+y'],3)  // rot=3: -x/+y mis (no -z), need 1 rot
    add([1,1,1],'wire',['-y','+z'],1)  // rot=1: -y/-x mis (no +z), need 3 rots
    add([1,1,2],'wire',['-z','+x'],1)  // rot=1: +x/+z mis (no -z), need 3 rots
    add([2,1,2],'wire',['-x','+y'],1)  // rot=1: +z/+y mis (no -x), need 3 rots
    add([2,2,2],'target',['-y'],0)
    add([2,0,0],'wire',['-x','+z'],2)  // Bait: +x/-z dead-end
    add([0,1,0],'wire',['+y','-y'],0)
    add([2,0,1],'wire',['+y','-y'],1)
    add([1,2,1],'wire',['+x','-x'],3)  // Bait: +z/-z upper distract
  } else {  // n===10 ultimate hidden deep (~12 rots, 12 nodes)
    add([0,0,0],'source',['+x'],0)
    add([1,0,0],'wire',['-x','+z'],1)
    add([1,0,1],'wire',['-z','+y'],1)
    add([1,1,1],'wire',['-y','+x'],3)  // Mis down
    add([2,1,1],'wire',['-x','+z'],2)
    add([2,1,2],'wire',['-z','+y'],1)
    add([2,2,2],'target',['-y'],0)
    add([0,1,0],'wire',['+y','-y'],0)
    add([3,0,0],'wire',['-x','+x'],1)
    add([1,2,0],'wire',['+y','-y'],2)
    add([2,0,1],'wire',['+z','-z'],3)
    add([0,0,1],'wire',['+x','-x'],1)
  }

  return nodes
}

// ---------------- NODE VISUAL ----------------
function NodeVisual({ node, active, onRotate }){
  const ref = useRef()
  const targetY = (node.rot%4) * (Math.PI/2)
  useFrame((_, delta)=>{
    if(!ref.current) return
    ref.current.rotation.y += (targetY - ref.current.rotation.y) * Math.min(1, delta*12)
  })

  const rotated = rotateConnections(node.base, node.rot)
  const dotPos = {'+x':[0.8,0,0],'-x':[-0.8,0,0],'+y':[0,0.8,0],'-y':[0,-0.8,0],'+z':[0,0,0.8],'-z':[0,0,-0.8]}

  return (
    <group position={node.position}>
      <mesh ref={ref} onPointerDown={(e)=>{e.stopPropagation(); if(node.type==='wire') onRotate(node.id)}} castShadow>
        <boxGeometry args={[1,1,1]} />
        <meshStandardMaterial color={node.type==='source'? '#ff9800': node.type==='target'? '#00e5ff': (active? '#0fb3c6':'#111827')} emissive={active? ACCENT : '#000'} emissiveIntensity={active?0.8:0.0} metalness={0.25} roughness={0.5} />
      </mesh>
      {rotated.map(d=> (
        <mesh key={d} position={dotPos[d]}>
          <sphereGeometry args={[0.12,12,12]} />
          <meshStandardMaterial emissive={active?ACCENT:'#666'} emissiveIntensity={active?1.6:0.6} color={active?ACCENT:'#999'} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------- PATH FINDING ----------------
function getNeighbors(node, map){
  const dirs = {'+x':[1,0,0],'-x':[-1,0,0],'+y':[0,1,0],'-y':[0,-1,0],'+z':[0,0,1],'-z':[0,0,-1]}
  const rotated = rotateConnections(node.base, node.rot)
  const res = []
  rotated.forEach(dir=>{
    const d = dirs[dir]
    const key = posKey([node.grid[0]+d[0], node.grid[1]+d[1], node.grid[2]+d[2]])
    const nb = map.get(key)
    if(!nb) return
    const opp = opposites[dir]
    const nbRot = rotateConnections(nb.base, nb.rot)
    if(nbRot.includes(opp)) res.push(nb)
  })
  return res
}

function findPath(nodes){
  const map = new Map(nodes.map(n=>[posKey(n.grid), n]))
  const source = nodes.find(n=>n.type==='source')
  const target = nodes.find(n=>n.type==='target')
  if(!source || !target) return null
  const q = [source]
  const prev = new Map()
  const visited = new Set([posKey(source.grid)])
  while(q.length){
    const cur = q.shift()
    if(cur.id === target.id) break
    const neigh = getNeighbors(cur, map)
    for(const nb of neigh){
      const key = posKey(nb.grid)
      if(visited.has(key)) continue
      visited.add(key)
      prev.set(nb.id, cur.id)
      q.push(nb)
    }
  }
  if(!prev.has(target.id) && source.id !== target.id) return null
  const pathIds = []
  let curId = target.id
  while(curId !== undefined){
    pathIds.push(curId)
    if(curId === source.id) break
    curId = prev.get(curId)
  }
  pathIds.reverse()
  return pathIds.map(id => nodes.find(n=>n.id===id))
}

// ---------------- ENERGY PARTICLES ----------------
function EnergyParticles({ path }){
  const ref = useRef()
  const N = Math.max(8, path.length * 5)
  const particles = useMemo(()=> new Array(N).fill(0).map((_,i)=> ({ offset: i/N })), [path])
  const pts = useMemo(()=> path.map(p=> p.position), [path])
  useFrame((state)=>{
    const t = state.clock.getElapsedTime()
    if(!ref.current) return
    for(let i=0;i<particles.length;i++){
      const u = (particles[i].offset + t*0.25) % 1
      const total = Math.max(1, pts.length - 1)
      const f = u * total
      const idx = Math.floor(f)
      const local = f - idx
      const a = pts[idx]
      const b = pts[Math.min(idx+1, pts.length-1)]
      const x = a[0]*(1-local)+b[0]*local
      const y = a[1]*(1-local)+b[1]*local
      const z = a[2]*(1-local)+b[2]*local
      const p = ref.current.children[i]
      if(p) p.position.set(x,y,z)
    }
  })
  return (
    <group ref={ref}>
      {particles.map((_,i)=> (
        <mesh key={i}>
          <sphereGeometry args={[0.06,8,8]} />
          <meshStandardMaterial emissive={ACCENT} emissiveIntensity={2} color={'#00bcd4'} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------- MAIN APP ----------------
export default function App(){
  const [levelIndex, setLevelIndex] = useState(1)
  const [nodes, setNodes] = useState(()=> generateLevel(1))
  const [pathNodes, setPathNodes] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(()=>{ // update when level changes
    const lv = generateLevel(levelIndex)
    setNodes(lv)
  }, [levelIndex])

  useEffect(()=>{ // compute path whenever nodes change
    const p = findPath(nodes)
    setPathNodes(p)
    setConnected(!!p)
  }, [nodes])

  // rotate handler
  const rotateNode = (id) => setNodes(prev => prev.map(n=> n.id===id ? ({ ...n, rot: (n.rot+1)%4 }) : n))

  // reset
  const reset = () => setNodes(generateLevel(levelIndex))
  useEffect(()=>{ const onKey=(e)=>{ if(e.key==='r'||e.key==='R') reset() }; window.addEventListener('keydown',onKey); return ()=>window.removeEventListener('keydown',onKey) }, [levelIndex])

  // next level
  const nextLevel = ()=> { if(levelIndex < LEVEL_COUNT) setLevelIndex(levelIndex+1) }
  const prevLevel = ()=> { if(levelIndex > 1) setLevelIndex(levelIndex-1) }

  const activeSet = useMemo(()=> new Set((pathNodes||[]).map(n=>n.id)), [pathNodes])

  // world path for particles
  const worldPath = useMemo(()=> pathNodes ? pathNodes.map(n=> n.position) : [], [pathNodes])

  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh', overflow:'hidden', fontFamily:'Inter, sans-serif' }}>
      <Canvas style={{ position:'fixed', top:0,left:0,width:'100vw',height:'100vh' }} camera={{ position:[5,5,6], fov:50 }}>
        <color attach="background" args={[BG]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[5,10,5]} intensity={0.9} />
        <gridHelper args={[12,12,'#0d1a22','#071022']} position={[2.2,-0.85,1.2]} />

        {nodes.map(n=> (
          <NodeVisual key={n.id} node={n} active={activeSet.has(n.id)} onRotate={rotateNode} />
        ))}

        {connected && pathNodes && pathNodes.length>1 && <EnergyParticles path={pathNodes} />}

        <OrbitControls makeDefault />
      </Canvas>

      {/* Top center level dots */}
      <div style={{ position:'absolute', top:18, left:'50%', transform:'translateX(-50%)', display:'flex', gap:10, alignItems:'center' }}>
        {Array.from({length:LEVEL_COUNT}).map((_,i)=> (
          <div key={i} onClick={()=> setLevelIndex(i+1)} style={{ width:18, height:18, borderRadius:9, background: i+1===levelIndex ? ACCENT : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: i+1===levelIndex ? '0 0 12px rgba(0,230,255,0.15)' : 'none', cursor:'pointer' }} title={`Level ${i+1}`}></div>
        ))}
      </div>

      {/* Left-bottom instructions */}
      <div style={{ position:'absolute', left:20, bottom:20, background:'rgba(2,8,12,0.6)', padding:12, borderRadius:10, color:'#cfeefb', border:'1px solid rgba(0,230,255,0.06)', width:320 }}>
        <div style={{ fontSize:14, marginBottom:6, color:ACCENT }}>⚡ Circuit Flow 3D</div>
        <div style={{ fontSize:13, lineHeight:'18px' }}>
          <div>• 鼠标拖动旋转场景，滚轮缩放视角</div>
          <div>• 点击 <b>黑色方块</b>：顺时针旋转 90°（仅导线方块可旋转）</div>
          <div>• 目标：让电流从 <b>源点</b> 流到 <b>终点</b></div>
          <div>• 按 <b>R</b> 重置本关</div>
        </div>
      </div>

      {/* Right-top status & next */}
      <div style={{ position:'absolute', right:20, top:20, display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
        <div style={{ background:'rgba(0,0,0,0.55)', padding:'10px 14px', borderRadius:12, color: connected?ACCENT:'#eef6fb', border: connected?`1px solid rgba(0,230,255,0.26)`:'1px solid rgba(255,255,255,0.04)' }}>
          {connected ? `⚡ 电流已连通！（关卡 ${levelIndex}）` : `未连通 — 尝试旋转导线连接电路`}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=> { if(levelIndex>1) setLevelIndex(levelIndex-1) }} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(0,0,0,0.6)', color:'#fff', border:'1px solid rgba(255,255,255,0.06)' }}>上关</button>
          <button onClick={()=> { if(levelIndex<LEVEL_COUNT) setLevelIndex(levelIndex+1) }} style={{ padding:'8px 10px', borderRadius:8, background:connected?ACCENT:'rgba(0,0,0,0.6)', color:connected?'#012':'#fff', border: connected?`1px solid rgba(0,230,255,0.26)`:'1px solid rgba(255,255,255,0.06)' }}>下一关</button>
        </div>
        <button onClick={()=> setNodes(generateLevel(levelIndex)) } style={{ marginTop:6, padding:'6px 10px', borderRadius:8, background:'rgba(0,0,0,0.6)', color:ACCENT, border:`1px solid rgba(0,230,255,0.12)` }}>重置 (R)</button>
      </div>

      {/* Fullscreen */}
      <button onClick={()=> document.body.requestFullscreen?.()} style={{ position:'absolute', right:20, bottom:20, padding:'8px 12px', borderRadius:8, background:'rgba(0,0,0,0.6)', color:ACCENT, border:`1px solid rgba(0,230,255,0.12)` }}>全屏</button>

    </div>
  )
}

// auto-mount if run standalone
if(typeof document !== 'undefined'){
  const el = document.getElementById('root') || document.createElement('div')
  el.id = 'root'
  if(!document.getElementById('root')) document.body.appendChild(el)
  const root = createRoot(el)
  root.render(<App />)
}
