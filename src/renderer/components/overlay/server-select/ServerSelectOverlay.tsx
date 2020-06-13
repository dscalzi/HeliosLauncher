import * as React from 'react'

import '../shared-select/SharedSelect.css'
import { Server } from 'helios-distribution-types'

export interface ServerSelectOverlayProps {
    servers: Server[]
}

export default class ServerSelectOverlay extends React.Component<ServerSelectOverlayProps> {

    render(): JSX.Element {
        return (
            <>
                <div id="serverSelectContent">
                    <span id="serverSelectHeader">Available Servers</span>
                    <div id="serverSelectList">
                        <div id="serverSelectListScrollable">
                            {/* Server listings populated here. */}
                        </div>
                    </div>
                    <div id="serverSelectActions">
                        <button id="serverSelectConfirm" className="overlayKeybindEnter" type="submit">Select</button>
                        <div id="serverSelectCancelWrapper">
                            <button id="serverSelectCancel" className="overlayKeybindEsc">Cancel</button>
                        </div>
                    </div>
                </div>
            </>
        )
    }

}