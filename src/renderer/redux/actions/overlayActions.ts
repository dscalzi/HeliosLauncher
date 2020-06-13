import { Action } from 'redux'
import { GenericOverlayProps } from 'src/renderer/components/overlay/generic-overlay/GenericOverlay'
import { ServerSelectOverlayProps } from 'src/renderer/components/overlay/server-select/ServerSelectOverlay'

export enum OverlayContent {
    ACCOUNT_SELECT,
    SERVER_SELECT,
    GENERIC
}

export enum OverlayActionType {
    PushContent = 'PUSH_CONTENT',
    PopContent = 'POP_CONTENT'
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OverlayAction extends Action {}

export interface OverlayPushAction<T> extends OverlayAction {
    overlayContent: OverlayContent
    timestamp: number
    showNext: boolean
    payload: T
}

export interface PushGenericOverlayAction extends OverlayPushAction<GenericOverlayProps> {
    overlayContent: OverlayContent.GENERIC
    payload: GenericOverlayProps
}

export interface PushServerSelectOverlayAction extends OverlayPushAction<ServerSelectOverlayProps> {
    overlayContent: OverlayContent.SERVER_SELECT
    payload: ServerSelectOverlayProps
}

export function pushGenericOverlay(options: GenericOverlayProps, showNext = false): PushGenericOverlayAction {
    return {
        type: OverlayActionType.PushContent,
        overlayContent: OverlayContent.GENERIC,
        timestamp: Date.now(),
        showNext,
        payload: options
    }
}

export function pushServerSelectOverlay(options: ServerSelectOverlayProps, showNext = false): PushServerSelectOverlayAction {
    return {
        type: OverlayActionType.PushContent,
        overlayContent: OverlayContent.SERVER_SELECT,
        timestamp: Date.now(),
        showNext,
        payload: options
    }
}

export function popOverlayContent(): OverlayAction {
    return {
        type: OverlayActionType.PopContent
    }
}

export const OverlayActionDispatch = {
    pushGenericOverlay: (options: GenericOverlayProps, showNext = false): PushGenericOverlayAction => pushGenericOverlay(options, showNext),
    pushServerSelectOverlay: (options: ServerSelectOverlayProps, showNext = false): PushServerSelectOverlayAction => pushServerSelectOverlay(options, showNext),
    popOverlayContent: (): OverlayAction => popOverlayContent()
}