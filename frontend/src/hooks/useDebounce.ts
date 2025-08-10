import { useCallback, useRef, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebounce<T extends (...args: any[]) => any>(func: T, delay: number) {
  const funcRef = useRef(func);
  funcRef.current = func;

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const debouncedFunc = useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        funcRef.current(...args);
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return debouncedFunc;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebounceWithImmediate<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  onImmediate?: (...args: Parameters<T>) => void,
) {
  const funcRef = useRef(func);
  funcRef.current = func;

  const onImmediateRef = useRef(onImmediate);
  onImmediateRef.current = onImmediate;

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const debouncedFunc = useCallback(
    (...args: Parameters<T>) => {
      if (onImmediateRef.current) {
        onImmediateRef.current(...args);
      }

      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        funcRef.current(...args);
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return debouncedFunc;
}
