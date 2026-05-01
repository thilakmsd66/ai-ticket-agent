import { useEffect, useRef } from 'react'

const NODE_COUNT = 52
const MAX_DIST = 175
const COLORS = ['#0ea5e9', '#6366f1', '#14b8a6', '#8b5cf6', '#22d3ee']

function randomBetween(a, b) {
  return a + Math.random() * (b - a)
}

export default function NeuralBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let width, height

    // Node definition
    const nodes = []

    function resize() {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    function initNodes() {
      nodes.length = 0
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: randomBetween(0, width),
          y: randomBetween(0, height),
          vx: randomBetween(-0.28, 0.28),
          vy: randomBetween(-0.28, 0.28),
          r: randomBetween(2, 4.5),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          pulse: randomBetween(0, Math.PI * 2),
          pulseSpeed: randomBetween(0.012, 0.03),
          // data packet travelling along an edge
          packet: Math.random() > 0.65 ? { progress: Math.random(), speed: randomBetween(0.004, 0.012), targetIdx: -1 } : null,
        })
      }
    }

    function draw(ts) {
      ctx.clearRect(0, 0, width, height)

      // Update + draw edges
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.22
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(99,102,241,${alpha})`
            ctx.lineWidth = 0.8
            ctx.stroke()

            // Data packet on this edge
            const pkt = a.packet
            if (pkt && pkt.targetIdx === j) {
              pkt.progress += pkt.speed
              if (pkt.progress >= 1) {
                pkt.progress = 0
                pkt.targetIdx = -1
              } else {
                const px = a.x + dx * pkt.progress
                const py = a.y + dy * pkt.progress
                const grad = ctx.createRadialGradient(px, py, 0, px, py, 6)
                grad.addColorStop(0, 'rgba(99,218,255,0.9)')
                grad.addColorStop(1, 'rgba(99,102,241,0)')
                ctx.beginPath()
                ctx.arc(px, py, 5, 0, Math.PI * 2)
                ctx.fillStyle = grad
                ctx.fill()
              }
            } else if (pkt && pkt.targetIdx === -1 && Math.random() < 0.002) {
              pkt.targetIdx = j
              pkt.progress = 0
            }
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        n.pulse += n.pulseSpeed
        const glow = 0.55 + Math.sin(n.pulse) * 0.3

        // Pulse ring
        const ringR = n.r + 4 + Math.sin(n.pulse) * 3
        ctx.beginPath()
        ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2)
        ctx.strokeStyle = n.color.replace(')', `,${glow * 0.25})`).replace('rgb', 'rgba').replace('#', 'rgba(') 
        // simpler: use a gradient
        const ringGrad = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, ringR + 4)
        ringGrad.addColorStop(0, `${n.color}44`)
        ringGrad.addColorStop(1, `${n.color}00`)
        ctx.fillStyle = ringGrad
        ctx.fill()

        // Core node
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2)
        grad.addColorStop(0, `${n.color}ff`)
        grad.addColorStop(0.5, `${n.color}99`)
        grad.addColorStop(1, `${n.color}00`)
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Move
        n.x += n.vx
        n.y += n.vy
        if (n.x < -20) n.x = width + 20
        if (n.x > width + 20) n.x = -20
        if (n.y < -20) n.y = height + 20
        if (n.y > height + 20) n.y = -20
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    initNodes()
    animId = requestAnimationFrame(draw)

    window.addEventListener('resize', () => { resize(); initNodes() })
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.55,
      }}
    />
  )
}
