import { AppActionType, AppAction, SetDistributionAction } from '../actions/appActions'
import { Reducer } from 'redux'
import { HeliosDistribution } from 'common/distribution/DistributionFactory'

export interface AppState {
    distribution: HeliosDistribution | null
}

const defaultAppState: AppState = {
    distribution: null!
}

const AppReducer: Reducer<AppState, AppAction> = (state = defaultAppState, action) => {
    switch(action.type) {
        case AppActionType.SetDistribution:
            return {
                ...state,
                distribution: (action as SetDistributionAction).payload
            }
    }
    return state
}

export default AppReducer