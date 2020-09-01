import * as React from 'react'
import { connect } from 'react-redux'

import { HeliosServer } from 'common/distribution/DistributionFactory'
import { LoggerUtil } from 'common/logging/loggerutil'
import { OverlayActionDispatch } from '../../../redux/actions/overlayActions'

import '../shared-select/SharedSelect.css'

export interface ServerSelectOverlayProps {
    servers: HeliosServer[]
    selectedId: string
    onSelection: (serverId: string) => void
}

interface ServerSelectOverlayState {
    selectedId: string
}

const mapDispatch = {
    ...OverlayActionDispatch
}

type InternalServerSelectOverlayProps = ServerSelectOverlayProps & typeof mapDispatch

class ServerSelectOverlay extends React.Component<InternalServerSelectOverlayProps, ServerSelectOverlayState> {

    private readonly logger = LoggerUtil.getLogger('ServerSelectOverlay')

    constructor(props: InternalServerSelectOverlayProps) {
        super(props)
        this.state = {
            selectedId: props.selectedId
        }
    }

    private onSelectClick = async (): Promise<void> => {
        try {
            this.props.onSelection(this.state.selectedId)
        } catch(err) {
            this.logger.error('Uncaught error in server select confirmation.', err)
        }
        this.props.popOverlayContent()
    }

    private onCancelClick = async (): Promise<void> => {
        this.props.popOverlayContent()
    }

    getMainServerStar(): JSX.Element {
        return (
            <div className="serverListingStarWrapper">
                <svg id="mainServerSVG" viewBox="0 0 107.45 104.74" width="20px" height="20px">
                    <path fill="#fff" d="M100.93,65.54C89,62,68.18,55.65,63.54,52.13c2.7-5.23,18.8-19.2,28-27.55C81.36,31.74,63.74,43.87,58.09,45.3c-2.41-5.37-3.61-26.52-4.37-39-.77,12.46-2,33.64-4.36,39-5.7-1.46-23.3-13.57-33.49-20.72,9.26,8.37,25.39,22.36,28,27.55C39.21,55.68,18.47,62,6.52,65.55c12.32-2,33.63-6.06,39.34-4.9-.16,5.87-8.41,26.16-13.11,37.69,6.1-10.89,16.52-30.16,21-33.9,4.5,3.79,14.93,23.09,21,34C70,86.84,61.73,66.48,61.59,60.65,67.36,59.49,88.64,63.52,100.93,65.54Z"/>
                    <circle fill="none" stroke="#fff" strokeMiterlimit="10" cx="53.73" cy="53.9" r="38"/>
                </svg>
                <span className="serverListingStarTooltip">Main Server</span>
            </div>
        )
    }

    getServers(): JSX.Element[] {
        const servers: JSX.Element[] = []

        for(const { rawServer: raw } of this.props.servers) {
            servers.push(
                <button onClick={() => this.setState({...this.state, selectedId: raw.id})} className="serverListing" {...(raw.id === this.state.selectedId ? {selectedserver: 'true'} : {})} {...{key: raw.id}}>
                    <img className="serverListingImg" src={raw.icon}/>
                    <div className="serverListingDetails">
                        <span className="serverListingName">{raw.name}</span>
                        <span className="serverListingDescription">{raw.description}</span>
                        <div className="serverListingInfo">
                            <div className="serverListingVersion">{raw.minecraftVersion}</div>
                            <div className="serverListingRevision">{raw.version}</div>
                            {raw.mainServer ? this.getMainServerStar() : ''}
                        </div>
                    </div>
                </button>
            )
        }

        return servers
    }

    render(): JSX.Element {
        return (
            <>
                <div id="serverSelectContent">
                    <span id="serverSelectHeader">Available Servers</span>
                    <div id="serverSelectList">
                        <div id="serverSelectListScrollable">
                            {this.getServers()}
                        </div>
                    </div>
                    <div id="serverSelectActions">
                        <button onClick={this.onSelectClick} id="serverSelectConfirm" className="overlayKeybindEnter" type="submit">Select</button>
                        <div id="serverSelectCancelWrapper">
                            <button onClick={this.onCancelClick} id="serverSelectCancel" className="overlayKeybindEsc">Cancel</button>
                        </div>
                    </div>
                </div>
            </>
        )
    }

}

export default connect<unknown, typeof mapDispatch>(undefined, mapDispatch)(ServerSelectOverlay)