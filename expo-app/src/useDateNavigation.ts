import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';

type Options = {
  offset: number;
  cellWidth: number;
  reverse: boolean;
  onOffsetChange: (offset: number) => void;
};

// Only claim horizontal movement, leaving taps and vertical list scrolling alone.
export function useDateNavigation(options: Options) {
  const latest = useRef(options);
  const startOffset = useRef(options.offset);
  const dragging = useRef(false);
  const suppressUntil = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  useLayoutEffect(() => { latest.current = options; }, [options]);

  const panHandlers = useMemo(() => {
    function update(dx: number) {
      const { reverse, cellWidth, onOffsetChange } = latest.current;
      const days = Math.round((reverse ? dx : -dx) / cellWidth);
      onOffsetChange(Math.max(0, startOffset.current + days));
    }
    function finish() {
      dragging.current = false;
      // Some browsers dispatch a click after mouseup/touchend. It belongs to the drag.
      // eslint-disable-next-line react-hooks/purity -- PanResponder invokes finish on release, not during render.
      suppressUntil.current = Date.now() + 250;
      setIsDragging(false);
    }
    // eslint-disable-next-line react-hooks/refs -- create only registers callbacks; gesture events read these refs later.
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        startOffset.current = latest.current.offset;
        suppressUntil.current = 0;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        gesture.numberActiveTouches === 1 && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderGrant: () => { dragging.current = true; setIsDragging(true); },
      onPanResponderMove: (_event, gesture) => update(gesture.dx),
      onPanResponderRelease: (_event, gesture) => { update(gesture.dx); finish(); },
      onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => false,
    }).panHandlers;
  }, []);

  return {
    panHandlers,
    isDragging,
    suppressPress: () => dragging.current || Date.now() < suppressUntil.current,
  };
}
