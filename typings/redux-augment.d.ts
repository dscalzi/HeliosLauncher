import { StoreType } from '../src/renderer/redux/store'

declare module 'react-redux' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface DefaultRootState extends StoreType {}
}
