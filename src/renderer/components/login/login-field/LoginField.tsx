import * as React from 'react'

import './LoginField.css'

enum FieldError {
    REQUIRED = 'Required',
    INVALID = 'Invalid Value'
}

type LoginFieldProps = {
    password: boolean,
    disabled: boolean,
    onValidityChange: (valid: boolean) => void
}

type LoginFieldState = {
    errorText: FieldError,
    hasError: boolean,
    shake: boolean,
    value: string
}

export default class LoginField extends React.Component<LoginFieldProps, LoginFieldState> {

    private readonly USERNAME_REGEX = /^[a-zA-Z0-9_]{1,16}$/
    private readonly BASIC_EMAIL_REGEX = /^\S+@\S+\.\S+$/
    // private readonly VALID_EMAIL_REGEX = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i

    private readonly SHAKE_CLASS = 'shake'

    private errorSpanRef: React.RefObject<HTMLSpanElement>
    private internalTrigger = false // Indicates that the component updated from an internal trigger.

    constructor(props: LoginFieldProps) {
        super(props)
        this.state = {
            errorText: FieldError.REQUIRED,
            hasError: true,
            shake: false,
            value: ''
        }
        this.errorSpanRef = React.createRef()
    }

    componentDidUpdate() {
        if(this.internalTrigger) {
            if(this.state.hasError) {
                // @ts-ignore Opacity is a number, not a string..
                this.errorSpanRef.current!.style.opacity = 1
                if(this.state.shake) {
                    this.errorSpanRef.current!.classList.remove(this.SHAKE_CLASS)
                    void this.errorSpanRef.current!.offsetWidth
                    this.errorSpanRef.current!.classList.add(this.SHAKE_CLASS)
                }
            } else {
                // @ts-ignore Opacity is a number, not a string..
                this.errorSpanRef.current!.style.opacity = 0
            }
        }
        this.internalTrigger = false
    }

    public getValue(): string {
        return this.state.value
    }

    private getFieldSvg(): JSX.Element {
        if(this.props.password) {

            return (
                <>
                    <svg className="loginSVG" viewBox="40 32 60.36 70.43">
                        <g>
                            <path d="M86.16,54a16.38,16.38,0,1,0-32,0H44V102.7H96V54Zm-25.9-3.39a9.89,9.89,0,1,1,19.77,0A9.78,9.78,0,0,1,79.39,54H60.89A9.78,9.78,0,0,1,60.26,50.59ZM70,96.2a6.5,6.5,0,0,1-6.5-6.5,6.39,6.39,0,0,1,3.1-5.4V67h6.5V84.11a6.42,6.42,0,0,1,3.39,5.6A6.5,6.5,0,0,1,70,96.2Z"/>
                        </g>
                    </svg>
                </>
            )

        } else {

            return (
                <>
                    <svg className="loginSVG" viewBox="40 37 65.36 61.43">
                        <g>
                            <path d="M86.77,58.12A13.79,13.79,0,1,0,73,71.91,13.79,13.79,0,0,0,86.77,58.12M97,103.67a3.41,3.41,0,0,0,3.39-3.84,27.57,27.57,0,0,0-54.61,0,3.41,3.41,0,0,0,3.39,3.84Z"/>
                        </g>
                    </svg>
                </>
            )
            
        }
    }

    private formatError(error: FieldError): string {
        return `* ${error}`
    }

    private getErrorState(shake: boolean, errorText: FieldError): Partial<LoginFieldState> & Required<{hasError: boolean}> {
        return {
            shake,
            errorText,
            hasError: true,
        }
    }

    private getValidState(): Partial<LoginFieldState> & Required<{hasError: boolean}> {
        return {
            hasError: false
        }
    }

    private validateEmail = (value: string, shakeOnError: boolean): void => {
        let newState
        if(value) {
            if(!this.BASIC_EMAIL_REGEX.test(value) && !this.USERNAME_REGEX.test(value)) {
                newState = this.getErrorState(shakeOnError, FieldError.INVALID)
            } else {
                newState = this.getValidState()
            }
        } else {
            newState = this.getErrorState(shakeOnError, FieldError.REQUIRED)
        }
        this.internalTrigger = true
        this.setState({
            ...this.state,
            ...newState,
            value
        })
        this.props.onValidityChange(!newState.hasError)
    }

    private validatePassword = (value: string, shakeOnError: boolean): void => {
        let newState
        if(value) {
            newState = this.getValidState()
        } else {
            newState = this.getErrorState(shakeOnError, FieldError.REQUIRED)
        }
        this.internalTrigger = true
        this.setState({
            ...this.state,
            ...newState,
            value
        })
        this.props.onValidityChange(!newState.hasError)
    }

    private getValidateFunction(): (value: string, shakeOnError: boolean) => void {
        return this.props.password ? this.validatePassword : this.validateEmail
    }

    private handleBlur = (event: React.FocusEvent<HTMLInputElement>): void => {
        this.getValidateFunction()(event.target.value, true)
    }

    private handleInput = (event: React.FormEvent<HTMLInputElement>): void => {
        this.getValidateFunction()((event.target as HTMLInputElement).value, false)
    }

    render() {
        return (
            <>
                <div className="loginFieldContainer">
                    {this.getFieldSvg()}
                    <span
                        className="loginErrorSpan"
                        ref={this.errorSpanRef}>
                        {this.formatError(this.state.errorText)}
                    </span>
                    <input 
                        className="loginField"
                        disabled={this.props.disabled}
                        type={this.props.password ? 'password' : 'text'}
                        defaultValue={this.state.value}
                        placeholder={this.props.password ? 'PASSWORD' : 'EMAIL OR USERNAME'}
                        onBlur={this.handleBlur}
                        onInput={this.handleInput} />
                </div>
            </>
        )
    }

}