import { createContext, useContext, useRef, useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { useRouteBoardStore } from '../../state/route-board-store';

type Zone = { id: number; view: View; disabled: boolean; onDrop: (id: number) => void };
const Zones = createContext<Map<number, Zone> | null>(null);
export function TransferProvider({ children }: { children: ReactNode }) {
  const zones = useRef(new Map<number, Zone>()).current;
  return <Zones.Provider value={zones}>{children}</Zones.Provider>;
}
export function TaskDrag({ taskId, disabled, children }: { taskId: number; disabled: boolean; children: ReactNode }) {
  const zones = useContext(Zones);
  const offset = useRef(new Animated.ValueXY()).current;
  const [active, setActive] = useState(false);
  const latest = useRef({ disabled, taskId, zones }); latest.current = { disabled, taskId, zones };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => !latest.current.disabled && Math.hypot(g.dx, g.dy) > 10,
    onPanResponderGrant: () => { setActive(true); useRouteBoardStore.getState().drag(latest.current.taskId); },
    onPanResponderMove: (_, g) => offset.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => {
      const id = latest.current.taskId;
      let dropped = false;
      latest.current.zones?.forEach((zone) => {
        if (zone.disabled) return;
        zone.view.measureInWindow((x, y, w, h) => {
          if (!dropped && g.moveX >= x && g.moveX <= x + w && g.moveY >= y && g.moveY <= y + h) { dropped = true; zone.onDrop(id); }
        });
      });
      offset.setValue({ x: 0, y: 0 }); setActive(false); useRouteBoardStore.getState().drag(null);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => { offset.setValue({ x: 0, y: 0 }); setActive(false); useRouteBoardStore.getState().drag(null); },
  }), [offset]);
  return <Animated.View {...pan.panHandlers} style={{ transform: offset.getTranslateTransform(), zIndex: active ? 100 : 0 }}>{children}</Animated.View>;
}
export function DropTarget({ routeId, disabled, onDrop, children }: { routeId: number; disabled: boolean; onDrop: (id: number) => void; children: ReactNode }) {
  const zones = useContext(Zones);
  return <View ref={(view) => { if (view) zones?.set(routeId, { id: routeId, view, disabled, onDrop }); else zones?.delete(routeId); }} collapsable={false}>{children}</View>;
}
