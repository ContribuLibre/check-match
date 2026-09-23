/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module "*.yml" {
  const contenu: unknown
  export default contenu
}
declare module '*.svg?raw' {
  const contenu: string
  export default contenu
}
