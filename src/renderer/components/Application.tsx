import { hot } from 'react-hot-loader/root';
import * as React from 'react';
import Frame from './frame/Frame';
import Welcome from './welcome/Welcome';
import { connect } from 'react-redux';
import { View } from '../meta/Views';
import Landing from './landing/Landing';
import Login from './login/Login';
import Settings from './settings/Settings';

type ApplicationProps = {
    currentView: View
}

class Application extends React.Component<ApplicationProps> {

    render() {
        switch(this.props.currentView) {
            case View.WELCOME:
                return <>
                    <Frame />
                    <Welcome />
                </>
            case View.LANDING:
                return <>
                    <Frame />
                    <Landing />
                </>
            case View.LOGIN:
                return <>
                    <Frame />
                    <Login />
                </>
            case View.SETTINGS:
                return <>
                    <Frame />
                    <Settings />
                </>

        }
        
    }
    
}

const connected = connect((state: any) => ({
    currentView: state.currentView
}), undefined)(Application)

export default hot(connected);