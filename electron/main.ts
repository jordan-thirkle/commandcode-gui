import electron from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CliBridge } from '../src/main/cli/CliBridge.js';
import { RunManager } from '../src/main/RunManager.js';
import { listSessions, readTranscript } from '../src/main/sessionStore.js';
import { listMcpServers, listSkills, listAgents, readSettings, runProjectCommand } from '../src/main/surface.js';

const { app, BrowserWindow, ipcMain } = electron;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Allow the compiled module to be imported outside an Electron runtime
// (e.g. the smoke test) without crashing on `app.isPackaged`.
const isElectronRuntime = !!app?.isPackaged;
const isDev = isElectronRuntime && !app.isPackaged;
const workspaceRoot = process.cwd();

const bridge = new CliBridge();
const runManager = new RunManager(bridge);

function registerIpc(win: BrowserWindowType): void {
  runManager.attachWindow(win);

  ipcMain.handle('run:start', (_e, payload) => {
    const pm = payload?.permissionMode;
    if (pm !== undefined && !['standard', 'plan', 'auto-accept'].includes(pm)) {
      return { ok: false, error: `invalid permissionMode: ${pm}` };
    }
    runManager.startRun({
      prompt: String(payload?.prompt ?? ''),
      model: payload?.model,
      effort: payload?.effort,
      resume: payload?.resume,
      continueRecent: payload?.continueRecent,
      permissionMode: pm,
      cwd: workspaceRoot,
    });
    return { ok: true };
  });

  ipcMain.handle('run:command', (_e, payload) => {
    const { command, timeoutMs } = payload ?? {};
    if (typeof command !== 'string' || !command.trim()) {
      return { code: 2, stdout: '', stderr: 'invalid command' };
    }
    return runProjectCommand(command, workspaceRoot, timeoutMs);
  });

  ipcMain.handle('run:abort', () => {
    runManager.abort();
    return { ok: true };
  });

  ipcMain.handle('sessions:list', async () => listSessions(workspaceRoot));
  ipcMain.handle('sessions:read', async (_e, id: string) => readTranscript(String(id)));
  ipcMain.handle('mcp:list', async () => listMcpServers(workspaceRoot));
  ipcMain.handle('skills:list', async () => listSkills());
  ipcMain.handle('agents:list', async () => listAgents());
  ipcMain.handle('config:get', async () => readSettings());
}

async function createWindow(): Promise<BrowserWindowType> {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Command Code GUI',
    show: false, // avoid flashing at default position; show on ready
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  registerIpc(win);

  // Bring the window forward reliably once it is ready to paint, even when
  // other apps hold focus (Windows restricts background focus-stealing).
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

if (isElectronRuntime && app) {
  app.whenReady().then(async () => {
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// No-op when imported under plain node (smoke test): the app simply does not
// start, which is exactly what an import-resolve smoke check wants.
