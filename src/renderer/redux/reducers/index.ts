import { combineReducers } from "redux";
import ViewReducer from "./viewReducer";

export default combineReducers({
    currentView: ViewReducer
})