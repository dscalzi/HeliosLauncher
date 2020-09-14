import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { AppContainer } from 'react-hot-loader'
import { Provider } from 'react-redux'
import { shell } from 'electron'
import store from './redux/store'

import Application from './components/Application'

import './index.css'

// Open anchor hrefs in the default browser.
document.addEventListener('click', (event: MouseEvent) => {
    const anchor: HTMLAnchorElement | null = (event.target as HTMLElement).closest('a')
    if(anchor != null && anchor.hasAttribute('href') && anchor.getAttribute('href')!.toLowerCase().startsWith('http')) {
        event.preventDefault()
        shell.openExternal(anchor.href)
    }
})

// Create main element
const mainElement = document.createElement('div')
document.body.appendChild(mainElement)

// Render components
ReactDOM.render(
    <AppContainer>
        <Provider store={store}>
            <Application
                currentView={store.getState().currentView}
                overlayQueue={store.getState().overlayQueue}
                distribution={store.getState().app.distribution!}
                selectedServer={store.getState().app.selectedServer!}
                selectedServerStatus={store.getState().app.selectedServerStatus!}
                mojangStatuses={store.getState().app.mojangStatuses!}
            />
        </Provider>
    </AppContainer>,
    mainElement
)

// setTimeout(() => {
//     console.log('firing')
//     store.dispatch(setCurrentView(View.LOGIN))
// }, 2500)