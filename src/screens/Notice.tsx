// A plain screen with one line: while the first load runs, or when the build has no Supabase settings.
import { C, ease, screenRoot } from '../ui.tsx'

export function Notice({ text }: { text: string }) {
  return (
    <div style={{ ...screenRoot, padding: '56px 24px max(24px, env(safe-area-inset-bottom))' }}>
      <span style={{ fontSize: 18, fontWeight: 500, color: C.headA }}>
        Tanki’s <span style={{ color: C.headB }}>Experiments</span>
      </span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Delayed, so a quick load never flashes the line. */}
        <p role="status" style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: C.ink2, textAlign: 'center', animation: `riseIn 500ms ${ease} 600ms both` }}>
          {text}
        </p>
      </div>
    </div>
  )
}
