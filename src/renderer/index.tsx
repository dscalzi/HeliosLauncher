import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import store from './redux/store'
import './index.css';

import Application from './components/Application';
import { Provider } from 'react-redux';

// Create main element
const mainElement = document.createElement('div');
document.body.appendChild(mainElement);

// Render components
ReactDOM.render(
    <AppContainer>
        <Provider store={store}>
            <Application currentView={store.getState().currentView} />
        </Provider>
    </AppContainer>,
    mainElement
);

// setTimeout(() => {
//     console.log('firing')
//     store.dispatch(setCurrentView(View.LOGIN))
// }, 2500)