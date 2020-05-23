import { hot } from 'react-hot-loader/root';
import * as React from 'react';
import Frame from './frame/Frame';
import Welcome from './welcome/Welcome';
import { connect } from 'react-redux';
import { View } from '../meta/Views';
import Landing from './landing/Landing';
import Login from './login/Login';
import Settings from './settings/Settings';

import './Application.css'

type ApplicationProps = {
    currentView: View
}

class Application extends React.Component<ApplicationProps> {

    getViewElement(): JSX.Element {
        switch(this.props.currentView) {
            case View.WELCOME:
                return <>
                    <Welcome />
                </>
            case View.LANDING:
                return <>
                    <Landing />
                </>
            case View.LOGIN:
                return <>
                    <Login cancelable={false} />
                </>
            case View.SETTINGS:
                return <>
                    <Settings />
                </>

        }
    }

    render() {
        return (
            <>
                <Frame />
                <div className="appWrapper">
                    {this.getViewElement()}
                </div>
            </>
        )
    }
    
}

const connected = connect((state: any) => ({
    currentView: state.currentView
}), undefined)(Application)

export default hot(connected);