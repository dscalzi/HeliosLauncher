import * as React from 'react'
import { connect } from 'react-redux'
import { OverlayActionDispatch } from '../../../redux/actions/overlayActions'

import './GenericOverlay.css'

export interface GenericOverlayProps {
    title: string
    description: string
    acknowledgeText?: string
    dismissText?: string
    dismissible: boolean
    acknowledgeCallback?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => Promise<void>
    dismissCallback?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => Promise<void>
}

const mapDispatch = {
    ...OverlayActionDispatch
}

type InternalGenericOverlayProps = GenericOverlayProps & typeof mapDispatch

class GenericOverlay extends React.Component<InternalGenericOverlayProps> {

    private getAcknowledgeText = (): string => {
        return this.props.acknowledgeText || 'OK'
    }

    private getDismissText = (): string => {
        return this.props.dismissText || 'Dismiss'
    }

    private onAcknowledgeClick = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): Promise<void> => {
        if(this.props.acknowledgeCallback) {
            await this.props.acknowledgeCallback(event)
        }
        this.props.popOverlayContent()
    }

    private onDismissClick = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): Promise<void> => {
        if(this.props.dismissCallback) {
            await this.props.dismissCallback(event)
        }
        this.props.popOverlayContent()
    }

    render(): JSX.Element {
        return <>
            <div id="overlayContent">
                <span id="overlayTitle">{this.props.title}</span>
                <span id="overlayDesc">{this.props.description}</span>
                <div id="overlayActionContainer">
                    <button onClick={this.onAcknowledgeClick} id="overlayAcknowledge" className="overlayKeybindEnter">{this.getAcknowledgeText()}</button>
                    <div id="overlayDismissWrapper">
                        { this.props.dismissible
                            ? <button onClick={this.onDismissClick} id="overlayDismiss" className="overlayKeybindEsc">{this.getDismissText()}</button>
                            : <></>
                        }
                    </div>
                </div>
            </div>
        </>
    }

}

export default connect<unknown, typeof mapDispatch>(undefined, mapDispatch)(GenericOverlay)