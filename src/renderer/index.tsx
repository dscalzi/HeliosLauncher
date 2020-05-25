import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { AppContainer } from 'react-hot-loader'
import store from './redux/store'
import './index.css'

import Application from './components/Application'
import { Provider } from 'react-redux'
import { readdirSync } from 'fs-extra'
import { join } from 'path'

declare const __static: string

function setBackground(id: number) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bk = require('../../static/images/backgrounds/' + id + '.jpg')
    document.body.style.backgroundImage = `url('${bk.default}')`
}

const id = Math.floor((Math.random() * readdirSync(join(__static, 'images', 'backgrounds')).length))
setBackground(id)

// Create main element
const mainElement = document.createElement('div')
document.body.appendChild(mainElement)

// Render components
ReactDOM.render(
    <AppContainer>
        <Provider store={store}>
            <Application currentView={store.getState().currentView} />
        </Provider>
    </AppContainer>,
    mainElement
)

// setTimeout(() => {
//     console.log('firing')
//     store.dispatch(setCurrentView(View.LOGIN))
// }, 2500)