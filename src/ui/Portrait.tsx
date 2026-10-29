// Character portraits are the player's own photo (camera or gallery), cropped square. Never generated.
import { useEffect, useRef, useState } from 'react'
import { Sheet } from './kit'

export function PortraitPicker({ onPick, onClose }: { onPick: (dataUrl: string) => void; onClose: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const cv = useRef<HTMLCanvasElement | null>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const SIZE = 240

  const load = (f?: File) => {
    if (!f) return
    const r = new FileReader()
    r.onload = () => { const i = new Image(); i.onload = () => { setImg(i); setZoom(1); setOff({ x: 0, y: 0 }) }; i.src = r.result as string }
    r.readAsDataURL(f)
  }
  useEffect(() => {
    const c = cv.current
    if (!c || !img) return
    const g = c.getContext('2d')!
    const base = Math.max(SIZE / img.width, SIZE / img.height) * zoom
    const w = img.width * base, h = img.height * base
    g.fillStyle = '#000'; g.fillRect(0, 0, SIZE, SIZE)
    g.drawImage(img, (SIZE - w) / 2 + off.x, (SIZE - h) / 2 + off.y, w, h)
  }, [img, zoom, off])

  return (
    <Sheet title="Portrait photo" onClose={onClose}>
      <p className="muted">Take a photo or pick one from your gallery. Drag to frame it, slide to zoom.</p>
      <label className="btn"><input type="file" accept="image/*" hidden onChange={(e) => load(e.target.files?.[0])} />📷 Choose photo</label>
      {img && (
        <>
          <canvas ref={cv} width={SIZE} height={SIZE} style={{ width: SIZE, maxWidth: '100%', borderRadius: '50%', alignSelf: 'center', touchAction: 'none', cursor: 'grab' }}
            onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }; (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
            onPointerMove={(e) => { const d = drag.current; if (d) setOff({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }) }}
            onPointerUp={() => { drag.current = null }} />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} aria-label="Zoom" />
          <button className="btn primary" onClick={() => { onPick(cv.current!.toDataURL('image/jpeg', 0.72)); onClose() }}>Use this photo</button>
        </>
      )}
    </Sheet>
  )
}
