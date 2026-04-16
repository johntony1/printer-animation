import { useCallback, useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import receiptBgUrl from './assets/receipt_bg.svg'
import receiptDividerUrl from './assets/receipt_divider.svg'

/* ─────────────────────────────────────────────────────────────
 * STORYBOARD
 *
 *  IDLE      printer at top (40px page padding), receipt peeking
 *            ~13px below slot — text + slide button below
 *
 *  PRINTING  (slide completes)
 *    0ms     text fades out, print sound starts
 *  200ms     receipt y: -488 → 0 over 1500ms power2.out
 * 1700ms     receipt fully out
 * 1900ms     gentle float loop ±8px / 2s begins
 *
 *  DONE      receipt floating, "Print Again" link below
 * ───────────────────────────────────────────────────────────── */

type Phase = 'idle' | 'printing' | 'done'

// ─── Timing ────────────────────────────────────────────────
const T = {
  printerDelay:  0.06,   // s
  feedDelay:     0.2,    // s — small pause before receipt moves
  feedDuration:  1.5,    // s — receipt travel
  floatY:        8,      // px
  floatDuration: 2.0,    // s
}

// ─── Dimensions (derived from Figma @ 460px printer width) ─
const PW     = 460
const BODY_H = Math.round(460 * 273 / 915)  // 137

// Receipt (Figma: 742×1066 at left=88, top=202 in printer frame)
const R_TOP     = Math.round(202 * 460 / 915)  // 102
const R_LEFT    = Math.round(88  * 460 / 915)  // 44
const R_W       = Math.round(742 * 460 / 915)  // 373
const R_H       = Math.round(1066 * 460 / 915) // 536
const R_INNER_W = 741
const R_INNER_H = 1065
const R_SCALE   = R_W / R_INNER_W             // ≈ 0.5034

// Initial translateY: receipt mostly inside printer (only ~13px peeks below slot)
// Figma initial top=-768 → in 460px scale: -768×(460/915)=-386; offset by R_TOP: -386-102=-488
const RECEIPT_INIT_Y = -488

// Content area margin-top in each phase (leaves room for receipt when out)
const CONTENT_MT_IDLE = 300
const CONTENT_MT_DONE = R_H - BODY_H + 24  // 423

// ─── Colors ────────────────────────────────────────────────
const PAGE_BG = '#ffffff'

const SATOSHI: React.CSSProperties = { fontFamily: "'Satoshi', sans-serif" }
const INTER:   React.CSSProperties = { fontFamily: "'Inter', sans-serif" }

// ─── Sound ─────────────────────────────────────────────────
function playPrintSound(duration = 1.7) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()

    const len = Math.floor(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      // Slight modulation to simulate paper feed rhythm
      d[i] = (Math.random() * 2 - 1) * (0.4 + 0.25 * Math.sin(i / ctx.sampleRate * Math.PI * 18))
    }

    const src = ctx.createBufferSource()
    src.buffer = buf

    const lp  = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 1100

    const gain = ctx.createGain()
    const t0   = ctx.currentTime
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.08)
    gain.gain.setValueAtTime(0.18, t0 + duration - 0.25)
    gain.gain.linearRampToValueAtTime(0, t0 + duration)

    src.connect(lp); lp.connect(gain); gain.connect(ctx.destination)
    src.start(); src.stop(t0 + duration)
  } catch { /* audio not available */ }
}

