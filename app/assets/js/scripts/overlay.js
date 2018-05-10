/**
 * Script for overlay.ejs
 */

/* Overlay Wrapper Functions */

/**
 * Toggle the visibility of the overlay.
 * 
 * @param {boolean} toggleState True to display, false to hide.
 * @param {boolean} dismissable Optional. True to show the dismiss option, otherwise false.
 * @param {string} content Optional. The content div to be shown.
 */
function toggleOverlay(toggleState, dismissable = false, content = 'overlayContent'){
    if(toggleState == null){
        toggleState = !document.getElementById('main').hasAttribute('overlay')
    }
    if(typeof dismissable === 'string'){
        content = dismissable
        dismissable = false
    }
    if(toggleState){
        document.getElementById('main').setAttribute('overlay', true)
        // Make things untabbable.
        $("#main *").attr('tabindex', '-1')
        $('#' + content).parent().children().hide()
        $('#' + content).show()
        if(dismissable){
            $('#overlayDismiss').show()
        } else {
            $('#overlayDismiss').hide()
        }
        $('#overlayContainer').fadeIn(250)
    } else {
        document.getElementById('main').removeAttribute('overlay')
        // Make things tabbable.
        $("#main *").removeAttr('tabindex')
        $('#overlayContainer').fadeOut(250, () => {
            $('#' + content).parent().children().hide()
            $('#' + content).show()
            if(dismissable){
                $('#overlayDismiss').show()
            } else {
                $('#overlayDismiss').hide()
            }
        })
    }
}

function toggleServerSelection(toggleState){
    prepareServerSelectionList()
    toggleOverlay(toggleState, 'serverSelectContent')
}

/**
 * Set the content of the overlay.
 * 
 * @param {string} title Overlay title text.
 * @param {string} description Overlay description text.
 * @param {string} acknowledge Acknowledge button text.
 * @param {string} dismiss Dismiss button text.
 */
function setOverlayContent(title, description, acknowledge, dismiss = 'Dismiss'){
    document.getElementById('overlayTitle').innerHTML = title
    document.getElementById('overlayDesc').innerHTML = description
    document.getElementById('overlayAcknowledge').innerHTML = acknowledge
    document.getElementById('overlayDismiss').innerHTML = dismiss
}

/**
 * Set the onclick handler of the overlay acknowledge button.
 * If the handler is null, a default handler will be added.
 * 
 * @param {function} handler 
 */
function setOverlayHandler(handler){
    if(handler == null){
        document.getElementById('overlayAcknowledge').onclick = () => {
            toggleOverlay(false)
        }
    } else {
        document.getElementById('overlayAcknowledge').onclick = handler
    }
}

/**
 * Set the onclick handler of the overlay dismiss button.
 * If the handler is null, a default handler will be added.
 * 
 * @param {function} handler 
 */
function setDismissHandler(handler){
    if(handler == null){
        document.getElementById('overlayDismiss').onclick = () => {
            toggleOverlay(false)
        }
    } else {
        document.getElementById('overlayDismiss').onclick = handler
    }
}

/* Server Select View */

document.addEventListener('keydown', (e) => {
    if(document.getElementById('serverSelectContent').style.display !== 'none'){
        console.debug('ServSelLi Keydown Called:', document.getElementById('serverSelectContent').style.display)
        if(e.key === 'Escape'){
            document.getElementById('serverSelectCancel').click()
        } else if(e.key === 'Enter'){
            document.getElementById('serverSelectConfirm').click()
        }
    } else if(document.getElementById('accountSelectContent').style.display !== 'none'){
        console.debug('ServSelLi Keydown Called:', document.getElementById('accountSelectContent').style.display)
        if(e.key === 'Escape'){
            document.getElementById('accountSelectCancel').click()
        } else if(e.key === 'Enter'){
            document.getElementById('accountSelectConfirm').click()
        }
    }
})

document.getElementById('serverSelectConfirm').addEventListener('click', () => {
    const listings = document.getElementsByClassName('serverListing')
    for(let i=0; i<listings.length; i++){
        if(listings[i].hasAttribute('selected')){
            const serv = AssetGuard.getServerById(listings[i].getAttribute('servid'))
            ConfigManager.setSelectedServer(serv != null ? serv.id : null)
            ConfigManager.save()
            updateSelectedServer(serv != null ? serv.name : null)
            setLaunchEnabled(serv != null)
            refreshServerStatus(true)
            toggleOverlay(false)
            return
        }
    }
    // None are selected? Not possible right? Meh, handle it.
    if(listings.length > 0){
        ConfigManager.setSelectedServer(listings[0].getAttribute('servid'))
        ConfigManager.save()
        updateSelectedServer()
        toggleOverlay(false)
    }
})

