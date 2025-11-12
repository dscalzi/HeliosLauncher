(function(){
  // settings-logs.js - Refactored embedded logs panel wiring
  // Responsibilities:
  // - handle incoming 'mc-log-line' messages
  // - request history via 'request-mc-log-history'
  // - support pause/resume (queues while paused)
  // - support filter with debounce and safe regex handling
  // - provide save/copy/open actions via ipcRenderer where available
  // - expose minimal globals only when necessary

  'use strict'

  // Safe guard if not running in Electron
  const isElectron = (typeof require === 'function' && typeof module !== 'undefined')
  let ipcRenderer = null
  try { if (isElectron) ipcRenderer = require('electron').ipcRenderer } catch (e) { ipcRenderer = null }

  // DOM references (resolved lazily to allow early script load)
  function $(id) { return document.getElementById(id) }

  const state = {
    paused: false,
    queued: [],
    bufferSizeLimit: 20000, // characters
    lastFilter: '',
    filterDebounceMs: 250,
    filterTimeout: null
  }

  function getEls() {
    return {
      logsWrapper: $('settingsMcLogsWrapper'),
      logsEl: $('settingsMcLogs'),
      clearBtn: $('settingsMcLogsClear'),
      clearBtnMobile: $('settingsMcLogsClearMobile'),
      openBtn: $('settingsMcLogsOpenWindow'),
      openBtnMobile: $('settingsMcLogsOpenWindowMobile'),
      pauseBtn: $('settingsMcLogsPause'),
      pauseBtnMobile: $('settingsMcLogsPauseMobile'),
      saveBtn: $('settingsMcLogsSave'),
      saveBtnMobile: $('settingsMcLogsSaveMobile'),
      copyBtn: $('settingsMcLogsCopy'),
      copyBtnMobile: $('settingsMcLogsCopyMobile'),
      filterInput: $('settingsMcLogsFilter'),
      statsEl: $('settingsMcLogsStats'),
      noteEl: $('settingsMcLogsNote'),
      checkBtn: $('settingsMcLogsCheck'),
      checkBtnMobile: $('settingsMcLogsCheckMobile')
    }
  }

  function safe(fn){
    try { fn() } catch(e) { console.debug('[SettingsLogs] safe handler error', e) }
  }

  function setVisible(visible){
    safe(() => { const el = $('settingsMcLogsWrapper'); if(el) el.style.display = visible ? 'block' : 'none' })
  }

  function updateStats() {
    safe(() => {
      const { logsEl, statsEl } = getEls()
      if (!logsEl || !statsEl) return
      
      // Count actual log lines (not including empty state)
      const lines = logsEl.querySelectorAll('.log-line').length
      statsEl.innerHTML = `<i class="bi bi-file-text mr-2 text-gray-400"></i><span>${lines} lines</span>`
    })
  }

  function colorizeLogLine(line) {
    if (!line || line.trim() === '') return ''
    
    // Regex to parse Minecraft log format: [timestamp] [thread/LEVEL]: message
    // Also handles formats like: 2025-11-10T13:59:28.957510200Z main ERROR message
    const minecraftLogRegex = /^(\[[\d:]+\]|\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+(\[?[^\]\/]+\/?([A-Z]+)\]?):?\s*(.+)$/
    const simpleLogRegex = /^\[(\d+:\d+:\d+)\]\s*\[([^\]]+)\]:\s*(.+)$/
    
    let match = line.match(minecraftLogRegex)
    if (!match) {
      match = line.match(simpleLogRegex)
      if (match) {
        const [, timestamp, source, message] = match
        return `<span class="log-line"><span class="log-timestamp">[${timestamp}]</span> <span class="log-source">[${source}]</span>: <span class="log-message">${escapeHtml(message)}</span></span>`
      }
    }
    
    if (match) {
      const timestamp = match[1] || ''
      const threadAndLevel = match[2] || ''
      const level = match[3] || 'INFO'
      const message = match[4] || ''
      
      // Extract thread name (before the /)
      const threadMatch = threadAndLevel.match(/\[?([^\]\/]+)/)
      const thread = threadMatch ? threadMatch[1] : ''
      
      return `<span class="log-line"><span class="log-timestamp">${escapeHtml(timestamp)}</span> <span class="log-thread">[${escapeHtml(thread)}/<span class="log-level-${level}">${level}</span>]</span>: <span class="log-message">${escapeHtml(message)}</span></span>`
    }
    
    // Fallback for non-matching lines
    return `<span class="log-line"><span class="log-message">${escapeHtml(line)}</span></span>`
  }

  function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  function truncateIfNeeded(logsEl){
    if(!logsEl) return
    // Count children instead of textContent length
    const children = logsEl.querySelectorAll('.log-line')
    if(children.length > 5000){ // Keep last 5000 lines
      const toRemove = children.length - 5000
      for(let i = 0; i < toRemove; i++){
        if(children[i]) children[i].remove()
      }
    }
  }

  function appendLine(line){
    safe(() => {
      const { logsEl, filterInput, noteEl } = getEls()
      if (!logsEl) return
      
      // Remove empty state if it exists
      const emptyState = logsEl.querySelector('.log-empty-state')
      if (emptyState) {
        emptyState.remove()
      }
      
      // Show streaming indicator
      if (noteEl && noteEl.querySelector('span')) {
        noteEl.style.display = 'flex'
        noteEl.querySelector('span').textContent = 'Streaming live logs.'
      }
      
      const filter = filterInput && filterInput.value ? filterInput.value : ''
      if (filter) {
        try {
          const re = new RegExp(filter, 'i')
          if (!re.test(line)) return
        } catch (e) {
          // invalid regex - ignore filtering
        }
      }
      
      // Create colorized log line
      const colorizedLine = colorizeLogLine(line)
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = colorizedLine
      logsEl.appendChild(tempDiv.firstChild)
      
      truncateIfNeeded(logsEl)
      logsEl.scrollTop = logsEl.scrollHeight
      updateStats()
    })
  }

  function flushQueue(){
    safe(() => {
      if (!state.queued || state.queued.length === 0) return
      for(const l of state.queued) appendLine(l)
      state.queued = []
    })
  }

  function onLogLine(_, line){
    safe(() => {
      const { logsWrapper, noteEl } = getEls()
      if(!line) return
      if(logsWrapper) logsWrapper.style.display = 'block'
      if(noteEl){ noteEl.style.display = 'block'; noteEl.textContent = 'Streaming live logs.' }
      if (state.paused) {
        state.queued.push(line)
      } else {
        appendLine(line)
      }
    })
  }

  async function requestHistory(){
    safe(async () => {
      if (!ipcRenderer) return
      try {
        const hist = await ipcRenderer.invoke('request-mc-log-history')
        const { logsWrapper, logsEl, noteEl } = getEls()
        let lines = []
        let bufferLen = 0
        if (Array.isArray(hist)) {
          lines = hist
          bufferLen = hist.length
        } else if (hist && Array.isArray(hist.lines)) {
          lines = hist.lines
          bufferLen = typeof hist.bufferLen === 'number' ? hist.bufferLen : hist.lines.length
        } else {
          if(noteEl && noteEl.querySelector('span')){ 
            noteEl.style.display = 'flex'
            noteEl.querySelector('span').textContent = 'No log history available.' 
          }
          if(logsWrapper) logsWrapper.style.display = 'block'
          // Show empty state
          if(logsEl) logsEl.innerHTML = '<div class="log-empty-state"><i class="bi bi-journal-text"></i><p>No logs available yet. Start Minecraft to see logs here.</p></div>'
          return
        }

        if (lines.length === 0) {
          if(logsWrapper) logsWrapper.style.display = 'block'
          if(noteEl && noteEl.querySelector('span')){ 
            noteEl.style.display = 'flex'
            noteEl.querySelector('span').textContent = 'No logs yet. (bufferLen=' + bufferLen + ')' 
          }
          // Show empty state
          if(logsEl) logsEl.innerHTML = '<div class="log-empty-state"><i class="bi bi-journal-text"></i><p>No logs available yet. Start Minecraft to see logs here.</p></div>'
          return
        }

        if (lines.length > 0) {
          if(logsWrapper) logsWrapper.style.display = 'block'
          if(noteEl && noteEl.querySelector('span')){ 
            noteEl.style.display = 'flex'
            noteEl.querySelector('span').textContent = 'Showing ' + lines.length + ' buffered log lines. (bufferLen=' + bufferLen + ')' 
          }
          if (state.paused) {
            state.queued = state.queued.concat(lines)
          } else {
            // Clear and rebuild with colorized lines
            if (logsEl) {
              logsEl.innerHTML = ''
              for(const line of lines) {
                const colorizedLine = colorizeLogLine(line)
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = colorizedLine
                logsEl.appendChild(tempDiv.firstChild)
              }
              truncateIfNeeded(logsEl)
              logsEl.scrollTop = logsEl.scrollHeight
              updateStats()
            }
          }
        }
      } catch (e) {
        console.debug('[SettingsLogs] requestHistory error', e)
      }
    })
  }

  function wireControls(){
    safe(() => {
      const els = getEls()
      
      // Clear button (desktop + mobile)
      const clearHandler = () => { 
        const els = getEls()
        if(els.logsEl) { 
          els.logsEl.innerHTML = '<div class="log-empty-state"><i class="bi bi-journal-text"></i><p>Logs cleared.</p></div>'
          updateStats() 
        } 
      }
      if (els.clearBtn) els.clearBtn.addEventListener('click', clearHandler)
      if (els.clearBtnMobile) els.clearBtnMobile.addEventListener('click', clearHandler)
      
      // Open window button (desktop + mobile)
      const openHandler = () => { try{ ipcRenderer && ipcRenderer.send && ipcRenderer.send('open-mc-logs-window') } catch(e){} }
      if (els.openBtn) els.openBtn.addEventListener('click', openHandler)
      if (els.openBtnMobile) els.openBtnMobile.addEventListener('click', openHandler)
      
      // Pause button (desktop + mobile)
      const pauseHandler = (btn) => {
        state.paused = !state.paused
        const icon = btn.querySelector('i')
        const text = btn.querySelector('span:not(.sr-only)')
        
        if(state.paused) {
          if(icon) icon.className = 'bi bi-play-fill text-current'
          if(text) text.textContent = 'Resume'
          btn.setAttribute('aria-pressed', 'true')
        } else {
          if(icon) icon.className = 'bi bi-pause-fill text-current'
          if(text) text.textContent = 'Pause'
          btn.setAttribute('aria-pressed', 'false')
        }
        
        const noteEl = getEls().noteEl
        if(noteEl && noteEl.querySelector('span')){ 
          noteEl.style.display = 'flex'
          noteEl.querySelector('span').textContent = state.paused ? 'Paused — incoming lines are queued.' : 'Resumed — queued lines appended.' 
        }
        if(!state.paused) flushQueue()
      }
      if (els.pauseBtn) els.pauseBtn.addEventListener('click', () => pauseHandler(els.pauseBtn))
      if (els.pauseBtnMobile) els.pauseBtnMobile.addEventListener('click', () => pauseHandler(els.pauseBtnMobile))

      // Save button (desktop + mobile)
      const saveHandler = async () => {
        try {
          const els = getEls()
          // Extract text content from all log lines
          const lines = els.logsEl ? Array.from(els.logsEl.querySelectorAll('.log-line')).map(el => el.textContent).join('\n') : ''
          
          if (ipcRenderer && ipcRenderer.invoke) {
            const res = await ipcRenderer.invoke('save-mc-log', lines)
            if(els.noteEl && els.noteEl.querySelector('span')){ 
              els.noteEl.style.display = 'flex'
              els.noteEl.querySelector('span').textContent = res && res.path ? ('Saved to ' + res.path) : (res && res.result === true ? 'Saved' : 'Save failed') 
            }
          } else {
            // fallback: download as file in browser context
            downloadAsFile('mc-logs.txt', lines)
            if(els.noteEl && els.noteEl.querySelector('span')){ 
              els.noteEl.style.display = 'flex'
              els.noteEl.querySelector('span').textContent = 'Saved (browser)'
            }
          }
        } catch(e) { console.debug('[SettingsLogs] save error', e) }
      }
      if (els.saveBtn) els.saveBtn.addEventListener('click', saveHandler)
      if (els.saveBtnMobile) els.saveBtnMobile.addEventListener('click', saveHandler)

      // Copy button (desktop + mobile)
      const copyHandler = async () => {
        try {
          const els = getEls()
          // Extract text content from all log lines
          const lines = els.logsEl ? Array.from(els.logsEl.querySelectorAll('.log-line')).map(el => el.textContent).join('\n') : ''
          
          if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(lines)
          else try { document.execCommand('copy') } catch(e){}
          if(els.noteEl && els.noteEl.querySelector('span')){ 
            els.noteEl.style.display = 'flex'
            els.noteEl.querySelector('span').textContent = 'Copied to clipboard.' 
          }
        } catch(e) { console.debug('[SettingsLogs] copy error', e) }
      }
      if (els.copyBtn) els.copyBtn.addEventListener('click', copyHandler)
      if (els.copyBtnMobile) els.copyBtnMobile.addEventListener('click', copyHandler)

      // Filter input
      if (els.filterInput) els.filterInput.addEventListener('input', () => {
        // debounce re-filter
        state.lastFilter = els.filterInput.value
        if (state.filterTimeout) clearTimeout(state.filterTimeout)
        state.filterTimeout = setTimeout(() => {
          // simpler approach: clear view and request history to rebuild filtered view
          const els = getEls()
          if (els.logsEl) els.logsEl.innerHTML = ''
          updateStats()
          try { requestHistory() } catch(e){}
        }, state.filterDebounceMs)
      })

      // Check button (desktop + mobile)
      const checkHandler = async () => {
        try {
          if (!ipcRenderer) return
          const res = await ipcRenderer.invoke('request-mc-log-history')
          const els = getEls()
          if(els.noteEl && els.noteEl.querySelector('span')){ 
            els.noteEl.style.display = 'flex'
            els.noteEl.querySelector('span').textContent = 'Buffer response: ' + (res && res.bufferLen != null ? ('bufferLen=' + res.bufferLen) : (Array.isArray(res) ? 'legacy array len=' + res.length : JSON.stringify(res))) 
          }
        } catch(e) { console.debug('[SettingsLogs] manual check buffer error', e) }
      }
      if (els.checkBtn) els.checkBtn.addEventListener('click', checkHandler)
      if (els.checkBtnMobile) els.checkBtnMobile.addEventListener('click', checkHandler)

      // listen for ack
      if (ipcRenderer && ipcRenderer.on) {
        try { 
          ipcRenderer.on('mc-log-history-ack', (_, info) => { 
            safe(() => { 
              if(getEls().noteEl && getEls().noteEl.querySelector('span')) {
                getEls().noteEl.style.display = 'flex'
                getEls().noteEl.querySelector('span').textContent = 'History ack received (bufferLen=' + (info && typeof info.bufferLen === 'number' ? info.bufferLen : 'unknown') + ')' 
              }
            }) 
          }) 
        } catch(e){}
      }

    })
  }

  function downloadAsFile(filename, content){
    try {
      const blob = new Blob([content || ''], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) { console.debug('[SettingsLogs] downloadAsFile error', e) }
  }

  function init(){
    safe(() => {
      wireControls()

      // Initialize visibility from ConfigManager if available
      try{
        if(window.ConfigManager && typeof ConfigManager.getShowMinecraftLogs === 'function'){
          setVisible(ConfigManager.getShowMinecraftLogs())
        }
      } catch(e){}

      // Listen for setting changes
      window.addEventListener('settings-updated', () => {
        try{ setVisible(ConfigManager.getShowMinecraftLogs && ConfigManager.getShowMinecraftLogs()) } catch(e){}
      })

      // Bind to tab activation event
      window.addEventListener('settings-tab-activated', (ev) => {
        try { if(ev && ev.detail && ev.detail.tabId === 'settingsTabLogs') requestHistory() } catch(e){}
      })

      // Fallback delegated click listener for nav
      document.addEventListener('click', (ev) => {
        try {
          const t = ev.target || ev.srcElement
          const btn = t.closest && t.closest('.settingsNavItem[ rSc="settingsTabLogs" ], .settingsNavItem[rSc="settingsTabLogs"]')
          const alt = t.closest && t.closest('[rSc="settingsTabLogs"]')
          if (btn || alt) { if(getEls().logsWrapper) getEls().logsWrapper.style.display = 'block'; requestHistory() }
        } catch(e){}
      }, { capture: true })

      // Request history immediately (safe no-op)
      try { requestHistory() } catch(e){}

      // Listen for live lines
      if (ipcRenderer && ipcRenderer.on) {
        try { ipcRenderer.on('mc-log-line', onLogLine) } catch(e){}
      }

    })
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()

  // Expose for testing/debug if needed
  window.__SettingsLogs = {
    requestHistory,
    appendLine: (l) => appendLine(l),
    _state: state
  }

})()