import * as React from 'react'

import './Loader.css'

import LoadingSeal from '../../../../static/images/LoadingSeal.png'
import LoadingText from '../../../../static/images/LoadingText.png'

export default class Loader extends React.Component {

    render(): JSX.Element {
        return <>
            <div id="loadingContainer">
                <div id="loadingContent">
                    <div id="loadSpinnerContainer">
                        <img id="loadCenterImage" src={LoadingSeal} />
                        <img id="loadSpinnerImage" className="rotating" src={LoadingText} />
                    </div>
                </div>
            </div>
        </>
    }

}