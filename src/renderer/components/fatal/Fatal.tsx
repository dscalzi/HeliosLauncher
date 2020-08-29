import * as React from 'react'
import { remote, shell } from 'electron'

import './Fatal.css'

function closeHandler() {
    const window = remote.getCurrentWindow()
    window.close()
}

function openLatest() {
    // TODO don't hardcode
    shell.openExternal('https://github.com/dscalzi/HeliosLauncher/releases')
}

export default class Fatal extends React.Component {

    render(): JSX.Element {

        return (
            <>
                <div id="fatalContainer">
                    <div id="fatalContent">

                        <div id="fatalHeader">
                            <div id="fatalLeft">
                                <img id="fatalErrorImg" src="../images/SealCircleError.png"/>
                            </div>
                            <div id="fatalRight">
                                <span id="fatalErrorLabel">FATAL ERROR</span>
                                <span id="fatalErrorText">Failed to load Distribution Index</span>
                            </div>
                        </div>

                        <div id="fatalBody">
                            <h4>What Happened?</h4>
                            <p id="fatalDescription">
                                A connection could not be established to our servers to download the distribution index. No local copies were available to load.
                                The distribution index is an essential file which provides the latest server information. The launcher is unable to start without it.
                            </p>

                            {/* TODO When auto update is done, do a version check and auto/update here. */}

                            <div id="fatalChecklistContainer">
                                <ul>
                                    <li>Ensure you are running the latest version of Helios Launcher.</li>
                                    <li>Ensure you are connected to the internet.</li>
                                </ul>
                            </div>

                            <h4>Relaunch the application to try again.</h4>

                            <div id="fatalActionContainer">
                                <button onClick={openLatest} id="fatalAcknowledge">Latest Releaes</button>
                                <div id="fatalDismissWrapper">
                                    <button onClick={closeHandler} id="fatalDismiss">Close Launcher</button>
                                </div>
                            </div>

                        </div>
                        
                    </div>
                </div>

            </>
        )

    }

}