import { AppActionType, AppAction, SetDistributionAction, SetSelectedServerAction, SetSelectedServerStatusAction, SetMojangStatusesAction } from '../actions/appActions'
import { Reducer } from 'redux'
import { HeliosDistribution, HeliosServer } from 'common/distribution/DistributionFactory'
import { ServerStatus } from 'common/mojang/net/ServerStatusAPI'
import { MojangStatus } from 'common/mojang/rest/internal/MojangStatus'
import { MojangRestAPI } from 'common/mojang/rest/MojangRestAPI'

export interface AppState {
    distribution?: HeliosDistribution
    selectedServer?: HeliosServer
    selectedServerStatus?: ServerStatus
    mojangStatuses: MojangStatus[]
}

const defaultAppState: AppState = {
    distribution: undefined,
    selectedServer: undefined,
    selectedServerStatus: undefined,
    mojangStatuses: MojangRestAPI.getDefaultStatuses()
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
        case AppActionType.SetMojangStatuses:
            return {
                ...state,
                mojangStatuses: (action as SetMojangStatusesAction).payload
            }
    }
    return state
}

export default AppReducer