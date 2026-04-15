import { useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import receiptBgUrl from './assets/receipt_bg.svg'
import receiptDividerUrl from './assets/receipt_divider.svg'

/* ─────────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 *    0ms   printer springs in (framer-motion spring)
 *  600ms   receipt clip-path reveals top → bottom from slot
 * 2100ms   receipt fully out — gentle float begins ±8px / 2s
 *
 * Layout derived from Figma frame 202460:296943
 *   Printer body: 915×273  at (0, 0)
 *   Receipt paper: 742×1066 at (88, 202)
 *   Scale to 460px: ×0.5027
 * ───────────────────────────────────────────────────────────── */

// ─── Timing ────────────────────────────────────────────────
const T = {
  printerDelay:  0.06,   // s  — framer spring delay
  receiptDelay:  600,    // ms — wait before receipt feeds out
  feedDuration:  1.5,    // s  — clip-path reveal duration
  floatY:        8,      // px — float amplitude
  floatDuration: 2.0,    // s  — float period
}

// ─── Dimensions (all Math.round'd from Figma ×0.5027) ──────
const PW     = 460                           // printer width
const BODY_H = Math.round(460 * 273 / 915)  // 137 — printer body height

// Receipt container (outer box in our coordinate space)
const R_TOP  = Math.round(202 * 460 / 915)  // 102 — top of receipt in container
const R_LEFT = Math.round(88  * 460 / 915)  // 44  — left offset
const R_W    = Math.round(742 * 460 / 915)  // 373 — displayed width
const R_H    = Math.round(1066 * 460 / 915) // 536 — displayed height

// Receipt inner content (Figma 741×1065 → scale to R_W)
const R_INNER_W = 741
const R_INNER_H = 1065
const R_SCALE   = R_W / R_INNER_W           // ≈ 0.5034


// ─── Colors ────────────────────────────────────────────────
const PAGE_BG = '#EDEDF5'

const SATOSHI: React.CSSProperties = {
  fontFamily: "'Satoshi', sans-serif",
}

// ─── Helpers ───────────────────────────────────────────────
// All measurements below are Figma px values (at 742px receipt width).
// They live inside R_INNER_W×R_INNER_H and get scaled down by R_SCALE.

function Divider() {
  return (
    <div style={{ width: '100%', height: 1, position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: '-1.53px 0 0 0' }}>
        <img
          src={receiptDividerUrl}
          alt=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

// ─── Payslip receipt (renders at Figma's 741×1065 scale) ───
function PayslipReceipt() {
  const S = SATOSHI
  return (
    <div style={{ position: 'relative', width: R_INNER_W, height: R_INNER_H }}>

      {/* Scalloped paper background */}
      <img
        src={receiptBgUrl}
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%', display: 'block',
        }}
      />

      {/* ── Header: title + date tag ── */}
      <div style={{
        position: 'absolute', left: 24.55, top: 62.01, width: 691.9,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ ...S, fontWeight: 500, fontSize: 24.547, lineHeight: '33.75px', letterSpacing: '-0.31px', color: '#181b25', width: 276 }}>
          Payslip — PS-2026-001
        </p>
        <div style={{
          background: 'white',
          border: '1.53px solid #e1e4ea',
          borderRadius: 6,
          padding: '6.14px 12.27px',
          display: 'flex', alignItems: 'center',
        }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '-0.2px', color: '#525866', whiteSpace: 'nowrap' }}>
            Feb 1 — Feb 28, 2026
          </p>
        </div>
      </div>

      {/* ── Employee / Employer card ── */}
      <div style={{
        position: 'absolute', left: 24.55, top: 123.38, width: 691.9,
        background: 'linear-gradient(to bottom, rgba(233,233,255,0.2), rgba(204,229,241,0.2))',
        borderRadius: 18.41, padding: 24.55,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12.27, width: 230 }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '1.53px', color: '#525866' }}>
            Employee
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6.14 }}>
            <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>Amina Okafor</p>
            <p style={{ ...S, fontWeight: 400, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#525866' }}>Senior Software Engineer</p>
            <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '-0.31px', color: '#525866' }}>EMP-1001</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12.27, width: 230, alignItems: 'flex-end' }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '1.53px', color: '#525866' }}>
            Employer
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6.14, alignItems: 'flex-end' }}>
            <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>TechVentures Ltd</p>
            <p style={{ ...S, fontWeight: 400, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#525866' }}>14 Broad St, Lagos</p>
            <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '-0.31px', color: '#525866' }}>TIN-0012345678</p>
          </div>
        </div>
      </div>

      {/* ── Earnings ── */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        top: 332.02, width: 691.9,
        display: 'flex', flexDirection: 'column', gap: 12.27,
      }}>
        <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '1.53px', color: '#525866' }}>
          Earnings
        </p>
        {([
          ['Basic Salary',        '₦850,000'],
          ['Housing Allowance',   '₦250,000'],
          ['Transport Allowance', '₦120,000'],
          ['Overtime',            '₦45,000'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', height: 30.68 }}>
            <p style={{ ...S, fontWeight: 400, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#525866' }}>{label}</p>
            <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>{value}</p>
          </div>
        ))}
        <Divider />
        <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', height: 30.68 }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>Gross Pay</p>
          <p style={{ ...S, fontWeight: 700, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>₦1,265,000</p>
        </div>
        <Divider />
      </div>

      {/* ── Statutory Deductions ── */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        top: 620.45, width: 691.9,
        display: 'flex', flexDirection: 'column', gap: 12.27,
      }}>
        <p style={{ ...S, fontWeight: 500, fontSize: 18.41, lineHeight: '24.55px', letterSpacing: '1.53px', color: '#525866' }}>
          Statutory Deductions
        </p>
        {([
          ['PAYE Tax',              '-₦142,500'],
          ['Pension (Employee 8%)', '-₦68,000'],
          ['NHF (2.5%)',            '-₦21,250'],
          ['Health Insurance',      '-₦15,000'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', height: 30.68 }}>
            <p style={{ ...S, fontWeight: 400, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#525866' }}>{label}</p>
            <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>{value}</p>
          </div>
        ))}
        <Divider />
        <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', height: 30.68 }}>
          <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>Total Deductions</p>
          <p style={{ ...S, fontWeight: 700, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>-₦246,750</p>
        </div>
        <Divider />
      </div>

      {/* ── Net Pay card ── */}
      <div style={{
        position: 'absolute', left: 24.55, top: 921.14, width: 691.9,
        background: 'linear-gradient(174.4deg, rgba(93,208,231,0.15) 25%, rgba(115,0,255,0.15) 106%)',
        borderRadius: 18.41, padding: 24.55,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ ...S, fontWeight: 500, fontSize: 21.48, lineHeight: '30.68px', letterSpacing: '-0.31px', color: '#181b25' }}>Net Pay</p>
        <p style={{ ...S, fontWeight: 700, fontSize: 24.547, lineHeight: '33.75px', letterSpacing: '-0.31px', color: '#181b25', whiteSpace: 'nowrap' }}>₦1,018,250</p>
      </div>

    </div>
  )
}

// ─── Main export ────────────────────────────────────────────
export function PrinterAnimation() {
  const receiptRef = useRef<HTMLDivElement>(null)
  const tlRef      = useRef<gsap.core.Timeline | null>(null)

  const startAnimation = useCallback(() => {
    const el = receiptRef.current
    if (!el) return

    tlRef.current?.kill()
    gsap.set(el, { clipPath: 'inset(0px 0px 100% 0px)', y: 0 })

    const tl = gsap.timeline()
    // Paper feeds out of the slot (clip reveals top → bottom)
    tl.to(el, {
      clipPath: 'inset(0px 0px 0% 0px)',
      duration: T.feedDuration,
      ease: 'power1.inOut',
    })
    // Gentle float loop once paper is fully out
    tl.to(el, {
      y: T.floatY,
      duration: T.floatDuration,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    }, '>0.2')

    tlRef.current = tl
  }, [])

  useEffect(() => {
    const id = setTimeout(startAnimation, T.receiptDelay)
    return () => clearTimeout(id)
  }, [startAnimation])

  const play = useCallback(() => { startAnimation() }, [startAnimation])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: PAGE_BG,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 52 }}>

        {/* ── Printer + receipt assembly ─────────────────────── */}
        {/* Height is only the printer body — receipt overflows below, keeping printer centered */}
        <div style={{ position: 'relative', width: PW, height: BODY_H }}>

          {/* Receipt: z:10, positioned at Figma-specified offset */}
          <div
            ref={receiptRef}
            style={{
              position: 'absolute',
              top: R_TOP,
              left: R_LEFT,
              width: R_W,
              height: R_H,
              zIndex: 10,
              clipPath: 'inset(0px 0px 100% 0px)',
              overflow: 'hidden',
            }}
          >
            {/* Scale Figma 741×1065 content down to R_W×R_H */}
            <div style={{
              width: R_INNER_W,
              height: R_INNER_H,
              transform: `scale(${R_SCALE})`,
              transformOrigin: 'top left',
            }}>
              <PayslipReceipt />
            </div>
          </div>

          {/* Printer body: z:20, covers the receipt origin creating the slot illusion */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22, delay: T.printerDelay }}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              zIndex: 20,
              lineHeight: 0,
              filter: [
                'drop-shadow(0 24px 52px rgba(120,140,220,0.30))',
                'drop-shadow(0 6px 16px rgba(0,0,0,0.10))',
              ].join(' '),
            }}
          >
            <svg
              width={PW}
              height={BODY_H}
              viewBox="0 0 915 273"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block' }}
            >
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
              {/* Main body — lavender gradient */}
              <path d="M6.453 37.318C14.594 15.499 38.726 0.953984 61.536 0.895984C108.174 0.776984 154.813 0.878974 201.452 0.885974L480.59 0.896991L730.13 0.891986C771.31 0.888986 812.84 0.670002 854.03 0.959002C860.55 1.005 867.79 2.18498 873.9 4.43398C888.87 9.83798 900.99 21.132 907.42 35.692C915.2 47.969 914.97 85.885 913.63 100.47C913.68 113.99 914.87 170.736 912.15 180.64C910.61 203.777 911.67 245.055 894.29 261.033C879.54 274.596 856.57 272.256 837.84 272.04L837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901L79.092 272.008C66.206 272.223 52.641 273.578 40.869 268.495C13.146 256.739 13.016 222.537 8.55298 196.177C-2.92702 174.888 1.21802 120.221 1.30902 94.199C0.445022 78.162 -0.093996 51.577 6.453 37.318Z" fill="url(#printerBodyGrad)" />
              {/* Satin highlight */}
              <path d="M6.453 37.318C14.594 15.499 38.726 0.953984 61.536 0.895984C108.174 0.776984 154.813 0.878974 201.452 0.885974L480.59 0.896991L730.13 0.891986C771.31 0.888986 812.84 0.670002 854.03 0.959002C860.55 1.005 867.79 2.18498 873.9 4.43398C888.87 9.83798 900.99 21.132 907.42 35.692C915.2 47.969 914.97 85.885 913.63 100.47C913.68 113.99 914.87 170.736 912.15 180.64C910.61 203.777 911.67 245.055 894.29 261.033C879.54 274.596 856.57 272.256 837.84 272.04L837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901L79.092 272.008C66.206 272.223 52.641 273.578 40.869 268.495C13.146 256.739 13.016 222.537 8.55298 196.177C-2.92702 174.888 1.21802 120.221 1.30902 94.199C0.445022 78.162 -0.093996 51.577 6.453 37.318Z" fill="url(#printerSatin)" />
              {/* Edge shadows */}
              <path d="M6.453 37.318C14.594 15.499 38.726 0.953984 61.536 0.895984C108.174 0.776984 154.813 0.878974 201.452 0.885974L480.59 0.896991L730.13 0.891986C771.31 0.888986 812.84 0.670002 854.03 0.959002C860.55 1.005 867.79 2.18498 873.9 4.43398C888.87 9.83798 900.99 21.132 907.42 35.692C915.2 47.969 914.97 85.885 913.63 100.47C913.68 113.99 914.87 170.736 912.15 180.64C910.61 203.777 911.67 245.055 894.29 261.033C879.54 274.596 856.57 272.256 837.84 272.04L837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901L79.092 272.008C66.206 272.223 52.641 273.578 40.869 268.495C13.146 256.739 13.016 222.537 8.55298 196.177C-2.92702 174.888 1.21802 120.221 1.30902 94.199C0.445022 78.162 -0.093996 51.577 6.453 37.318Z" fill="url(#printerEdge)" />
              {/* Lower body depth shadow */}
              <path d="M12.185 198.952C18.021 204.52 21.809 209.803 29 214.484C51.911 229.399 87.703 224.591 114.766 224.601L228.8 224.578L581.68 224.561L776.5 224.574L826.74 224.712C860.57 224.809 886.81 226.691 906.02 192.246C908.2 188.344 909.55 184.247 912.15 180.64C910.61 203.777 911.67 245.055 894.29 261.033C879.54 274.596 856.57 272.256 837.84 272.04L837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901L79.092 272.008C66.206 272.223 52.641 273.578 40.869 268.495C13.146 256.739 13.016 222.537 8.55298 196.177L10.074 195.805C11.138 197.159 11.572 197.418 12.185 198.952Z" fill="rgba(0,0,0,0.07)" />
              {/* Slot / paper exit opening */}
              <path d="M79.05 256.901C70.623 257.056 63.632 258.241 57.038 251.901C47.845 243.062 58.301 234.462 67.603 234.216C85.768 233.736 104.006 233.979 122.182 234.024L230.618 234.086L692.27 234.076L806.7 234.074C820.89 234.074 836.81 233.625 850.99 234.535C856.65 234.897 863.08 242.207 860.14 247.942C855.66 258.055 846.8 257.139 837.83 256.793L837.82 245.209L79.047 245.216L79.05 256.901Z" fill="#060614" />
            </svg>
          </motion.div>

        </div>

        {/* ── Print Again button ──────────────────────────────── */}
        <motion.button
          onClick={play}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          style={{
            ...SATOSHI,
            background: 'none',
            border: '1px solid #e1e4ea',
            borderRadius: 6,
            padding: '9px 28px',
            fontSize: 12, fontWeight: 500,
            letterSpacing: '-0.2px',
            color: '#525866', cursor: 'pointer',
          }}
        >
          Print Again
        </motion.button>

        {/* ── Credit ─────────────────────────────────────────── */}
        <p style={{
          ...SATOSHI,
          fontSize: 11, fontWeight: 500,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: '#8899CC',
        }}>
          Precious Anizoba
        </p>

      </div>
    </div>
  )
}
