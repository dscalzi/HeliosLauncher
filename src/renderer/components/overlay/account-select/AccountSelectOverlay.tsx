import * as React from 'react'

import '../shared-select/SharedSelect.css'

export default class AccountSelectOverlay extends React.Component {

    render(): JSX.Element {
        return (
            <>
                <div id="accountSelectContent">
                    <span id="accountSelectHeader">Select an Account</span>
                    <div id="accountSelectList">
                        <div id="accountSelectListScrollable">
                            {/* Accounts populated here. */}
                        </div>
                    </div>
                    <div id="accountSelectActions">
                        <button id="accountSelectConfirm" className="overlayKeybindEnter" type="submit">Select</button>
                        <div id="accountSelectCancelWrapper">
                            <button id="accountSelectCancel" className="overlayKeybindEsc">Cancel</button>
                        </div>
                    </div>
                </div>
            </>
        )
    }

}