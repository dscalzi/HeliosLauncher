import { AppActionType, AppAction, SetDistributionAction, SetSelectedServerAction } from '../actions/appActions'
import { Reducer } from 'redux'
import { HeliosDistribution, HeliosServer } from 'common/distribution/DistributionFactory'

export interface AppState {
    distribution: HeliosDistribution | null
    selectedServer: HeliosServer | null
}

const defaultAppState: AppState = {
    distribution: null,
    selectedServer: null
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
    }
    return state
}

export default AppReducer