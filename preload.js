// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  syncTime: (server) => ipcRenderer.invoke('sync-time', server),
  getCurrentTime: () => ipcRenderer.invoke('get-current-time'),
  saveServerHistory: (servers) => ipcRenderer.invoke('save-server-history', servers),
  loadServerHistory: () => ipcRenderer.invoke('load-server-history'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
})
