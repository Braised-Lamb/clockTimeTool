// main.cjs
// Electron 主进程入口（优化版）
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')

// 检查本地文件是否存在
const hasLocalDist = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))

let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 300,
    minWidth: 600,
    minHeight: 100,
    icon: path.join(__dirname, 'public', 'clock.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#111',
    show: false,
  })

  mainWindow = win

  win.setMenuBarVisibility(false)
  win.setTitle('系统时间')

  // 简化加载逻辑：优先本地文件，快速回退
  win.webContents.once('did-finish-load', () => {
    win.setTitle('系统时间') // 确保页面加载后标题正确
    win.show()
  })

  // 智能加载策略
  if (hasLocalDist) {
    // 有本地构建文件，优先使用
    const localFile = path.join(__dirname, 'dist', 'index.html')
    win.loadFile(localFile).catch(() => {
      tryDevServer()
    })
  } else {
    // 没有本地文件，直接尝试开发服务器
    tryDevServer()
  }

  function tryDevServer() {
    const ports = [5173, 5174, 5175, 5176, 5177]
    let portIndex = 0

    function tryNext() {
      if (portIndex >= ports.length) {
        win.loadURL(
          'data:text/html,<body style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial"><h1>请先运行 npm run dev</h1></body>',
        )
        return
      }

      const url = `http://localhost:${ports[portIndex]}`
      win.loadURL(url).catch(() => {
        portIndex++
        setTimeout(tryNext, 100) // 快速尝试下一个端口
      })
    }

    tryNext()
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('get-current-time', () => {
  return Date.now()
})

// Always-on-top: set state
ipcMain.handle('set-always-on-top', (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(!!flag, 'screen')
    return { success: true, value: mainWindow.isAlwaysOnTop() }
  }
  return { success: false, value: false }
})

// Always-on-top: get current state
ipcMain.handle('get-always-on-top', () => {
  if (mainWindow) {
    return { success: true, value: mainWindow.isAlwaysOnTop() }
  }
  return { success: false, value: false }
})

// IPC 处理器：系统时间同步
// IPC handler: Time sync with specified time server (requires admin privileges)
ipcMain.handle('sync-time', async (event, server = 'time.windows.com') => {
  return new Promise((resolve, reject) => {
    console.log('Starting simple time sync with server:', server)

    // Simple PowerShell script for time sync
    const psScript = `# Force start w32time service
Start-Service w32time -ErrorAction SilentlyContinue

# Configure time server
Write-Host "Configuring time server: ${server}"
w32tm /config /manualpeerlist:"${server}" /syncfromflags:manual /update

# Force sync
Write-Host "Forcing time sync..."
w32tm /resync /force`

    // Create temporary PowerShell script file
    const tempPath = require('path').join(
      require('os').tmpdir(),
      `simple-ntp-sync-${Date.now()}.ps1`,
    )
    require('fs').writeFileSync(tempPath, psScript, 'utf8')

    // Start PowerShell with admin privileges to execute the script file
    const adminCmd = `powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy', 'Bypass', '-File', '${tempPath}' -Verb RunAs -Wait"`

    exec(adminCmd, (error, stdout, stderr) => {
      // Clean up temporary file
      try {
        require('fs').unlinkSync(tempPath)
      } catch (e) {
        console.log('Failed to delete temp file:', e.message)
      }

      if (error) {
        console.error('Time sync failed:', error)
        if (error.code === 1223) {
          resolve({ success: false, message: 'Operation cancelled by user' })
        } else {
          resolve({
            success: false,
            message: `Time sync failed: ${error.message}`,
          })
        }
      } else {
        console.log('Simple time sync completed successfully')
        console.log('stdout:', stdout)
        resolve({
          success: true,
          message: `Time synced with ${server}`,
        })
      }
    })
  })
})

// IPC handler: Save time server history
ipcMain.handle('save-server-history', async (event, servers) => {
  try {
    const fs = require('fs')
    const path = require('path')
    const { app } = require('electron')

    const userDataPath = app.getPath('userData')
    const historyFile = path.join(userDataPath, 'server-history.json')

    fs.writeFileSync(historyFile, JSON.stringify(servers, null, 2))
    return { success: true }
  } catch (error) {
    console.error('Failed to save history:', error)
    return { success: false, message: 'Save failed' }
  }
})

// IPC handler: Load time server history
ipcMain.handle('load-server-history', async () => {
  try {
    const fs = require('fs')
    const path = require('path')
    const { app } = require('electron')

    const userDataPath = app.getPath('userData')
    const historyFile = path.join(userDataPath, 'server-history.json')

    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf8')
      return { success: true, servers: JSON.parse(data) }
    } else {
      // Return default server list
      const defaultServers = [
        'time.windows.com',
        'time.nist.gov',
        'pool.ntp.org',
        'time.cloudflare.com',
      ]
      return { success: true, servers: defaultServers }
    }
  } catch (error) {
    console.error('Failed to load history:', error)
    return { success: false, message: 'Load failed', servers: ['time.windows.com'] }
  }
})
