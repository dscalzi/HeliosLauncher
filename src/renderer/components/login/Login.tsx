import * as React from 'react'
import LoginField from './login-field/LoginField'

import './Login.css'

enum LoginStatus {
    IDLE,
    LOADING,
    SUCCESS,
    ERROR
}

type LoginProperties = {
    cancelable: boolean
}

type LoginState = {
    rememberMe: boolean
    userValid: boolean
    passValid: boolean
    status: LoginStatus
}

export default class Login extends React.Component<LoginProperties, LoginState> {

    private userRef: React.RefObject<LoginField>
    private passRef: React.RefObject<LoginField>

    constructor(props: LoginProperties) {
        super(props)
        this.state = {
            rememberMe: true,
            userValid: false,
            passValid: false,
            status: LoginStatus.IDLE
        }
        this.userRef = React.createRef()
        this.passRef = React.createRef()
    }

    getCancelButton(): JSX.Element {
        if(this.props.cancelable) {
            return (
                <>
                    <div id="loginCancelContainer">
                        <button id="loginCancelButton" disabled={this.isFormDisabled()}>
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

    isFormDisabled = (): boolean => {
        return this.state.status !== LoginStatus.IDLE
    }

    isLoading = (): boolean => {
        return this.state.status === LoginStatus.LOADING
    }

    canSave = (): boolean => {
        return this.state.passValid && this.state.userValid && !this.isFormDisabled()
    }

    getButtonText = (): string => {
        switch(this.state.status) {
            case LoginStatus.LOADING:
                return 'LOGGING IN'
            case LoginStatus.SUCCESS:
                return 'SUCCESS'
            case LoginStatus.ERROR:
            case LoginStatus.IDLE:
                return 'LOGIN'
        }
    }

    handleUserValidityChange = (valid: boolean): void => {
        this.setState({
            ...this.state,
            userValid: valid
        })
    }

    handlePassValidityChange = (valid: boolean): void => {
        this.setState({
            ...this.state,
            passValid: valid
        })
    }

    handleCheckBoxChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            ...this.state,
            rememberMe: event.target.checked
        })
    }

    handleFormSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault()
    }

    handleLoginButtonClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        console.log(this.userRef.current!.getValue())
        console.log(this.passRef.current!.getValue())
        this.setState({
            ...this.state,
            status: LoginStatus.LOADING
        })
    }

    render(): JSX.Element {
        return (
            <>
                <div id="loginContainer">
                    {this.getCancelButton()}
                    <div id="loginContent">
                        <form id="loginForm" onSubmit={this.handleFormSubmit}>
                            <img id="loginImageSeal" src="../images/SealCircle.png"/>
                            <span id="loginSubheader">MINECRAFT LOGIN</span>

                            <LoginField
                                ref={this.userRef}
                                password={false}
                                disabled={this.isFormDisabled()}
                                onValidityChange={this.handleUserValidityChange} />
                            <LoginField
                                ref={this.passRef}
                                password={true}
                                disabled={this.isFormDisabled()}
                                onValidityChange={this.handlePassValidityChange} />

                            <div id="loginOptions">
                                <span className="loginSpanDim">
                                    <a href="https://my.minecraft.net/en-us/password/forgot/">forgot password?</a>
                                </span>
                                <label id="checkmarkContainer" {...(this.isFormDisabled() ? {disabled: true} : {})} >
                                    <input
                                        id="loginRememberOption"
                                        type="checkbox"
                                        checked={this.state.rememberMe}
                                        onChange={this.handleCheckBoxChange}
                                        disabled={this.isFormDisabled()}
                                    ></input>
                                    <span id="loginRememberText" className="loginSpanDim">remember me?</span>
                                    <span className="loginCheckmark"></span>
                                </label>
                            </div>
                            <button
                                id="loginButton"
                                disabled={!this.canSave()}
                                onClick={this.handleLoginButtonClick}
                                {...(this.isLoading() ? {loading: 'true'} : {})}>
                                <div id="loginButtonContent">
                                    {this.getButtonText()}
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