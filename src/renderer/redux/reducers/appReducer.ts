import { ChangeLoadStateAction, AppActionType, AppAction } from '../actions/appActions'
import { Reducer } from 'redux'

export interface AppState {
    loading: boolean
}

const defaultAppState: AppState = {
    loading: true
}

// TODO remove loading from global state. Keeping as an example...
const AppReducer: Reducer<AppState, AppAction> = (state = defaultAppState, action) => {
    switch(action.type) {
        case AppActionType.ChangeLoadState:
            return {
                ...state,
                loading: (action as ChangeLoadStateAction).payload
            }
    }
    return state
}

export default AppReducer