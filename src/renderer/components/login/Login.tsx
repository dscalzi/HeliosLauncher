import * as React from 'react'
import LoginField from './login-field/LoginField'

import './Login.css'

type LoginProperties = {
    cancelable: boolean
}

export default class Login extends React.Component<LoginProperties> {

    getCancelButton(): JSX.Element {
        if(this.props.cancelable) {
            return (
                <>
                    <div id="loginCancelContainer">
                        <button id="loginCancelButton">
                            <div id="loginCancelIcon">X</div>
                            <span id="loginCancelText">Cancel</span>
                        </button>
                    </div>
                </>
            )
        } else {
            return (<></>)
        }
    }

    render() {
        return (
            <>
                <div id="loginContainer">
                    {this.getCancelButton()}
                    <div id="loginContent">
                        <form id="loginForm">
                            <img id="loginImageSeal" src="../images/SealCircle.png"/>
                            <span id="loginSubheader">MINECRAFT LOGIN</span>

                            <LoginField password={false} />
                            <LoginField password={true} />

                            <div id="loginOptions">
                                <span className="loginSpanDim">
                                    <a href="https://my.minecraft.net/en-us/password/forgot/">forgot password?</a>
                                </span>
                                <label id="checkmarkContainer">
                                    <input id="loginRememberOption" type="checkbox" checked></input>
                                    <span id="loginRememberText" className="loginSpanDim">remember me?</span>
                                    <span className="loginCheckmark"></span>
                                </label>
                            </div>
                            <button id="loginButton" disabled>
                                <div id="loginButtonContent">
                                    LOGIN
                                    <svg id="loginSVG" viewBox="0 0 24.87 13.97">
                                        <defs>
                                            <style>{'.arrowLine{transition: 0.25s ease;}'}</style> {/** TODO */}
                                        </defs>
                                        <polyline className="arrowLine" fill="none" stroke="#FFF" strokeWidth="2px" points="0.71 13.26 12.56 1.41 24.16 13.02"/>
                                    </svg>
                                    <div className="circle-loader">
                                        <div className="checkmark draw"></div>
                                    </div>
                                    {/*<div className="spinningCircle" id="loginSpinner"></div>-*/}
                                </div>
                            </button>
                            <div id="loginDisclaimer">
                                <span className="loginSpanDim" id="loginRegisterSpan">
                                    <a href="https://minecraft.net/en-us/store/minecraft/">Need an Account?</a>
                                </span>
                                <p className="loginDisclaimerText">Your password is sent directly to mojang and never stored.</p>
                                <p className="loginDisclaimerText">Helios Launcher is not affiliated with Mojang AB.</p>
                            </div>
                        </form>
                    </div>
                </div>
            </>
        )
    }

}