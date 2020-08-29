import { Action } from 'redux'
import { HeliosDistribution } from 'common/distribution/DistributionFactory'

export enum AppActionType {
    SetDistribution = 'SET_DISTRIBUTION'
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AppAction extends Action {}

export interface SetDistributionAction extends AppAction {
    payload: HeliosDistribution
}

export function setDistribution(distribution: HeliosDistribution): SetDistributionAction {
    return {
        type: AppActionType.SetDistribution,
        payload: distribution
    }
}

export const AppActionDispatch = {
    setDistribution: (d: HeliosDistribution): SetDistributionAction => setDistribution(d)
}