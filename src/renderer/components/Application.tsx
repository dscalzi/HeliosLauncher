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
import Overlay from './overlay/Overlay'
import Fatal from './fatal/Fatal'
import { StoreType } from '../redux/store'
import { CSSTransition } from 'react-transition-group'
import { ViewActionDispatch } from '../redux/actions/viewActions'
import { throttle } from 'lodash'
import { readdir } from 'fs-extra'
import { join } from 'path'
import { AppActionDispatch } from '../redux/actions/appActions'
import { OverlayPushAction, OverlayActionDispatch } from '../redux/actions/overlayActions'

import { LoggerUtil } from 'common/logging/loggerutil'
import { DistributionAPI } from 'common/distribution/DistributionAPI'
import { getServerStatus, ServerStatus } from 'common/mojang/net/ServerStatusAPI'
import { Distribution } from 'helios-distribution-types'
import { HeliosDistribution, HeliosServer } from 'common/distribution/DistributionFactory'
import { MojangResponse } from 'common/mojang/rest/internal/MojangResponse'
import { MojangStatus, MojangStatusColor } from 'common/mojang/rest/internal/MojangStatus'
import { MojangRestAPI } from 'common/mojang/rest/MojangRestAPI'
import { RestResponseStatus } from 'common/got/RestResponse'

import './Application.css'

declare const __static: string

function setBackground(id: number) {
    import(`../../../static/images/backgrounds/${id}.jpg`).then(mdl => {
        document.body.style.backgroundImage = `url('${mdl.default}')`
    })
}

interface ApplicationProps {
    currentView: View
    overlayQueue: OverlayPushAction<unknown>[]
    distribution: HeliosDistribution
    selectedServer?: HeliosServer
    selectedServerStatus?: ServerStatus
    mojangStatuses: MojangStatus[]
}

interface ApplicationState {
    loading: boolean
    showMain: boolean
    renderMain: boolean
    workingView: View
}

const mapState = (state: StoreType): Partial<ApplicationProps> => {
    return {
        currentView: state.currentView,
        overlayQueue: state.overlayQueue,
        distribution: state.app.distribution,
        selectedServer: state.app.selectedServer,
        mojangStatuses: state.app.mojangStatuses
    }
}
const mapDispatch = {
    ...AppActionDispatch,
    ...ViewActionDispatch,
    ...OverlayActionDispatch
}

type InternalApplicationProps = ApplicationProps & typeof mapDispatch

class Application extends React.Component<InternalApplicationProps, ApplicationState> {

    private static readonly logger = LoggerUtil.getLogger('Application')

    private mojangStatusInterval!: NodeJS.Timeout
    private serverStatusInterval!: NodeJS.Timeout

    private bkid!: number

    constructor(props: InternalApplicationProps) {
        super(props)
        this.state = {
            loading: true,
            showMain: false,
            renderMain: false,
            workingView: props.currentView
        }
    }

    async componentDidMount(): Promise<void> {

        this.mojangStatusInterval = setInterval(async () => {
            Application.logger.info('Refreshing Mojang Statuses..')
            await this.loadMojangStatuses()
        }, 300000)

        this.serverStatusInterval = setInterval(async () => {
            Application.logger.info('Refreshing selected server status..')
            await this.syncServerStatus()
        }, 300000)

    }

    componentWillUnmount(): void {

        // Clean up intervals.
        clearInterval(this.mojangStatusInterval)
        clearInterval(this.serverStatusInterval)

    }

    async componentDidUpdate(prevProps: InternalApplicationProps): Promise<void> {

        if(this.props.selectedServer?.rawServer.id !== prevProps.selectedServer?.rawServer.id) {
            await this.syncServerStatus()
        }

    }

    /**
     * Load the mojang statuses and add them to the global store.
     */
    private loadMojangStatuses = async (): Promise<void> => {
        const response: MojangResponse<MojangStatus[]> = await MojangRestAPI.status()

        if(response.responseStatus !== RestResponseStatus.SUCCESS) {
            Application.logger.warn('Failed to retrieve Mojang Statuses.')
        }

        // TODO Temp workaround because their status checker always shows
        // this as red. https://bugs.mojang.com/browse/WEB-2303
        const statuses = response.data
        for(const status of statuses) {
            if(status.service === 'sessionserver.mojang.com' || status.service === 'minecraft.net') {
                status.status = MojangStatusColor.GREEN
            }
        }

        this.props.setMojangStatuses(response.data)
    }

    /**
     * Fetch the status of the selected server and store it in the global store.
     */
    private syncServerStatus = async (): Promise<void> => {
        let serverStatus: ServerStatus | undefined

        if(this.props.selectedServer != null) {
            const { hostname, port } = this.props.selectedServer
            try {
                serverStatus = await getServerStatus(
                    47,
                    hostname,
                    port
                )
            } catch(err) {
                Application.logger.error('Error while refreshing server status', err)
            }
            
        } else {
            serverStatus = undefined
        }

        this.props.setSelectedServerStatus(serverStatus)
    }

