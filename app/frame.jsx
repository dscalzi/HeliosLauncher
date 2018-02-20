import React, { Component } from 'react'
import styles from './frame.css'

export default class FrameBar extends Component {

    render(){
        return(
            <div className="frame_bar">
                <div className="frame_btn_dock">
                    <button className="frame_btn" id="frame_btn_close" tabIndex="-1"></button>
                    <button className="frame_btn" id="frame_btn_restoredown" tabIndex="-1"></button>
                    <button className="frame_btn" id="frame_btn_minimize" tabIndex="-1"></button>
                </div>
            </div>
        )
    }

}