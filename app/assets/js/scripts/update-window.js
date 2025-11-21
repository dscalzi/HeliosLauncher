// Update window UI logic extracted from `app/update.ejs` to comply with CSP
const { ipcRenderer } = require('electron')

const statusEl = document.getElementById('status')
const statusTitle = document.getElementById('statusTitle')
const statusDesc = document.getElementById('statusDesc')
const progressWrap = document.getElementById('progressWrap')
const progressBar = document.getElementById('progressBar')
const percentEl = document.getElementById('percent')
const actionRow = document.getElementById('actionRow')
const installBtn = document.getElementById('installBtn')
const closeBtn = document.getElementById('closeBtn')

function showStatus(visible = true) {
  if (!statusEl) return
  statusEl.style.display = visible ? 'flex' : 'none'
  statusEl.setAttribute('aria-hidden', visible ? 'false' : 'true')
}

function showChecking() {
  if (!statusTitle || !statusDesc) return
  showStatus(true)
  statusTitle.innerText = 'Recherche des mises à jour...'
  statusDesc.innerText = 'Veuillez patienter pendant que le lanceur vérifie la disponibilité d\'une nouvelle version.'
  if (progressWrap) progressWrap.style.display = 'none'
  if (actionRow) actionRow.style.display = 'none'
}

function showNoUpdate() {
  showStatus(true)
  statusTitle.innerText = 'Aucune mise à jour disponible'
  statusDesc.innerText = 'Vous utilisez la dernière version.'
  if (progressWrap) progressWrap.style.display = 'none'
  if (actionRow) actionRow.style.display = 'none'
  setTimeout(() => { try { window.close && window.close() } catch (e) {} }, 900)
}

function showUpdateAvailable(info) {
  const ver = (info && info.version) ? info.version : ''
  showStatus(true)
  statusTitle.innerText = 'Mise à jour disponible' + (ver ? (': ' + ver) : '')
  statusDesc.innerText = 'Téléchargement en cours...'
  if (progressWrap) progressWrap.style.display = 'block'
  if (actionRow) actionRow.style.display = 'none'
}

function showProgress(progress) {
  const p = progress && (progress.percent || progress.percent === 0) ? Math.round(progress.percent) : null
  if (p !== null) {
    if (progressBar) progressBar.style.width = Math.min(100, Math.max(0, p)) + '%'
    if (percentEl) percentEl.innerText = p + '%'
  } else {
    if (progressBar) progressBar.style.width = '0%'
    if (percentEl) percentEl.innerText = '...'
  }
}

function showDownloaded() {
  if (statusTitle) statusTitle.innerText = 'Téléchargement terminé'
  if (statusDesc) statusDesc.innerText = 'La mise à jour est prête à être installée.'
  if (progressWrap) progressWrap.style.display = 'none'
  if (actionRow) actionRow.style.display = 'flex'
}

function showError(err) {
  if (statusTitle) statusTitle.innerText = 'Erreur lors de la mise à jour'
  if (statusDesc) statusDesc.innerText = err && err.message ? err.message : String(err || 'Erreur inconnue')
  if (progressWrap) progressWrap.style.display = 'none'
  if (actionRow) actionRow.style.display = 'flex'
  setTimeout(() => { try { window.close && window.close() } catch (e) {} }, 3000)
}

ipcRenderer.on('autoUpdateNotification', (ev, type, payload) => {
  try {
    switch(type) {
      case 'checking-for-update':
        showChecking(); break;
      case 'update-available':
        showUpdateAvailable(payload); break;
      case 'download-progress':
        showProgress(payload); break;
      case 'update-downloaded':
        showDownloaded(); break;
      case 'update-not-available':
        showNoUpdate(); break;
      case 'realerror':
        showError(payload); break;
      default: break;
    }
  } catch (e) {
    // ignore UI errors
  }
})

if (installBtn) installBtn.addEventListener('click', () => {
  try { ipcRenderer.send('autoUpdateAction', 'installUpdateNow') } catch (e) {}
  setTimeout(() => { try { window.close() } catch (e) {} }, 200)
})

if (closeBtn) closeBtn.addEventListener('click', () => {
  try { window.close() } catch (e) {}
  try { ipcRenderer.send('closeUpdateWindow') } catch (e) {}
})

// Allow Escape key to dismiss
document.addEventListener('keydown', (ev) => {
  try {
    if (ev.key === 'Escape') {
      try { window.close() } catch (e) {}
      try { ipcRenderer.send('closeUpdateWindow') } catch (e) {}
    }
  } catch (e) {
    // ignore
  }
})

// initial minimal status
showStatus(false)