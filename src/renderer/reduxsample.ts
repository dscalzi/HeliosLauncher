/* eslint-disable */
import { combineReducers, createStore, Reducer, Action, AnyAction } from 'redux'

const userReducer: Reducer<any, AnyAction> = (state = {name: 'Name1', age: 0}, action) => {
    switch(action.type) {
        case 'CHANGE_NAME':
            return {...state, name: action.payload}
        case 'CHANGE_AGE':
            return {...state, age: action.payload}
    }
    return state
}

const tweetsReducer: Reducer<any, Action> = (state = [], action) => {
    
    return state
}

const reducer = combineReducers({
    user: userReducer,
    tweets: tweetsReducer
})

const store = createStore(reducer)

store.dispatch({type: 'CHANGE_NAME', payload: 'Name2'})
store.dispatch({type: 'CHANGE_AGE', payload: 1})

export default store