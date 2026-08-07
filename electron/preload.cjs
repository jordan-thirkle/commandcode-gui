const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cmdgui', {
  run: (payload) => ipcRenderer.invoke('run:start', payload),
  abort: (runId) => ipcRenderer.invoke('run:abort', runId),
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  mcpList: () => ipcRenderer.invoke('mcp:list'),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  listAgents: () => ipcRenderer.invoke('agents:list'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  runCommand: (payload) => ipcRenderer.invoke('run:command', payload),
  onRunEvent: (cb) => {
    const listener = (_e, evt) => cb(evt);
    ipcRenderer.on('run:event', listener);
    return () => ipcRenderer.removeListener('run:event', listener);
  },
});
