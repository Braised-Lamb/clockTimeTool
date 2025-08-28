<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const time = ref('')
let timer: number | undefined
const fontSize = ref<number>(parseFloat(localStorage.getItem('clockFontSize') || '8') || 8)
const syncStatus = ref('')
const showServerConfig = ref(false)
const currentServer = ref('time.windows.com')
const newServer = ref('')
const serverHistory = ref<string[]>([])
const showHistory = ref(false)
const alwaysOnTop = ref<boolean>(localStorage.getItem('alwaysOnTop') === 'true')

// 上一次刷新所使用的系统时间戳（毫秒）
let lastTick = 0

// 检查是否在 Electron 环境中
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

function setFontSize(size: number) {
  fontSize.value = size
  localStorage.setItem('clockFontSize', String(size))
}

function increaseFont() {
  setFontSize(Math.min(fontSize.value + 1, 30))
}
function decreaseFont() {
  setFontSize(Math.max(fontSize.value - 1, 2))
}

async function updateTime(force = false) {
  if (!isElectron()) {
    // 在非Electron环境下，回退到使用本地Date
    const localDate = new Date()
    // ... (此处可以保留旧的、非精确的逻辑)
    time.value = localDate.toLocaleTimeString('it-IT') // 简单的回退显示
    return
  }

  // 从主进程获取权威时间
  const nowMs = await window.electronAPI.getCurrentTime()
  const nowDate = new Date(nowMs)

  // 检查时间跳变... (这部分逻辑依然有效)
  if (lastTick > 0) {
    const drift = nowMs - lastTick
    if (Math.abs(drift - 1000) > 1000) {
      force = true
    }
  }

  // 更新时间字符串
  const h = String(nowDate.getHours()).padStart(2, '0')
  const m = String(nowDate.getMinutes()).padStart(2, '0')
  const s = String(nowDate.getSeconds()).padStart(2, '0')
  time.value = `${h}:${m}:${s}`

  lastTick = nowMs - (nowMs % 1000)

  // 计算下一次刷新间隔
  let delay = 1000 - (nowMs % 1000)
  if (force && delay > 20) delay = 20

  if (timer) clearTimeout(timer)
  timer = window.setTimeout(() => updateTime(false), delay)
}

// 立即刷新界面时间
async function refreshClockNow() {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  await updateTime(true)
}

// 时间同步
async function syncTime() {
  if (!isElectron()) {
    syncStatus.value = '此功能仅在桌面应用中可用'
    return
  }

  syncStatus.value = `正在与 ${currentServer.value} 同步时间...`
  try {
    const result = await window.electronAPI.syncTime(currentServer.value)
    syncStatus.value = result.message

    // 如果同步成功，立即更新界面时间显示
    if (result.success) {
      refreshClockNow()
    }

    setTimeout(() => (syncStatus.value = ''), 4000)
  } catch (error) {
    syncStatus.value = '同步失败'
    setTimeout(() => (syncStatus.value = ''), 3000)
  }
}

// 设置时间服务器（仅在应用内部配置）
function setTimeServer(server: string) {
  currentServer.value = server
  syncStatus.value = `已设置时间服务器为: ${server}`

  // 将当前服务器移到历史记录的最前面
  const existingIndex = serverHistory.value.indexOf(server)
  if (existingIndex > -1) {
    // 如果已存在，先移除
    serverHistory.value.splice(existingIndex, 1)
  }
  // 添加到最前面
  serverHistory.value.unshift(server)

  // 限制历史记录数量
  if (serverHistory.value.length > 10) {
    serverHistory.value = serverHistory.value.slice(0, 10)
  }

  // 保存历史记录和当前服务器
  saveServerHistory()
  saveCurrentServer()

  setTimeout(() => (syncStatus.value = ''), 3000)
}

// 保存服务器历史
async function saveServerHistory() {
  if (isElectron()) {
    await window.electronAPI.saveServerHistory(serverHistory.value)
  }
}

