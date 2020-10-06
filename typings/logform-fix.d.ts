import { SPLAT } from 'triple-beam'

// Workaround until fixed.
// https://github.com/winstonjs/logform/issues/111
declare module 'logform' {
    export interface TransformableInfo {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [SPLAT]: any
    }
}
