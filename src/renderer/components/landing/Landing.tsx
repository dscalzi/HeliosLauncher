import * as React from 'react'
import { connect } from 'react-redux'
import { CSSTransition } from 'react-transition-group'

import { StoreType } from '../../redux/store'
import { AppActionDispatch } from '../..//redux/actions/appActions'
import { OverlayActionDispatch } from '../../redux/actions/overlayActions'
import { HeliosDistribution, HeliosServer } from 'common/distribution/DistributionFactory'
import { ServerStatus } from 'common/mojang/net/ServerStatusAPI'
import { MojangStatus, MojangStatusColor } from 'common/mojang/rest/internal/MojangStatus'
import { MojangRestAPI } from 'common/mojang/rest/MojangRestAPI'
import { LoggerUtil } from 'common/logging/loggerutil'

import { MediaButton, MediaButtonType } from './mediabutton/MediaButton'
import News from '../news/News'

import './Landing.css'

interface LandingProps {
    distribution: HeliosDistribution
    selectedServer?: HeliosServer
    selectedServerStatus?: ServerStatus
    mojangStatuses: MojangStatus[]
}

interface LandingState {
    workingServerStatus?: ServerStatus
}

const mapState = (state: StoreType): Partial<LandingProps> => {
    return {
        distribution: state.app.distribution!,
        selectedServer: state.app.selectedServer,
        selectedServerStatus: state.app.selectedServerStatus,
        mojangStatuses: state.app.mojangStatuses
    }
}
const mapDispatch = {
    ...AppActionDispatch,
    ...OverlayActionDispatch
}

type InternalLandingProps = LandingProps & typeof mapDispatch

class Landing extends React.Component<InternalLandingProps, LandingState> {

    private static readonly logger = LoggerUtil.getLogger('Landing')

    constructor(props: InternalLandingProps) {
        super(props)
        this.state = {
            workingServerStatus: props.selectedServerStatus
        }
    }

    /* Mojang Status Methods */

    private getMainMojangStatusColor = (): string => {
        const essential = this.props.mojangStatuses.filter(s => s.essential)

        if(this.props.mojangStatuses.length === 0) {
            return MojangRestAPI.statusToHex(MojangStatusColor.GREY)
        }

        // If any essential are red, it's red.
        if(essential.filter(s => s.status === MojangStatusColor.RED).length > 0) {
            return MojangRestAPI.statusToHex(MojangStatusColor.RED)
        }
        // If any essential are yellow, it's yellow.
        if(essential.filter(s => s.status === MojangStatusColor.YELLOW).length > 0) {
            return MojangRestAPI.statusToHex(MojangStatusColor.YELLOW)
        }
        // If any non-essential are not green, return yellow.
        if(this.props.mojangStatuses.filter(s => s.status !== MojangStatusColor.GREEN && s.status !== MojangStatusColor.GREY).length > 0) {
            return MojangRestAPI.statusToHex(MojangStatusColor.YELLOW)
        }
        // if all are grey, return grey.
        if(this.props.mojangStatuses.filter(s => s.status === MojangStatusColor.GREY).length === this.props.mojangStatuses.length) {
            return MojangRestAPI.statusToHex(MojangStatusColor.GREY)
        }

        return MojangRestAPI.statusToHex(MojangStatusColor.GREEN)
    }

    private getMojangStatusesAsJSX = (essential: boolean): JSX.Element[] => {
        
        const statuses: JSX.Element[] = []
        for(const status of this.props.mojangStatuses.filter(s => s.essential === essential)) {
            statuses.push(
                <div className="mojangStatusContainer" key={status.service}>
                    <span className="mojangStatusIcon" style={{color: MojangRestAPI.statusToHex(status.status)}}>&#8226;</span>
                    <span className="mojangStatusName">{status.name}</span>
                </div>
            )
        }
        return statuses
    }

    /* Selected Server Methods */

    private updateWorkingServerStatus = (): void => {
        this.setState({
            ...this.state,
            workingServerStatus: this.props.selectedServerStatus
        })
    }

    private openServerSelect = (): void => {
        this.props.pushServerSelectOverlay({
            servers: this.props.distribution.servers,
            selectedId: this.props.selectedServer?.rawServer.id,
            onSelection: async (serverId: string) => {
                Landing.logger.info('Server Selection Change:', serverId)
                const next: HeliosServer = this.props.distribution.getServerById(serverId)!
                this.props.setSelectedServer(next)
            }
        })
    }

    private getSelectedServerText = (): string => {
        if(this.props.selectedServer != null) {
            return `• ${this.props.selectedServer.rawServer.id}`
        } else {
            return '• No Server Selected'
        }
    }

    private getSelectedServerStatusText = (): string => {
        return this.state.workingServerStatus != null ? 'PLAYERS' : 'SERVER'
    }

    private getSelectedServerCount = (): string => {
        if(this.state.workingServerStatus != null) {
            const { online, max } = this.state.workingServerStatus.players
            return `${online}/${max}`
        } else {
            return 'OFFLINE'
        }
    }

