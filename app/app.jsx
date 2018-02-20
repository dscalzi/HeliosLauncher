import React, { Component } from 'react'
import Frame from './frame.jsx'

export default class App extends Component {

    render(){
        return (
            <div className="appMount">
                <Frame />
                My App
            </div>
        )
    }

}