// ─── Divider line ───────────────────────────────────────────
function Divider() {
  return (
    <div style={{ width: '100%', height: 1, position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: '-1.53px 0 0 0' }}>
        <img src={receiptDividerUrl} alt="" style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

// ─── Payslip receipt (renders at Figma's 741×1065 then scaled) ─
function PayslipReceipt() {
  const S = SATOSHI
  return (
    <div style={{ position: 'relative', width: R_INNER_W, height: R_INNER_H }}>
      <img src={receiptBgUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />

      {/* Header */}
      <div style={{ position: 'absolute', left: 24.55, top: 62.01, width: 691.9, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ ...S, fontWeight: 500, fontSize: 24.547, lineHeight: '33.75px', letterSpacing: '-0.31px', color: '#181b25', width: 276 }}>
          Payslip — PS-2026-001
        </p>
        <div style={{ background: 'white', border: '1.53px solid #e1e4ea', borderRadius: 6, padding: '6.14px 12.27px' }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '-0.2px', color: '#525866', whiteSpace: 'nowrap' }}>
            Feb 1 — Feb 28, 2026
          </p>
        </div>
      </div>

      {/* Employee / Employer card */}
      <div style={{ position: 'absolute', left: 24.55, top: 123.38, width: 691.9, background: 'linear-gradient(to bottom, rgba(233,233,255,0.2), rgba(204,229,241,0.2))', borderRadius: 18.41, padding: 24.55, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12.27, width: 230 }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '1.53px', color: '#525866' }}>Employee</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6.14 }}>
            <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>Amina Okafor</p>
            <p style={{ ...S, fontWeight: 400, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#525866' }}>Senior Software Engineer</p>
            <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '-0.31px', color: '#525866' }}>EMP-1001</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12.27, width: 230, alignItems: 'flex-end' }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '1.53px', color: '#525866' }}>Employer</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6.14, alignItems: 'flex-end' }}>
            <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>TechVentures Ltd</p>
            <p style={{ ...S, fontWeight: 400, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#525866' }}>14 Broad St, Lagos</p>
            <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '-0.31px', color: '#525866' }}>TIN-0012345678</p>
          </div>
        </div>
      </div>

      {/* Earnings */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 332.02, width: 691.9, display: 'flex', flexDirection: 'column', gap: 12.27 }}>
        <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '1.53px', color: '#525866' }}>Earnings</p>
        {([['Basic Salary','₦850,000'],['Housing Allowance','₦250,000'],['Transport Allowance','₦120,000'],['Overtime','₦45,000']] as [string,string][]).map(([l,v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', height: 30.68 }}>
            <p style={{ ...S, fontWeight: 400, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#525866' }}>{l}</p>
            <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>{v}</p>
          </div>
        ))}
        <Divider />
        <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', height: 30.68 }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>Gross Pay</p>
          <p style={{ ...S, fontWeight: 700, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>₦1,265,000</p>
        </div>
        <Divider />
      </div>

      {/* Deductions */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 620.45, width: 691.9, display: 'flex', flexDirection: 'column', gap: 12.27 }}>
        <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '1.53px', color: '#525866' }}>Statutory Deductions</p>
        {([['PAYE Tax','-₦142,500'],['Pension (Employee 8%)','-₦68,000'],['NHF (2.5%)','-₦21,250'],['Health Insurance','-₦15,000']] as [string,string][]).map(([l,v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', height: 30.68 }}>
            <p style={{ ...S, fontWeight: 400, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#525866' }}>{l}</p>
            <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>{v}</p>
          </div>
        ))}
        <Divider />
        <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', height: 30.68 }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>Total Deductions</p>
          <p style={{ ...S, fontWeight: 700, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>-₦246,750</p>
        </div>
        <Divider />
      </div>

      {/* Net Pay */}
      <div style={{ position: 'absolute', left: 24.55, top: 921.14, width: 691.9, background: 'linear-gradient(174.4deg, rgba(93,208,231,0.15) 25%, rgba(115,0,255,0.15) 106%)', borderRadius: 18.41, padding: 24.55, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>Net Pay</p>
        <p style={{ ...S, fontWeight: 700, fontSize: 24.547, lineHeight: '33.75px', letterSpacing: '-0.31px', color: '#181b25', whiteSpace: 'nowrap' }}>₦1,018,250</p>
      </div>
    </div>
  )
}

// ─── Slide-to-print button ──────────────────────────────────
const TRACK_W  = 326
const HANDLE_W = 52   // 16px pad + 20px icon + 16px pad (rest state)
const HANDLE_P = 2
const SLID_W   = TRACK_W - HANDLE_P * 2  // 322 — full-width handle (slid state)
const MAX_DRAG = TRACK_W - HANDLE_W - HANDLE_P * 2  // 270
const TRIGGER  = MAX_DRAG * 0.82                     // ~221

// Single >> chevron SVG used in both rest and slid states
function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6 6.5l3.5 3.5L6 13.5M10.5 6.5l3.5 3.5-3.5 3.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SlideButton({ onComplete }: { onComplete: () => void }) {
  const [handleX, setHandleX]   = useState(0)
  const [dragging, setDragging] = useState(false)
  const [isSlid, setIsSlid]     = useState(false)
  const isDragging = useRef(false)
  const startPtr   = useRef(0)
  const startH     = useRef(0)
  const triggered  = useRef(false)

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (triggered.current) return
    isDragging.current = true
    setDragging(true)
    startPtr.current = e.clientX
    startH.current   = handleX
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || triggered.current) return
    const delta = e.clientX - startPtr.current
    const nx    = Math.max(0, Math.min(MAX_DRAG, startH.current + delta))
    setHandleX(nx)
    if (nx >= TRIGGER) {
      isDragging.current = false
      triggered.current  = true
      setDragging(false)
      setIsSlid(true)           // expand handle to full width
      setTimeout(onComplete, 500) // wait for expand animation before printing
    }
  }

  const onUp = () => {
    if (!isDragging.current) return
    isDragging.current = false
    setDragging(false)
    setHandleX(0) // spring back
  }

  const progress    = handleX / MAX_DRAG  // 0–1
  const handleLeft  = isSlid ? HANDLE_P : HANDLE_P + handleX
  const handleWidth = isSlid ? SLID_W    : HANDLE_W
  const fillWidth   = isSlid ? SLID_W    : handleX + HANDLE_W
  const EASE        = 'cubic-bezier(0.25, 0, 0.35, 1)'

  return (
    <div style={{ position: 'relative', width: TRACK_W, height: 44, flexShrink: 0 }}>

      {/* ── Track ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.154) 6.67%, rgba(255,255,255,0) 103%), rgb(247,247,247)',
        boxShadow: '0 0 0 0.3px #ebebeb, 0 1px 3px -1.5px rgba(51,51,51,0.16)',
      }}>
        {/* Dark sweep fill */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: HANDLE_P,
          background: '#171717', borderRadius: 24,
          width: fillWidth,
          transition: isSlid ? `width 0.42s ${EASE}` : dragging ? 'none' : `width 0.35s ${EASE}`,
        }} />
        {/* Faint chevron hints visible as drag advances */}
        {!isSlid && [70, 110, 150, 190, 230, 270].map((xp) => (
          <svg key={xp} style={{ position: 'absolute', left: xp, top: '50%', transform: 'translateY(-50%)', opacity: progress * MAX_DRAG > xp - 30 ? 0.35 : 0, transition: 'opacity 0.1s', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2.5l3 3.5-3 3.5M7 2.5l3 3.5-3 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ))}
        {/* Inset glow */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 24, boxShadow: 'inset 0 0 2px 1px rgba(255,255,255,0.16)', pointerEvents: 'none' }} />
      </div>

      {/* Label — removed entirely once slid */}
      {!isSlid && (
        <p style={{
          position: 'absolute', inset: 0, margin: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...INTER, fontWeight: 500, fontSize: 14, letterSpacing: '-0.084px', lineHeight: '20px',
          color: progress > 0.38 ? 'rgba(255,255,255,0.65)' : '#5c5c5c',
          transition: 'color 0.15s',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          Slide To print pay slip
        </p>
      )}

      {/* ── Handle ─────────────────────────────────────────── */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'absolute', top: HANDLE_P,
          left: handleLeft,
          width: handleWidth,
          height: 40,
          borderRadius: 24, overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.154) 6.67%, rgba(255,255,255,0) 103.33%), #171717',
          boxShadow: '0 0 0 0.75px #171717, 0 16px 8px -8px rgba(51,51,51,0.01), 0 12px 6px -6px rgba(51,51,51,0.02), 0 5px 5px -2.5px rgba(51,51,51,0.08), 0 1px 3px -1.5px rgba(51,51,51,0.16)',
          cursor: triggered.current ? 'default' : 'grab',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 16,
          padding: '8px 16px', boxSizing: 'border-box',
          userSelect: 'none', touchAction: 'none',
          transition: dragging ? 'none' : `left 0.42s ${EASE}, width 0.42s ${EASE}`,
        }}
      >
        {isSlid
          // Slid state: 8 chevron icons filling the handle (matches Figma 297207)
          ? Array.from({ length: 8 }, (_, i) => <ChevronIcon key={i} />)
          // Rest / dragging: single chevron
          : <ChevronIcon />
        }
        {/* Inset highlight */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 24, boxShadow: 'inset 0 1px 2px 0 rgba(255,255,255,0.16)', pointerEvents: 'none' }} />
      </div>

    </div>
  )
}

// ─── Main export ────────────────────────────────────────────
export function PrinterAnimation() {
  const [phase, setPhase] = useState<Phase>('idle')
  const receiptRef = useRef<HTMLDivElement>(null)
  const tlRef      = useRef<gsap.core.Timeline | null>(null)

  // Set receipt to initial position on mount
  useEffect(() => {
    if (receiptRef.current) gsap.set(receiptRef.current, { y: RECEIPT_INIT_Y })
  }, [])

  const startPrint = useCallback(() => {
    if (phase !== 'idle') return
    setPhase('printing')
    playPrintSound(T.feedDelay + T.feedDuration + 0.1)

    const el = receiptRef.current
    if (!el) return

    tlRef.current?.kill()
    gsap.set(el, { y: RECEIPT_INIT_Y })

    const tl = gsap.timeline({ onComplete: () => setPhase('done') })
    tl.to(el, { y: 0, duration: T.feedDuration, ease: 'power2.out', delay: T.feedDelay })
    tl.to(el, { y: T.floatY, duration: T.floatDuration, ease: 'sine.inOut', yoyo: true, repeat: -1 }, '>0.2')
    tlRef.current = tl
  }, [phase])

  const replay = useCallback(() => {
    tlRef.current?.kill()
    if (receiptRef.current) gsap.set(receiptRef.current, { y: RECEIPT_INIT_Y })
    setPhase('idle')
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 40, paddingBottom: 60,
      background: PAGE_BG,
    }}>

      {/* ── Printer + receipt assembly ─────────────────────── */}
      <div style={{ position: 'relative', width: PW, height: BODY_H, flexShrink: 0 }}>

        {/* Lavender mask: hides receipt overflow above printer top */}
        <div style={{
          position: 'absolute', top: -600, left: -120,
          width: PW + 240, height: 600,
          background: PAGE_BG, zIndex: 15, pointerEvents: 'none',
        }} />

        {/* Receipt: z:10, initial y=-488 so only bottom scallop peeks */}
        <div ref={receiptRef} style={{
          position: 'absolute', top: R_TOP, left: R_LEFT,
          width: R_W, height: R_H, zIndex: 10,
          filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.13)) drop-shadow(0 3px 8px rgba(0,0,0,0.07))',
        }}>
          <div style={{ width: R_INNER_W, height: R_INNER_H, transform: `scale(${R_SCALE})`, transformOrigin: 'top left' }}>
            <PayslipReceipt />
          </div>
        </div>

        {/* Printer body: z:20, covers receipt origin → slot illusion */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22, delay: T.printerDelay }}
          style={{
            position: 'absolute', top: 0, left: 0, zIndex: 20, lineHeight: 0,
            filter: 'drop-shadow(0 24px 52px rgba(120,140,220,0.30)) drop-shadow(0 6px 16px rgba(0,0,0,0.10))',
          }}
        >
          <svg width={PW} height={BODY_H} viewBox="0 0 915 273" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="printerBodyGrad" x1="0" y1="0" x2="0" y2="273" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#e9e9ff" />
                <stop offset="38%"  stopColor="#dde8fb" />
                <stop offset="100%" stopColor="#cce5f1" />
              </linearGradient>
              <radialGradient id="printerSatin" cx="50%" cy="18%" rx="39%" ry="29%">
                <stop offset="0%"  stopColor="rgba(255,255,255,0.60)" />
                <stop offset="36%" stopColor="rgba(255,255,255,0.26)" />
                <stop offset="68%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <linearGradient id="printerEdge" x1="0" y1="0" x2="915" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="rgba(0,0,0,0.13)" />
                <stop offset="5%"   stopColor="rgba(0,0,0,0)" />
                <stop offset="95%"  stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.13)" />
              </linearGradient>
            </defs>
            <path d="M6.453 37.318C14.594 15.499 38.726 0.953984 61.536 0.895984C108.174 0.776984 154.813 0.878974 201.452 0.885974L480.59 0.896991L730.13 0.891986C771.31 0.888986 812.84 0.670002 854.03 0.959002C860.55 1.005 867.79 2.18498 873.9 4.43398C888.87 9.83798 900.99 21.132 907.42 35.692C915.2 47.969 914.97 85.885 913.63 100.47C913.68 113.99 914.87 170.736 912.15 180.64C910.61 203.777 911.67 245.055 894.29 261.033C879.54 274.596 856.57 272.256 837.84 272.04L837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901L79.092 272.008C66.206 272.223 52.641 273.578 40.869 268.495C13.146 256.739 13.016 222.537 8.55298 196.177C-2.92702 174.888 1.21802 120.221 1.30902 94.199C0.445022 78.162 -0.093996 51.577 6.453 37.318Z" fill="url(#printerBodyGrad)" />
            <path d="M6.453 37.318C14.594 15.499 38.726 0.953984 61.536 0.895984C108.174 0.776984 154.813 0.878974 201.452 0.885974L480.59 0.896991L730.13 0.891986C771.31 0.888986 812.84 0.670002 854.03 0.959002C860.55 1.005 867.79 2.18498 873.9 4.43398C888.87 9.83798 900.99 21.132 907.42 35.692C915.2 47.969 914.97 85.885 913.63 100.47C913.68 113.99 914.87 170.736 912.15 180.64C910.61 203.777 911.67 245.055 894.29 261.033C879.54 274.596 856.57 272.256 837.84 272.04L837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901L79.092 272.008C66.206 272.223 52.641 273.578 40.869 268.495C13.146 256.739 13.016 222.537 8.55298 196.177C-2.92702 174.888 1.21802 120.221 1.30902 94.199C0.445022 78.162 -0.093996 51.577 6.453 37.318Z" fill="url(#printerSatin)" />
            <path d="M6.453 37.318C14.594 15.499 38.726 0.953984 61.536 0.895984C108.174 0.776984 154.813 0.878974 201.452 0.885974L480.59 0.896991L730.13 0.891986C771.31 0.888986 812.84 0.670002 854.03 0.959002C860.55 1.005 867.79 2.18498 873.9 4.43398C888.87 9.83798 900.99 21.132 907.42 35.692C915.2 47.969 914.97 85.885 913.63 100.47C913.68 113.99 914.87 170.736 912.15 180.64C910.61 203.777 911.67 245.055 894.29 261.033C879.54 274.596 856.57 272.256 837.84 272.04L837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901L79.092 272.008C66.206 272.223 52.641 273.578 40.869 268.495C13.146 256.739 13.016 222.537 8.55298 196.177C-2.92702 174.888 1.21802 120.221 1.30902 94.199C0.445022 78.162 -0.093996 51.577 6.453 37.318Z" fill="url(#printerEdge)" />
            <path d="M12.185 198.952C18.021 204.52 21.809 209.803 29 214.484C51.911 229.399 87.703 224.591 114.766 224.601L228.8 224.578L581.68 224.561L776.5 224.574L826.74 224.712C860.57 224.809 886.81 226.691 906.02 192.246C908.2 188.344 909.55 184.247 912.15 180.64C910.61 203.777 911.67 245.055 894.29 261.033C879.54 274.596 856.57 272.256 837.84 272.04L837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901L79.092 272.008C66.206 272.223 52.641 273.578 40.869 268.495C13.146 256.739 13.016 222.537 8.55298 196.177L10.074 195.805C11.138 197.159 11.572 197.418 12.185 198.952Z" fill="rgba(0,0,0,0.07)" />
            <path d="M79.05 256.901C70.623 257.056 63.632 258.241 57.038 251.901C47.845 243.062 58.301 234.462 67.603 234.216C85.768 233.736 104.006 233.979 122.182 234.024L230.618 234.086L692.27 234.076L806.7 234.074C820.89 234.074 836.81 233.625 850.99 234.535C856.65 234.897 863.08 242.207 860.14 247.942C855.66 258.055 846.8 257.139 837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901Z" fill="#060614" />
          </svg>
        </motion.div>
      </div>

      {/* ── Content area: shifts down as receipt emerges ────── */}
      <motion.div
        animate={{ marginTop: phase === 'done' ? CONTENT_MT_DONE : CONTENT_MT_IDLE }}
        transition={{ duration: T.feedDuration, ease: [0.25, 0, 0.35, 1], delay: phase === 'printing' ? T.feedDelay : 0 }}
        style={{ width: 344, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
      >
        <AnimatePresence mode="wait">
          {(phase === 'idle') && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 39 }}
            >
              {/* "Payment successfully" text */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center', width: '100%' }}>
                <h1 style={{
                  ...INTER, fontWeight: 600, fontSize: 24,
                  lineHeight: 1, letterSpacing: '-0.2px',
                  color: '#171717', margin: 0, textAlign: 'center',
                  fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0",
                  textWrap: 'balance',
                } as React.CSSProperties}>
                  Payment successfully
                </h1>
                <p style={{
                  ...INTER, fontWeight: 400, fontSize: 14,
                  lineHeight: '22px', letterSpacing: '-0.084px',
                  color: '#5c5c5c', margin: 0, textAlign: 'center',
                  fontFeatureSettings: "'calt' 0, 'liga' 0",
                }}>
                  Your payment for Amina Okafor was successful, now let's roll
                </p>
              </div>
              {/* Slide button */}
              <SlideButton onComplete={startPrint} />
            </motion.div>
          )}

          {(phase === 'printing') && (
            <motion.div
              key="printing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              style={{ height: 160 }}
            />
          )}

          {(phase === 'done') && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
            >
              <motion.button
                onClick={replay}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={{
                  ...SATOSHI, background: 'none',
                  border: '1px solid #e1e4ea', borderRadius: 6,
                  padding: '9px 28px', fontSize: 12, fontWeight: 500,
                  letterSpacing: '-0.2px', color: '#525866', cursor: 'pointer',
                }}
              >
                Print Again
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  )
}
