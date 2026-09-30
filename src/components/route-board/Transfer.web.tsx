import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouteBoardStore } from '../../state/route-board-store';

type Zone = { element: HTMLDivElement; disabled: boolean; onDrop: (id: number) => void };
const Zones = createContext<Map<number, Zone> | null>(null);
export function TransferProvider({ children }: { children: ReactNode }) {
  const zones = useRef(new Map<number, Zone>()).current;
  return <Zones.Provider value={zones}>{children}</Zones.Provider>;
}
export function TaskDrag({ taskId, disabled, children }: { taskId: number; disabled: boolean; children: ReactNode }) {
  const zones = useContext(Zones);
  const gesture = useRef<{ x: number; y: number; pointerX: number; pointerY: number; active: boolean; scroll: HTMLElement | null; initialScroll: number } | null>(null);
  const frame = useRef<number | null>(null);
  const stopScroll = () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; };
  const followPointer = () => {
    const g = gesture.current;
    if (g?.active) setOffset({ x: g.pointerX - g.x, y: g.pointerY - g.y + (g.scroll ? g.scroll.scrollTop - g.initialScroll : 0) });
  };
  const startScroll = () => {
    if (frame.current !== null) return;
    let previous = performance.now();
    const tick = (now: number) => {
      const g = gesture.current;
      if (!g?.active) { frame.current = null; return; }
      const elapsed = Math.min(now - previous, 40) / 1000;
      previous = now;
      if (g.scroll) {
        const bounds = g.scroll.getBoundingClientRect();
        const top = Math.max(bounds.top, 0), bottom = Math.min(bounds.bottom, window.innerHeight);
        const edge = Math.min(90, (bottom - top) / 3);
        let speed = 0;
        if (edge > 0 && g.pointerX >= bounds.left && g.pointerX <= bounds.right) {
          if (g.pointerY > bottom - edge) speed = 300 * Math.min(1, (g.pointerY - bottom + edge) / edge);
          else if (g.pointerY < top + edge) speed = -300 * Math.min(1, (top + edge - g.pointerY) / edge);
        }
        // Desplazamiento gradual, independiente de la frecuencia de eventos del puntero.
        g.scroll.scrollTop += speed * elapsed;
        followPointer();
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const clear = () => { stopScroll(); gesture.current = null; setOffset({ x: 0, y: 0 }); useRouteBoardStore.getState().drag(null); };
  useEffect(() => {
    const cancel = () => clear();
    window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('blur', cancel); stopScroll(); gesture.current = null; useRouteBoardStore.getState().drag(null); };
  }, []);
  useEffect(() => { if (disabled) clear(); }, [disabled]);
  return <div aria-label={`Arrastrar tarea ${taskId}`} style={{ cursor: disabled ? 'default' : 'grab', touchAction: 'none', userSelect: 'none', position: 'relative', zIndex: gesture.current?.active ? 100 : 0, transform: `translate(${offset.x}px, ${offset.y}px)`, opacity: gesture.current?.active ? 0.85 : 1 }}
    onPointerDownCapture={(event) => {
      if (disabled || event.button !== 0 || (event.target as Element).closest('[role="button"],button')) return;
      const scroll = event.currentTarget.closest<HTMLElement>('#route-board-scroll');
      gesture.current = { x: event.clientX, y: event.clientY, pointerX: event.clientX, pointerY: event.clientY, active: false, scroll, initialScroll: scroll?.scrollTop ?? 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      const g = gesture.current;
      if (!g) return;
      g.pointerX = event.clientX; g.pointerY = event.clientY;
      const x = event.clientX - g.x, y = event.clientY - g.y;
      if (!g.active && Math.hypot(x, y) > 8) { g.active = true; useRouteBoardStore.getState().drag(taskId); }
      if (g.active) { event.preventDefault(); followPointer(); startScroll(); }
    }}
    onPointerUp={(event) => {
      const active = gesture.current?.active;
      const x = event.clientX, y = event.clientY;
      clear();
      if (!active || disabled) return;
      for (const zone of zones?.values() ?? []) {
        const r = zone.element.getBoundingClientRect();
        if (!zone.disabled && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { zone.onDrop(taskId); break; }
      }
    }} onPointerCancel={clear} onLostPointerCapture={() => { if (gesture.current) clear(); }} onDragStart={(event) => event.preventDefault()}>{children}</div>;
}
export function DropTarget({ routeId, disabled, onDrop, children }: { routeId: number; disabled: boolean; onDrop: (id: number) => void; children: ReactNode }) {
  const zones = useContext(Zones);
  const dragging = useRouteBoardStore((s) => s.draggingId);
  return <div ref={(element) => { if (element) zones?.set(routeId, { element, disabled, onDrop }); else zones?.delete(routeId); }} aria-label={`Asignar tareas a hoja ${routeId}`} style={{ borderRadius: 14, outline: dragging !== null && !disabled ? '2px dashed #13855b' : 'none' }}>{children}</div>;
}
