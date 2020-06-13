import * as React from 'react'
import GenericOverlay from './generic-overlay/GenericOverlay'
import ServerSelectOverlay from './server-select/ServerSelectOverlay'
import AccountSelectOverlay from './account-select/AccountSelectOverlay'
import { OverlayContent, PushGenericOverlayAction, PushServerSelectOverlayAction } from '../../redux/actions/overlayActions'
import { StoreType } from '../../redux/store'
import { OverlayPushAction } from '../../redux/actions/overlayActions'
import { connect } from 'react-redux'

import './Overlay.css'

interface OverlayProps {
    overlayQueue: OverlayPushAction<unknown>[]
}

const mapState = (state: StoreType): Partial<OverlayProps> => {
    return {
        overlayQueue: state.overlayQueue
    }
}

class Overlay extends React.Component<OverlayProps> {

    private getGenericOverlay(action: PushGenericOverlayAction): JSX.Element {
        return (
            <>
                <GenericOverlay
                    title={action.payload.title}
                    description={action.payload.description}
                    dismissible={action.payload.dismissible}
                    acknowledgeText={action.payload.acknowledgeText}
                    dismissText={action.payload.dismissText}
                    acknowledgeCallback={action.payload.acknowledgeCallback}
                    dismissCallback={action.payload.dismissCallback}
                />
            </>
        )
    }

    private getServerSelectOverlay(action: PushServerSelectOverlayAction): JSX.Element {
        return (
            <>
                <ServerSelectOverlay
                    servers={action.payload.servers}
                />
            </>
        )
    }

    private getOverlayContent(): JSX.Element {
        if(!this.props.overlayQueue || this.props.overlayQueue.length < 1) {
            return (<></>)
        }
        const currentContent = this.props.overlayQueue[0]
        switch(currentContent.overlayContent) {
            case OverlayContent.GENERIC:
                return this.getGenericOverlay(currentContent as PushGenericOverlayAction)
            case OverlayContent.SERVER_SELECT:
                return this.getServerSelectOverlay(currentContent as PushServerSelectOverlayAction)
            case OverlayContent.ACCOUNT_SELECT:
                return (
                    <>
                        <AccountSelectOverlay />
                    </>
                )
        }
    }

    render(): JSX.Element {
        return <>
            <div id="overlayContainer">
                {this.getOverlayContent()}
            </div>
        </>
    }

}

export default connect<unknown, unknown>(mapState)(Overlay)