// Minimal React typings: this build machine has no @types/react. With `npm i` on a normal machine the real types take over.
declare module 'react' {
  export type ReactNode = any
  export type PointerEvent = any
  export function useState<T>(init: T | (() => T)): [T, (v: T | ((p: T) => T)) => void]
  export function useState<T = undefined>(): [T | undefined, (v: T | undefined | ((p: T | undefined) => T | undefined)) => void]
  export function useEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void
  export function useMemo<T>(fn: () => T, deps: readonly unknown[]): T
  export function useRef<T>(init: T): { current: T }
  export function useRef<T>(): { current: T | undefined }
  export function useSyncExternalStore<T>(sub: (cb: () => void) => () => void, get: () => T): T
  const React: { PointerEvent: any }
  export default React
}
declare module 'react-dom/client' { export function createRoot(el: Element): { render(n: any): void } }
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any }
declare namespace React { type PointerEvent = any }
declare namespace JSX { type Element = any; interface IntrinsicElements { [k: string]: any } interface ElementChildrenAttribute { children: {} } interface IntrinsicAttributes { key?: any } }
declare module '*.css' {}
declare module '*.jpg' { const src: string; export default src }
declare module '*.json' { const v: any; export default v }
