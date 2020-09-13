import { Action } from 'redux'
import { HeliosDistribution, HeliosServer } from 'common/distribution/DistributionFactory'
import { ServerStatus } from 'common/mojang/net/ServerStatusAPI'
import { MojangStatus } from 'common/mojang/rest/internal/MojangStatus'

export enum AppActionType {
    SetDistribution = 'SET_DISTRIBUTION',
    SetSelectedServer = 'SET_SELECTED_SERVER',
    SetSelectedServerStatus = 'SET_SELECTED_SERVER_STATUS',
    SetMojangStatuses = 'SET_MOJANG_STATUSES'
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AppAction extends Action {}

export interface SetDistributionAction extends AppAction {
    payload?: HeliosDistribution
}

export interface SetSelectedServerAction extends AppAction {
    payload?: HeliosServer
}

export interface SetSelectedServerStatusAction extends AppAction {
    payload?: ServerStatus
}

export interface SetMojangStatusesAction extends AppAction {
    payload: MojangStatus[]
}

export function setDistribution(distribution?: HeliosDistribution): SetDistributionAction {
    return {
        type: AppActionType.SetDistribution,
        payload: distribution
    }
}

export function setSelectedServer(server?: HeliosServer): SetSelectedServerAction {
    return {
        type: AppActionType.SetSelectedServer,
        payload: server
    }
}

export function setSelectedServerStatus(serverStatus?: ServerStatus): SetSelectedServerStatusAction {
    return {
        type: AppActionType.SetSelectedServerStatus,
        payload: serverStatus
    }
}

export function setMojangStatuses(mojangStatuses: MojangStatus[]): SetMojangStatusesAction {
    return {
        type: AppActionType.SetMojangStatuses,
        payload: mojangStatuses
    }
}

export const AppActionDispatch = {
    setDistribution: (d?: HeliosDistribution): SetDistributionAction => setDistribution(d),
    setSelectedServer: (s?: HeliosServer): SetSelectedServerAction => setSelectedServer(s),
    setSelectedServerStatus: (ss?: ServerStatus): SetSelectedServerStatusAction => setSelectedServerStatus(ss),
    setMojangStatuses: (ms: MojangStatus[]): SetMojangStatusesAction => setMojangStatuses(ms)
}