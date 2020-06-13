import { Reducer } from 'redux'
import { OverlayAction, OverlayActionType, OverlayPushAction } from '../actions/overlayActions'

const defaultOverlayQueue: OverlayPushAction<unknown>[] = []

const OverlayReducer: Reducer<OverlayPushAction<unknown>[], OverlayAction> = (state = defaultOverlayQueue, action) => {
    switch(action.type) {
        case OverlayActionType.PushContent:
            if((action as OverlayPushAction<unknown>).showNext && state.length > 0) {
                return [
                    state[0],
                    action as OverlayPushAction<unknown>,
                    ...state.slice(1)
                ]
            } else {
                return [
                    ...state,
                    action as OverlayPushAction<unknown>
                ]
            }
        case OverlayActionType.PopContent:
            return [
                ...state.slice(1)
            ]
            
    }
    return state
}

export default OverlayReducer