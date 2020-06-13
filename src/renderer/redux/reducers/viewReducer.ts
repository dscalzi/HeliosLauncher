import { Reducer } from 'redux'
import { View } from '../../meta/Views'
import { ChangeViewAction, ViewActionType } from '../actions/viewActions'

const defaultView = View.LANDING

const ViewReducer: Reducer<View, ChangeViewAction> = (state = defaultView, action) => {
    switch(action.type) {
        case ViewActionType.ChangeView:
            return action.payload
    }
    return state
}

export default ViewReducer