// 保存当前服务器设置
async function saveCurrentServer() {
  if (isElectron()) {
    localStorage.setItem('currentTimeServer', currentServer.value)
  } else {
    localStorage.setItem('currentTimeServer', currentServer.value)
  }
}

// 加载服务器历史
async function loadServerHistory() {
  if (isElectron()) {
    try {
      const result = await window.electronAPI.loadServerHistory()
      if (result.success) {
        serverHistory.value = result.servers
      }
    } catch (error) {
      console.error('加载历史失败:', error)
    }
  }

  // 恢复上次设置的服务器
  loadCurrentServer()
}

// 加载上次设置的服务器
function loadCurrentServer() {
  const savedServer = localStorage.getItem('currentTimeServer')
  if (savedServer) {
    currentServer.value = savedServer
  } else if (serverHistory.value.length > 0) {
    // 如果没有保存的服务器，使用历史记录中的第一个
    currentServer.value = serverHistory.value[0]
  }
}

// 删除服务器历史
function removeServerFromHistory(server: string) {
  const index = serverHistory.value.indexOf(server)
  if (index > -1) {
    serverHistory.value.splice(index, 1)
    saveServerHistory()
  }
}

// 添加新服务器
function addNewServer() {
  const server = newServer.value.trim()
  if (server && !serverHistory.value.includes(server)) {
    setTimeServer(server)
    newServer.value = ''
    showServerConfig.value = false
  }
}

// 选择历史服务器
function selectServer(server: string) {
  setTimeServer(server)
  showHistory.value = false
}

// 处理页面可见性变化
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // 当窗口从后台切回前台时，立即强制刷新时间
    refreshClockNow()
  }
}

async function applyAlwaysOnTop(flag: boolean) {
  alwaysOnTop.value = flag
  localStorage.setItem('alwaysOnTop', String(flag))
  if (isElectron()) {
    try {
      await window.electronAPI.setAlwaysOnTop(flag)
    } catch {}
  }
}

async function initAlwaysOnTop() {
  if (isElectron()) {
    try {
      const res = await window.electronAPI.getAlwaysOnTop()
      if (res.success) {
        alwaysOnTop.value = res.value
        localStorage.setItem('alwaysOnTop', String(res.value))
      } else {
        // 如果主进程未设置则应用本地保存的值
        await applyAlwaysOnTop(alwaysOnTop.value)
      }
    } catch {
      await applyAlwaysOnTop(alwaysOnTop.value)
    }
  }
}

function toggleAlwaysOnTop() {
  applyAlwaysOnTop(!alwaysOnTop.value)
}

