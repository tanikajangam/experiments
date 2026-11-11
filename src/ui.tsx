// Shared styles and icons, copied from design/prototype.dc.html.
import type { CSSProperties, ReactNode } from 'react'

export const C = {
  ground: '#DAD4C8',
  card: '#EDE9E0',
  cream: '#F3F0E9',
  green: '#2F7A4B',
  greenDark: '#245A3A',
  greenText: '#2E5A2B',
  red: '#96371C',
  miss: '#E0875A',
  ink: '#2B2A26',
  ink2: '#5D5A52',
  rule: '#C9C2B3',
  headA: '#4B5B4F',
  headB: '#4E6B3A',
  disabledBg: '#B9B3A6',
  disabledFg: '#4A4740',
} as const

/** Fraunces, for numbers and the italic lines. */
export const serif: CSSProperties = {
  fontFamily: "Fraunces, Georgia, 'Times New Roman', serif",
  fontOpticalSizing: 'auto',
}

export const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** Root of every screen: fills the phone height (844 px in the prototype frame). */
export const screenRoot: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
  boxSizing: 'border-box',
  animation: `screenIn 320ms ${ease} both`,
}

/** The bar pinned to the bottom of a screen. */
export const stickyBar: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  padding: '12px 24px max(24px, env(safe-area-inset-bottom))',
  background: C.ground,
}

export const primaryButton: CSSProperties = {
  width: '100%',
  minHeight: 56,
  padding: '0 32px',
  borderRadius: 999,
  border: 0,
  background: C.green,
  color: '#FFFFFF',
  fontSize: 18,
  fontWeight: 500,
  cursor: 'pointer',
}

export const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: C.red,
}

export const sectionHeading: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 500, color: C.red }

export const roundIconButton: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: 0,
  background: 'transparent',
  color: C.headA,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: -10,
}

/** Selected / unselected chip colours. */
export function chip(on: boolean): { background: string; color: string; borderColor: string } {
  return on
    ? { background: C.green, color: '#FFFFFF', borderColor: C.green }
    : { background: C.card, color: C.ink, borderColor: C.rule }
}

export function haptic(kind: 'tick' | 'tap' | 'yes' | 'no' | 'open' | 'celebrate') {
  const p = { tick: 4, tap: 10, yes: [12, 40, 18], no: 22, open: 8, celebrate: [20, 60, 20, 60, 40, 80, 120] }[kind]
  try {
    navigator.vibrate?.(p)
  } catch {
    // Not supported (iOS): ignore.
  }
}

// ---------------------------------------------------------------------------
// Icons: inline stroke SVGs, as in the prototype.
// ---------------------------------------------------------------------------

function Svg({ size, width, children, join = true }: { size: number; width: number; children: ReactNode; join?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin={join ? 'round' : undefined}
    >
      {children}
    </svg>
  )
}

export const BackIcon = () => (
  <Svg size={22} width={2.2}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
)

export const CheckIcon = ({ size = 20, width = 2.6 }: { size?: number; width?: number }) => (
  <Svg size={size} width={width}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const CrossIcon = ({ size = 18, width = 2.4 }: { size?: number; width?: number }) => (
  <Svg size={size} width={width} join={false}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

export const CloseIcon = () => (
  <Svg size={20} width={2.4} join={false}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const PlusIcon = () => (
  <Svg size={20} width={2.5} join={false}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const BellIcon = ({ off }: { off: boolean }) => (
  <Svg size={24} width={2.2}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    <path d={off ? 'M3 3l18 18' : ''} />
  </Svg>
)

export const MicIcon = ({ size = 24 }: { size?: number }) => (
  <Svg size={size} width={2}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
  </Svg>
)
