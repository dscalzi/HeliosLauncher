import { View } from '../../meta/Views'
import { Action } from 'redux'

export enum ViewActionType {
    ChangeView = 'CHANGE_VIEW'
}

export interface ChangeViewAction extends Action {
    payload: View
}

export function setCurrentView(view: View): ChangeViewAction {
    return {
        type: ViewActionType.ChangeView,
        payload: view
    }
}

export const ViewActionDispatch = {
    setView: (x: View): ChangeViewAction => setCurrentView(x)
}