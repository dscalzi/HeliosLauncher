import { combineReducers } from 'redux'
import ViewReducer from './viewReducer'
import AppReducer from './appReducer'
import OverlayReducer from './overlayReducer'

export default combineReducers({
    currentView: ViewReducer,
    overlayQueue: OverlayReducer,
    app: AppReducer
})