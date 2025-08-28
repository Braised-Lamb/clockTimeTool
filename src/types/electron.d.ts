// types/electron.d.ts
export interface IElectronAPI {
  syncTime: (server?: string) => Promise<{ success: boolean; message: string }>
  getCurrentTime: () => Promise<number>
  saveServerHistory: (servers: string[]) => Promise<{ success: boolean; message?: string }>
  loadServerHistory: () => Promise<{ success: boolean; servers: string[]; message?: string }>
  setAlwaysOnTop: (flag: boolean) => Promise<{ success: boolean; value: boolean }>
  getAlwaysOnTop: () => Promise<{ success: boolean; value: boolean }>
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