    private getViewElement = (): JSX.Element => {
        // TODO debug remove
        console.log('loading', this.props.currentView, this.state.workingView)
        switch(this.state.workingView) {
            case View.WELCOME:
                return <>
                    <Welcome />
                </>
            case View.LANDING:
                return <>
                    <Landing
                        distribution={this.props.distribution}
                        selectedServer={this.props.selectedServer}
                        selectedServerStatus={this.props.selectedServerStatus}
                        mojangStatuses={this.props.mojangStatuses}
                    />
                </>
            case View.LOGIN:
                return <>
                    <Login cancelable={false} />
                </>
            case View.SETTINGS:
                return <>
                    <Settings />
                </>
            case View.FATAL:
                return <>
                    <Fatal />
                </>
            case View.NONE:
                return <></>

        }
    }

    private hasOverlay = (): boolean => {
        return this.props.overlayQueue.length > 0
    }

    private updateWorkingView = throttle(() => {
        // TODO debug remove
        console.log('Setting to', this.props.currentView)
        this.setState({
            ...this.state,
            workingView: this.props.currentView
        })
        
    }, 200)

    private finishLoad = (): void => {
        if(this.props.currentView !== View.FATAL) {
            setBackground(this.bkid)
        }
        this.showMain()
    }

    private showMain = (): void => {
        this.setState({
            ...this.state,
            showMain: true
        })
    }

    private initLoad = async (): Promise<void> => {
        if(this.state.loading) {
            const MIN_LOAD = 800
            const start = Date.now()

            // Initial distribution load.
            const distroAPI = new DistributionAPI('C:\\Users\\user\\AppData\\Roaming\\Helios Launcher')
            let rawDisto: Distribution
            try {
                rawDisto = await distroAPI.testLoad()
                console.log('distro', distroAPI)
            } catch(err) {
                console.log('EXCEPTION IN DISTRO LOAD TODO TODO TODO', err)
                rawDisto = null!
            }

            // Fatal error
            if(rawDisto == null) {
                this.props.setView(View.FATAL)
                this.setState({
                    ...this.state,
                    loading: false,
                    workingView: View.FATAL
                })
                return
            } else {

                // For debugging display.
                // for(let i=0; i<10; i++) {
                //     rawDisto.servers.push(rawDisto.servers[1])
                // }


                const distro = new HeliosDistribution(rawDisto)
                // TODO TEMP USE CONFIG
                // TODO TODO TODO TODO
                const selectedServer: HeliosServer = distro.servers[0]
                const { hostname, port } = selectedServer
                let selectedServerStatus
                try {
                    selectedServerStatus = await getServerStatus(47, hostname, port)
                } catch(err) {
                    Application.logger.error('Failed to refresh server status', selectedServerStatus)
                }
                this.props.setDistribution(distro)
                this.props.setSelectedServer(selectedServer)
                this.props.setSelectedServerStatus(selectedServerStatus)
            }

            // Load initial mojang statuses.
            Application.logger.info('Loading mojang statuses..')
            await this.loadMojangStatuses()

            // TODO Setup hook for distro refresh every ~ 5 mins.

            // Pick a background id.
            this.bkid = Math.floor((Math.random() * (await readdir(join(__static, 'images', 'backgrounds'))).length))

            const endLoad = () => {
                // TODO determine correct view
                // either welcome, landing, or login
                this.props.setView(View.LANDING)
                this.setState({
                    ...this.state,
                    loading: false,
                    workingView: View.LANDING
                })
                // TODO temp
                setTimeout(() => {
                    // this.props.setView(View.WELCOME)
                    // this.props.pushGenericOverlay({
                    //     title: 'Load Distribution',
                    //     description: 'This is a test.',
                    //     dismissible: false,
                    //     acknowledgeCallback: async () => {
                    //         const serverStatus = await getServerStatus(47, 'play.hypixel.net', 25565)
                    //         console.log(serverStatus)
                    //     }
                    // })
                    this.props.pushGenericOverlay({
                        title: 'Test Title 2',
                        description: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
                        dismissible: true
                    })
                    // this.props.pushGenericOverlay({
                    //     title: 'Test Title IMPORTANT',
                    //     description: 'Test Description',
                    //     dismissible: true
                    // }, true)
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
                    <div className="appWrapper" {...(this.hasOverlay() ? {overlay: 'true'} : {})}>
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
                    in={this.hasOverlay()}
                    appear={true}
                    timeout={500}
                    classNames="appWrapper"
                    unmountOnExit
                >
                    <Overlay overlayQueue={this.props.overlayQueue} />
                </CSSTransition>
                <CSSTransition
                    in={this.state.loading}
                    appear={true}
                    timeout={300}
                    classNames="loader"
                    unmountOnExit
                    onEnter={this.initLoad}
                    onExited={this.finishLoad}
                >
                    <Loader />
                </CSSTransition>
            </>
        )
    }
    
}

export default hot(connect<unknown, typeof mapDispatch>(mapState, mapDispatch)(Application))