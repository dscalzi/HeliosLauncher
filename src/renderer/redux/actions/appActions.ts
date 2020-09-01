import { Action } from 'redux'
import { HeliosDistribution, HeliosServer } from 'common/distribution/DistributionFactory'

export enum AppActionType {
    SetDistribution = 'SET_DISTRIBUTION',
    SetSelectedServer = 'SET_SELECTED_SERVER'
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AppAction extends Action {}

export interface SetDistributionAction extends AppAction {
    payload: HeliosDistribution
}

export interface SetSelectedServerAction extends AppAction {
    payload: HeliosServer
}

export function setDistribution(distribution: HeliosDistribution): SetDistributionAction {
    return {
        type: AppActionType.SetDistribution,
        payload: distribution
    }
}

export function setSelectedServer(server: HeliosServer): SetSelectedServerAction {
    return {
        type: AppActionType.SetSelectedServer,
        payload: server
    }
}

export const AppActionDispatch = {
    setDistribution: (d: HeliosDistribution): SetDistributionAction => setDistribution(d),
    setSelectedServer: (s: HeliosServer): SetSelectedServerAction => setSelectedServer(s)
}