onMounted(async () => {
  await updateTime() // 首次加载使用权威时间
  if (isElectron()) {
    loadServerHistory()
    initAlwaysOnTop()
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
})
onUnmounted(() => {
  if (timer) clearTimeout(timer)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div class="clock-container">
    <div class="sync-toolbar">
      <button @click="toggleAlwaysOnTop" :title="alwaysOnTop ? '取消始终置顶' : '始终置顶'">
        {{ alwaysOnTop ? '📌' : '📍' }}
      </button>
      <button @click="syncTime" title="与当前配置的时间服务器同步时间（需要管理员权限）">🔄</button>
      <button @click="showServerConfig = true" title="设置时间服务器地址">⚙️</button>
    </div>

    <!-- 服务器配置弹窗 -->
    <div v-if="showServerConfig" class="config-modal">
      <div class="config-content">
        <h3>时间服务器设置</h3>
        <div class="current-server">
          <span>当前服务器: {{ currentServer }}</span>
        </div>

        <div class="server-input">
          <input v-model="newServer" placeholder="输入时间服务器地址" @keyup.enter="addNewServer" />
          <button @click="addNewServer">设置</button>
        </div>
        <div class="server-history">
          <div class="history-header">
            <span>历史服务器</span>
            <button @click="showHistory = !showHistory">
              {{ showHistory ? '隐藏' : '显示' }}
            </button>
          </div>

          <div v-if="showHistory" class="history-list">
            <div v-for="server in serverHistory" :key="server" class="history-item">
              <span @click="selectServer(server)" class="server-name">{{ server }}</span>
              <button @click="removeServerFromHistory(server)" class="delete-btn">×</button>
            </div>
          </div>
        </div>

        <div class="config-actions">
          <button @click="showServerConfig = false">关闭</button>
        </div>
      </div>
    </div>

    <div class="clock-toolbar">
      <button @click="decreaseFont" title="缩小字体">A-</button>
      <button @click="increaseFont" title="放大字体">A+</button>
    </div>
    <div class="clock-time" :style="{ fontSize: fontSize + 'vw' }">{{ time }}</div>
    <div v-if="syncStatus" class="status-message">{{ syncStatus }}</div>
  </div>
</template>

<style scoped>
.clock-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #111;
}
.sync-toolbar {
  position: absolute;
  top: 2vh;
  left: 2vw;
  opacity: 0.8;
  z-index: 10;
  transition: opacity 0.2s;
}
.sync-toolbar:hover {
  opacity: 1;
}
.clock-toolbar {
  position: absolute;
  top: 2vh;
  right: 2vw;
  opacity: 0.8;
  z-index: 10;
  transition: opacity 0.2s;
}
.clock-toolbar:hover {
  opacity: 1;
}
.clock-toolbar button {
  background: #222;
  color: #0ff;
  border: none;
  border-radius: 4px;
  font-size: 1.2vw;
  margin: 0 0.2vw;
  padding: 0.2vw 0.8vw;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}
.clock-toolbar button:hover {
  background: #0ff;
  color: #111;
}
.sync-toolbar button {
  background: #222;
  color: #0ff;
  border: none;
  border-radius: 4px;
  font-size: 1.1vw;
  margin: 0 0.2vw;
  padding: 0.3vw 0.7vw;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}
.sync-toolbar button:hover {
  background: #0ff;
  color: #111;
}
.clock-time {
  color: #fff;
  font-family: 'Consolas', 'Courier New', monospace;
  letter-spacing: 0.1em;
  text-shadow:
    0 0 20px #0ff,
    0 0 40px #0ff;
  user-select: none;
}

.status-message {
  color: #0ff;
  font-size: 1.5vw;
  margin-top: 2vh;
  font-family: 'Arial', sans-serif;
  text-align: center;
}

.config-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.config-content {
  background: #222;
  color: #0ff;
  padding: 2vw;
  border-radius: 8px;
  border: 2px solid #0ff;
  min-width: 400px;
  max-width: 600px;
}

.config-content h3 {
  margin: 0 0 1vw 0;
  text-align: center;
}

.current-server {
  margin-bottom: 1vw;
  padding: 0.5vw;
  background: #333;
  border-radius: 4px;
}

.server-input {
  display: flex;
  gap: 0.5vw;
  margin-bottom: 1vw;
}

.server-input input {
  flex: 1;
  padding: 0.5vw;
  background: #333;
  color: #0ff;
  border: 1px solid #555;
  border-radius: 4px;
}

.server-input input:focus {
  outline: none;
  border-color: #0ff;
}

.server-input button,
.config-actions button,
.history-header button {
  background: #444;
  color: #0ff;
  border: 1px solid #0ff;
  border-radius: 4px;
  padding: 0.5vw 1vw;
  cursor: pointer;
}

.server-input button:hover,
.config-actions button:hover,
.history-header button:hover {
  background: #0ff;
  color: #222;
}

.server-history {
  margin-bottom: 1vw;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5vw;
  font-weight: bold;
}

.history-list {
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #555;
  border-radius: 4px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5vw;
  border-bottom: 1px solid #333;
}

.history-item:last-child {
  border-bottom: none;
}

.server-name {
  cursor: pointer;
  flex: 1;
}

.server-name:hover {
  color: #fff;
}

.delete-btn {
  background: #660;
  color: #ff0;
  border: 1px solid #ff0;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: #ff0;
  color: #660;
}

.config-actions {
  text-align: center;
}
</style>

<style>
html,
body {
  margin: 0;
  padding: 0;
  background: #111;
  height: 100%;
}
</style>