document.getElementById('accountSelectConfirm').addEventListener('click', () => {
    const listings = document.getElementsByClassName('accountListing')
    for(let i=0; i<listings.length; i++){
        if(listings[i].hasAttribute('selected')){
            const authAcc = ConfigManager.setSelectedAccount(listings[i].getAttribute('uuid'))
            ConfigManager.save()
            updateSelectedAccount(authAcc)
            toggleOverlay(false)
            validateSelectedAccount()
            return
        }
    }
    // None are selected? Not possible right? Meh, handle it.
    if(listings.length > 0){
        const authAcc = ConfigManager.setSelectedAccount(listings[0].getAttribute('uuid'))
        ConfigManager.save()
        updateSelectedAccount(authAcc)
        toggleOverlay(false)
        validateSelectedAccount()
    }
})

// Bind server select cancel button.
document.getElementById('serverSelectCancel').addEventListener('click', () => {
    toggleOverlay(false)
})

document.getElementById('accountSelectCancel').addEventListener('click', () => {
    $('#accountSelectContent').fadeOut(250, () => {
        $('#overlayContent').fadeIn(250)
    })
})

function setServerListingHandlers(){
    const listings = Array.from(document.getElementsByClassName('serverListing'))
    listings.map((val) => {
        val.onclick = e => {
            if(val.hasAttribute('selected')){
                return
            }
            const cListings = document.getElementsByClassName('serverListing')
            for(let i=0; i<cListings.length; i++){
                if(cListings[i].hasAttribute('selected')){
                    cListings[i].removeAttribute('selected')
                }
            }
            val.setAttribute('selected', '')
            document.activeElement.blur()
        }
    })
}

function setAccountListingHandlers(){
    const listings = Array.from(document.getElementsByClassName('accountListing'))
    listings.map((val) => {
        val.onclick = e => {
            if(val.hasAttribute('selected')){
                return
            }
            const cListings = document.getElementsByClassName('accountListing')
            for(let i=0; i<cListings.length; i++){
                if(cListings[i].hasAttribute('selected')){
                    cListings[i].removeAttribute('selected')
                }
            }
            val.setAttribute('selected', '')
            document.activeElement.blur()
        }
    })
}

function populateServerListings(){
    const distro = AssetGuard.getDistributionData()
    const giaSel = ConfigManager.getSelectedServer()
    const servers = distro.servers
    let htmlString = ``
    for(let i=0; i<servers.length; i++){
        htmlString += `<button class="serverListing" servid="${servers[i].id}" ${servers[i].id === giaSel ? `selected` : ``}>
            <img class="serverListingImg" src="${servers[i].icon_url}"/>
            <div class="serverListingDetails">
                <span class="serverListingName">${servers[i].name}</span>
                <span class="serverListingDescription">${servers[i].description}</span>
                <div class="serverListingInfo">
                    <div class="serverListingVersion">${servers[i].mc_version}</div>
                    <div class="serverListingRevision">${servers[i].revision}</div>
                    ${servers[i].default_selected ? `<div class="serverListingStarWrapper">
                        <svg id="Layer_1" viewBox="0 0 107.45 104.74" width="20px" height="20px">
                            <defs>
                                <style>.cls-1{fill:#fff;}.cls-2{fill:none;stroke:#fff;stroke-miterlimit:10;}</style>
                            </defs>
                            <path class="cls-1" d="M100.93,65.54C89,62,68.18,55.65,63.54,52.13c2.7-5.23,18.8-19.2,28-27.55C81.36,31.74,63.74,43.87,58.09,45.3c-2.41-5.37-3.61-26.52-4.37-39-.77,12.46-2,33.64-4.36,39-5.7-1.46-23.3-13.57-33.49-20.72,9.26,8.37,25.39,22.36,28,27.55C39.21,55.68,18.47,62,6.52,65.55c12.32-2,33.63-6.06,39.34-4.9-.16,5.87-8.41,26.16-13.11,37.69,6.1-10.89,16.52-30.16,21-33.9,4.5,3.79,14.93,23.09,21,34C70,86.84,61.73,66.48,61.59,60.65,67.36,59.49,88.64,63.52,100.93,65.54Z"/>
                            <circle class="cls-2" cx="53.73" cy="53.9" r="38"/>
                        </svg>
                        <span class="serverListingStarTooltip">Main Server</span>
                    </div>` : ``}
                </div>
            </div>
        </button>`
    }
    document.getElementById('serverSelectListScrollable').innerHTML = htmlString

}

function populateAccountListings(){
    const accountsObj = ConfigManager.getAuthAccounts()
    const accounts = Array.from(Object.keys(accountsObj), v=>accountsObj[v]);
    const selectedUUID = ConfigManager.getSelectedAccount().uuid
    let htmlString = ``
    for(let i=0; i<accounts.length; i++){
        if(accounts[i].uuid === selectedUUID) {
            continue
        }
        htmlString += `<button class="accountListing" uuid="${accounts[i].uuid}" ${i===0 ? 'selected' : ''}>
            <img src="https://crafatar.com/renders/head/${accounts[i].uuid}?scale=2&default=MHF_Steve&overlay">
            <div class="accountListingName">${accounts[i].displayName}</div>
        </button>`
    }
    document.getElementById('accountSelectListScrollable').innerHTML = htmlString

}

function prepareServerSelectionList(){
    populateServerListings()
    setServerListingHandlers()
}

function prepareAccountSelectionList(){
    populateAccountListings()
    setAccountListingHandlers()
}