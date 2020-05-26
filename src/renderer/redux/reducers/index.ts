import { combineReducers } from 'redux'
import ViewReducer from './viewReducer'
import AppReducer from './appReducer'

export default combineReducers({
    currentView: ViewReducer,
    app: AppReducer
})