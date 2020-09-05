import { AppActionType, AppAction, SetDistributionAction, SetSelectedServerAction, SetSelectedServerStatusAction } from '../actions/appActions'
import { Reducer } from 'redux'
import { HeliosDistribution, HeliosServer } from 'common/distribution/DistributionFactory'
import { ServerStatus } from 'common/mojang/net/ServerStatusAPI'

export interface AppState {
    distribution?: HeliosDistribution
    selectedServer?: HeliosServer
    selectedServerStatus?: ServerStatus
}

const defaultAppState: AppState = {
    distribution: undefined,
    selectedServer: undefined,
    selectedServerStatus: undefined
}

const AppReducer: Reducer<AppState, AppAction> = (state = defaultAppState, action) => {
    switch(action.type) {
        case AppActionType.SetDistribution:
            return {
                ...state,
                distribution: (action as SetDistributionAction).payload
            }
        case AppActionType.SetSelectedServer:
            return {
                ...state,
                selectedServer: (action as SetSelectedServerAction).payload
            }
        case AppActionType.SetSelectedServerStatus:
            return {
                ...state,
                selectedServerStatus: (action as SetSelectedServerStatusAction).payload
            }
    }
    return state
}

export default AppReducer