import { hot } from 'react-hot-loader/root'
import * as React from 'react'
import Frame from './frame/Frame'
import Welcome from './welcome/Welcome'
import { connect } from 'react-redux'
import { View } from '../meta/Views'
import Landing from './landing/Landing'
import Login from './login/Login'
import Loader from './loader/Loader'
import Settings from './settings/Settings'

import './Application.css'
import { StoreType } from '../redux/store'
import { CSSTransition } from 'react-transition-group'
import { setCurrentView } from '../redux/actions/viewActions'
import { throttle } from 'lodash'
import { readdir } from 'fs-extra'
import { join } from 'path'

declare const __static: string

function setBackground(id: number) {
    import(`../../../static/images/backgrounds/${id}.jpg`).then(mdl => {
        document.body.style.backgroundImage = `url('${mdl.default}')`
    })
}

interface ApplicationProps {
    currentView: View
}

interface ApplicationState {
    loading: boolean
    showMain: boolean
    renderMain: boolean
    workingView: View
}

const mapState = (state: StoreType) => {
    return {
        currentView: state.currentView
    }
}
const mapDispatch = {
    setView: (x: View) => setCurrentView(x)
}

class Application extends React.Component<ApplicationProps & typeof mapDispatch, ApplicationState> {

    private bkid!: number

    constructor(props: ApplicationProps & typeof mapDispatch) {
        super(props)
        this.state = {
            loading: true,
            showMain: false,
            renderMain: false,
            workingView: props.currentView
        }
    }

    getViewElement(): JSX.Element {
        switch(this.state.workingView) {
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

    private updateWorkingView = throttle(() => {
        this.setState({
            ...this.state,
            workingView: this.props.currentView
        })
        
    }, 200)

    private showMain = (): void => {
        setBackground(this.bkid)
        this.setState({
            ...this.state,
            showMain: true
        })
    }

    private initLoad = async (): Promise<void> => {
        if(this.state.loading) {
            const MIN_LOAD = 800
            const start = Date.now()
            this.bkid = Math.floor((Math.random() * (await readdir(join(__static, 'images', 'backgrounds'))).length))
            const endLoad = () => {
                this.setState({
                    ...this.state,
                    loading: false
                })
                // TODO temp
                setTimeout(() => {
                    this.props.setView(View.WELCOME)
                }, 5000)
            }
            const diff = Date.now() - start
            if(diff < MIN_LOAD) {
                setTimeout(endLoad, MIN_LOAD-diff)
            } else {
                endLoad()
            }
        }
    }

    render(): JSX.Element {
        return (
            <>
                <Frame />
                <CSSTransition
                    in={this.state.showMain}
                    appear={true}
                    timeout={500}
                    classNames="appWrapper"
                    unmountOnExit
                >
                    <div className="appWrapper">
                        <CSSTransition
                            in={this.props.currentView == this.state.workingView}
                            appear={true}
                            timeout={500}
                            classNames="appWrapper"
                            unmountOnExit
                            onExited={this.updateWorkingView}
                        >
                            {this.getViewElement()}
                        </CSSTransition>
                        
                    </div>
                </CSSTransition>
                <CSSTransition
                    in={this.state.loading}
                    appear={true}
                    timeout={300}
                    classNames="loader"
                    unmountOnExit
                    onEnter={this.initLoad}
                    onExited={this.showMain}
                >
                    <Loader />
                </CSSTransition>
            </>
        )
    }
    
}

export default hot(connect<unknown, typeof mapDispatch>(mapState, mapDispatch)(Application))