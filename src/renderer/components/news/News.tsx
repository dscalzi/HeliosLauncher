import * as React from 'react'

import './News.css'

export default class News extends React.Component {


    render(): JSX.Element {

        return (
            <>
                <div id="newsContainer">
                    <div id="newsContent" {...{article: '-1'}} style={{display: 'none'}}>
                        <div id="newsStatusContainer">
                            <div id="newsStatusContent">
                                <div id="newsTitleContainer">
                                    <a id="newsArticleTitle" href="#">Lorem Ipsum</a>
                                </div>
                                <div id="newsMetaContainer">
                                    <div id="newsArticleDateWrapper">
                                        <span id="newsArticleDate">Mar 15, 44 BC, 9:14 AM</span>
                                    </div>
                                    <div id="newsArticleAuthorWrapper">
                                        <span id="newsArticleAuthor">by Cicero</span>
                                    </div>
                                    <a href="#" id="newsArticleComments">0 Comments</a>
                                </div>
                            </div>
                            <div id="newsNavigationContainer">
                                <button id="newsNavigateLeft">
                                    <svg id="newsNavigationLeftSVG" viewBox="0 0 24.87 13.97">
                                        <polyline style={{transition: '0.25s ease'}} fill="none" stroke="#FFF" strokeWidth="2px" points="0.71 13.26 12.56 1.41 24.16 13.02"/>
                                    </svg>
                                </button>
                                <span id="newsNavigationStatus">1 of 1</span>
                                <button id="newsNavigateRight">
                                    <svg id="newsNavigationRightSVG" viewBox="0 0 24.87 13.97">
                                        <polyline style={{transition: '0.25s ease'}} fill="none" stroke="#FFF" strokeWidth="2px" points="0.71 13.26 12.56 1.41 24.16 13.02"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div id="newsArticleContainer">
                            <div id="newsArticleContent">
                                <div id="newsArticleContentScrollable">
                                    {/*  Article Content */}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="newsErrorContainer">
                        <div id="newsErrorLoading">
                            <span id="nELoadSpan" className="newsErrorContent">Checking for News..</span>
                        </div>
                        <div id="newsErrorFailed" style={{display: 'none'}}>
                            <span id="nEFailedSpan" className="newsErrorContent">Failed to Load News</span>
                            <button id="newsErrorRetry">Try Again</button>
                        </div>
                        <div id="newsErrorNone" style={{display: 'none'}}>
                            <span id="nENoneSpan" className="newsErrorContent">No News</span>
                        </div>
                    </div>
                </div>

            </>
        )

    }

}