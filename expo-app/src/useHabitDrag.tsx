import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, ScrollView, View, ViewProps, ViewStyle } from 'react-native';
import { Icon, useTheme } from './ui';

type Drag = { id: string; targetId: string; dy: number };
type Layout = { y: number; height: number };

export function useHabitDrag(ids: string[], onDrop: (id: string, targetId: string, ids: string[]) => void) {
  const latest = useRef({ ids, onDrop });
  useLayoutEffect(() => { latest.current = { ids, onDrop }; }, [ids, onDrop]);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const layouts = useRef(new Map<string, Layout>());
  const viewport = useRef({ offset: 0, height: 0, content: 0 });
  const scrollStart = useRef(0);
  const active = useRef<{ id: string; startOffset: number; dy: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const isDragging = !!drag;

  function update() {
    const current = active.current;
    if (!current) return;
    const source = layouts.current.get(current.id);
    if (!source) return;
    const dy = current.dy + viewport.current.offset - current.startOffset;
    const center = source.y + source.height / 2 + dy;
    let targetId = current.id, distance = Infinity;
    for (const id of latest.current.ids) {
      const row = layouts.current.get(id);
      if (!row) continue;
      const next = Math.abs(row.y + row.height / 2 - center);
      if (next < distance) { targetId = id; distance = next; }
    }
    setDrag({ id: current.id, targetId, dy });
    return targetId;
  }

  useEffect(() => {
    if (!drag) return;
    const timer = setInterval(() => {
      const current = active.current;
      const row = current && layouts.current.get(current.id);
      if (!current || !row) return;
      const v = viewport.current;
      const center = row.y + row.height / 2 + current.dy - current.startOffset;
      const step = center < 104 ? -12 : center > v.height - 48 ? 12 : 0;
      const offset = Math.max(0, Math.min(v.content - v.height, v.offset + step));
      if (offset === v.offset) return;
      v.offset = offset;
      scroll.current?.scrollTo({ y: offset, animated: false });
      update();
    }, 30);
    return () => clearInterval(timer);
    // The interval reads current gesture and viewport refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  return {
    drag, scroll,
    prepareScroll: () => { scrollStart.current = viewport.current.offset; },
    scrollBeforeHold: (dy: number) => {
      const v = viewport.current;
      const offset = Math.max(0, Math.min(v.content - v.height, scrollStart.current - dy));
      v.offset = offset;
      scroll.current?.scrollTo({ y: offset, animated: false });
    },
    shift: (id: string) => {
      if (!drag) return 0;
      if (id === drag.id) return drag.dy;
      const from = ids.indexOf(drag.id), to = ids.indexOf(drag.targetId), row = ids.indexOf(id);
      const height = layouts.current.get(drag.id)?.height ?? 88;
      return from < to && row > from && row <= to ? -height
        : to < from && row >= to && row < from ? height : 0;
    },
    layout: (id: string, layout: Layout) => layouts.current.set(id, layout),
    onScroll: (offset: number) => { viewport.current.offset = offset; },
    onSize: (height: number) => { viewport.current.height = height; },
    onContentSize: (height: number) => { viewport.current.content = height; },
    start: (id: string) => {
      active.current = { id, startOffset: viewport.current.offset, dy: 0 };
      setDrag({ id, targetId: id, dy: 0 });
    },
    move: (dy: number) => { if (active.current) { active.current.dy = dy; update(); } },
    finish: (cancel = false) => {
      const current = active.current;
      const target = update();
      active.current = null;
      setDrag(null);
      if (!cancel && current && target && current.id !== target)
        latest.current.onDrop(current.id, target, latest.current.ids);
    },
  };
}

export function HabitDragTarget(props: {
  name: string; enabled: boolean; dragging: boolean; children: React.ReactNode; style: ViewStyle;
  onPress: () => void; onStart: () => void; onMove: (dy: number) => void;
  onFinish: (cancel?: boolean) => void; onStep: (delta: number) => void;
  onScrollStart: () => void; onScrollMove: (dy: number) => void;
}) {
  const t = useTheme();
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const moved = useRef(false);
  const [pressed, setPressed] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const handlers = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- callbacks access refs only during gestures.
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        held.current = false; moved.current = false; setPressed(true);
        latest.current.onScrollStart();
        if (latest.current.enabled) timer.current = setTimeout(() => {
          held.current = true;
          latest.current.onStart();
        }, 350);
      },
      onPanResponderMove: (_event, gesture) => {
        if (held.current) latest.current.onMove(gesture.dy);
        else if (Math.abs(gesture.dy) > 8 || Math.abs(gesture.dx) > 8) {
          moved.current = true; clearTimeout(timer.current); setPressed(false);
          if (Platform.OS === 'web' && latest.current.enabled) latest.current.onScrollMove(gesture.dy);
        }
      },
      onPanResponderRelease: (_event, gesture) => {
        clearTimeout(timer.current); setPressed(false);
        if (held.current) { latest.current.onMove(gesture.dy); latest.current.onFinish(); }
        else if (!moved.current) latest.current.onPress();
        held.current = false;
      },
      onPanResponderTerminate: () => {
        clearTimeout(timer.current); setPressed(false);
        if (held.current) latest.current.onFinish(true);
        held.current = false;
      },
      onPanResponderTerminationRequest: () => !held.current,
    }).panHandlers;
  }, []);
  return <View {...handlers} accessible accessibilityRole="button" accessibilityLabel={`View ${props.name}`}
    accessibilityHint={props.enabled ? 'Hold and drag to reorder. Use Alt and arrow keys to move up or down.' : undefined}
    accessibilityActions={props.enabled ? [{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }] : []}
    onAccessibilityAction={event => props.onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    tabIndex={0}
    {...(Platform.OS === 'web' ? {
      onContextMenu: (event: { preventDefault: () => void }) => { if (props.enabled) event.preventDefault(); },
      onKeyDown: (event: Parameters<NonNullable<ViewProps['onKeyDown']>>[0]) => {
        const keyboard = event as unknown as React.KeyboardEvent;
        if (keyboard.key === 'Escape') { clearTimeout(timer.current); props.onFinish(true); held.current = false; moved.current = true; setPressed(false); }
        else if (props.enabled && keyboard.altKey && ['ArrowUp', 'ArrowDown'].includes(keyboard.key)) {
          event.preventDefault(); props.onStep(keyboard.key === 'ArrowUp' ? -1 : 1);
        } else if (keyboard.key === 'Enter' || keyboard.key === ' ') { event.preventDefault(); props.onPress(); }
      },
    } : {})}
    style={[props.style, { backgroundColor: pressed || props.dragging ? t.soft : 'transparent' },
      Platform.OS === 'web' && ({ cursor: props.dragging ? 'grabbing' : 'pointer', touchAction: props.enabled ? 'none' : 'pan-y', userSelect: 'none', WebkitTouchCallout: 'none' } as unknown as ViewStyle)]}>
    {props.dragging && <View testID="habit-drag-indicator"><Icon name="grip" /></View>}
    {props.children}
  </View>;
}
