import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { AppContainer } from 'react-hot-loader'
import { Provider } from 'react-redux'
// import { shell } from 'electron'
import store from './redux/store'

import Application from './components/Application'

import './index.css'


// document.addEventListener('click', (event: MouseEvent) => {
//     if ((event.target as HTMLElement)?.tagName === 'A' && (event.target as HTMLAnchorElement)?.href.startsWith('http')) {
//         event.preventDefault()
//         shell.openExternal((event.target as HTMLAnchorElement).href)
//     }
// })

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
            />
        </Provider>
    </AppContainer>,
    mainElement
)

// setTimeout(() => {
//     console.log('firing')
//     store.dispatch(setCurrentView(View.LOGIN))
// }, 2500)