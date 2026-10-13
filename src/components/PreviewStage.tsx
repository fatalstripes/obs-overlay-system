import { useEffect, useRef, useState, type ReactNode } from 'react'

/** What an overlay looks like in a `width`×`height` Browser Source, scaled to fit the panel, over a transparency checkerboard. */
export function PreviewStage({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / width))
    ro.observe(el) // fires once straight away, so the scale is right from the first paint
    return () => ro.disconnect()
  }, [width])

  return (
    <div
      ref={box}
      className="relative w-full overflow-hidden rounded-md border border-zinc-800"
      style={{
        aspectRatio: `${width} / ${height}`,
        backgroundImage:
          'linear-gradient(45deg,#27272a 25%,transparent 25%),linear-gradient(-45deg,#27272a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#27272a 75%),linear-gradient(-45deg,transparent 75%,#27272a 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
        backgroundColor: '#18181b',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  )
}
