import * as React from 'react';
import './Welcome.css';

const Welcome = () => (
    <div id="welcomeContainer">
        <div id="welcomeContent">
            <img id="welcomeImageSeal" src="../images/SealCircle.png"/>
            <span id="welcomeHeader">WELCOME TO HELIOS LAUNCHER</span>
            <span id="welcomeDescription">Our mission is to provide modded servers with a simple and reliable client. When a server needs more than vanilla minecraft offers, they turn to modding platforms to fill in the gaps. Managing and deploying client updates can be difficult and time consuming. Helios Launcher provides a platform to handle all of this for you through a customized, simple, and elegant client. It shouldn't be hard to play modded minecraft. It's shouldn't be hard to set up Java. With Helios, it isn't. Let's get going.</span>
            <br />
            <span id="welcomeDescCTA">You are just a few clicks away from the game.</span>
            <button id="welcomeButton">
                <div id="welcomeButtonContent">
                    CONTINUE
                    <svg id="welcomeSVG" viewBox="0 0 24.87 13.97">
                        <polyline style={{fill:'none', stroke:'#FFF', strokeWidth:'2px', transition: '0.25s ease'}} strokeWidth="2px"  points="0.71 13.26 12.56 1.41 24.16 13.02"/>
                    </svg>
                </div>
            </button>
        </div>
    </div>
);

export default Welcome;