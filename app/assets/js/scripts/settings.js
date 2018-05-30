let selectedTab = 'settingsTabAccount'

function setupSettingsTabs(){
    Array.from(document.getElementsByClassName('settingsNavItem')).map((val) => {
        val.onclick = (e) => {
            if(val.hasAttribute('selected')){
                return
            }
            const navItems = document.getElementsByClassName('settingsNavItem')
            for(let i=0; i<navItems.length; i++){
                if(navItems[i].hasAttribute('selected')){
                    navItems[i].removeAttribute('selected')
                }
            }
            val.setAttribute('selected', '')
            let prevTab = selectedTab
            selectedTab = val.getAttribute('rSc')
            $(`#${prevTab}`).fadeOut(250, () => {
                $(`#${selectedTab}`).fadeIn(250)
            })
        }
    })
}

setupSettingsTabs()