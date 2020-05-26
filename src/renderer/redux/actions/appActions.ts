import { Action } from 'redux'

export enum AppActionType {
    ChangeLoadState = 'SET_LOADING'
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AppAction extends Action {}

export interface ChangeLoadStateAction extends AppAction {
    payload: boolean
}

export function setLoadingState(state: boolean): ChangeLoadStateAction {
    return {
        type: AppActionType.ChangeLoadState,
        payload: state
    }
}