    private readonly mediaButtons = [
        {
            href: 'https://github.com/dscalzi/HeliosLauncher',
            type: MediaButtonType.LINK,
            disabled: false
        },
        {
            href: '#',
            type: MediaButtonType.TWITTER,
            disabled: true
        },
        {
            href: '#',
            type: MediaButtonType.INSTAGRAM,
            disabled: true
        },
        {
            href: '#',
            type: MediaButtonType.YOUTUBE,
            disabled: true
        },
        {
            href: 'https://discord.gg/zNWUXdt',
            type: MediaButtonType.DISCORD,
            disabled: false,
            tooltip: 'Discord'
        }
    ]

    private getExternalMediaButtons = (): JSX.Element[] => {
        const ret: JSX.Element[] = []
        for(const { href, type, disabled, tooltip } of this.mediaButtons) {
            ret.push(
                <MediaButton
                    key={`${type.toLowerCase()}LandingButton`}
                    href={href}
                    type={type}
                    disabled={disabled}
                    tooltip={tooltip}
                />
            )
        }
        return ret
    }

    private onSettingsClick = async (): Promise<void> => {
        console.log('Settings clicked')
    }

    /* Render */

    render(): JSX.Element {
        return <>
            
            <div id="landingContainer">
                <div id="upper">
                    <div id="left">
                        <div id="image_seal_container">
                            <img id="image_seal" src="../images/SealCircle.png"/>
                            <div id="updateAvailableTooltip">Update Available</div>
                        </div>
                    </div>
                    <div id="content">
                    </div>
                    <div id="right">
                        <div id="rightContainer">
                            <div id="user_content">
                                <span id="user_text">Username</span>
                                <div id="avatarContainer">
                                    <button id="avatarOverlay">Edit</button>
                                </div>
                            </div>
                            <div id="mediaContent">
                                <div id="internalMedia">
                                    <MediaButton
                                        type={MediaButtonType.SETTINGS}
                                        action={this.onSettingsClick}
                                        tooltip="Settings"
                                    />
                                </div>
                                <div className="mediaDivider"></div>
                                <div id="externalMedia">
                                    {this.getExternalMediaButtons()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="lower">
                    <div id="left">
                        <div className="bot_wrapper">
                            <div id="content">
                                
                                <CSSTransition
                                    in={this.props.selectedServerStatus?.retrievedAt === this.state.workingServerStatus?.retrievedAt}
                                    timeout={500}
                                    classNames="serverStatusWrapper"
                                    unmountOnExit
                                    onExited={this.updateWorkingServerStatus}
                                >
                                    <div id="server_status_wrapper">
                                        <span className="bot_label" id="landingPlayerLabel">{this.getSelectedServerStatusText()}</span>
                                        <span id="player_count">{this.getSelectedServerCount()}</span>
                                    </div>
                                </CSSTransition>
                                
                                <div className="bot_divider"></div>
                                <div id="mojangStatusWrapper">
                                    <span className="bot_label">MOJANG STATUS</span>
                                    <span id="mojang_status_icon" style={{color: this.getMainMojangStatusColor()}}>&#8226;</span>
                                    <div id="mojangStatusTooltip">
                                        <div id="mojangStatusTooltipTitle">Services</div>
                                        <div id="mojangStatusEssentialContainer">
                                            {this.getMojangStatusesAsJSX(true)}
                                        </div>
                                        <div id="mojangStatusNEContainer">
                                            <div className="mojangStatusNEBar"></div>
                                            <div id="mojangStatusNETitle">Non&nbsp;Essential</div>
                                            <div className="mojangStatusNEBar"></div>
                                        </div>
                                        <div id="mojangStatusNonEssentialContainer">
                                            {this.getMojangStatusesAsJSX(false)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="center">
                        <div className="bot_wrapper">
                            <div id="content">
                                <button id="newsButton">
                                    {/* <img src="assets/images/icons/arrow.svg" id="newsButtonSVG"/> */}
                                    <div id="newsButtonAlert" style={{display: 'none'}}></div>
                                    <svg id="newsButtonSVG" viewBox="0 0 24.87 13.97">
                                        <polyline fill="none" stroke="#FFF" strokeWidth="2px" points="0.71 13.26 12.56 1.41 24.16 13.02"/>
                                    </svg>
                                    &#10;<span id="newsButtonText">NEWS</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="right">
                        <div className="bot_wrapper">
                            <div id="launch_content">
                                <button id="launch_button">PLAY</button>
                                <div className="bot_divider"></div>
                                <button onClick={this.openServerSelect} id="server_selection_button" className="bot_label">{this.getSelectedServerText()}</button>
                            </div>
                            <div id="launch_details">
                                <div id="launch_details_left">
                                    <span id="launch_progress_label">0%</span>
                                    <div className="bot_divider"></div>
                                </div>
                                <div id="launch_details_right">
                                    <progress id="launch_progress" value="22" max="100"></progress>
                                    <span id="launch_details_text" className="bot_label">Please wait..</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <News />
            </div>


        </>
    }

}

export default connect<unknown, typeof mapDispatch>(mapState, mapDispatch)(Landing)