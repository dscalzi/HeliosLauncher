import { createStore, StoreEnhancer } from 'redux'
import reducer from './reducers'

export type StoreType = ReturnType<typeof reducer>

type Tmp = {__REDUX_DEVTOOLS_EXTENSION__?: () => StoreEnhancer}

export default createStore(reducer, (window as Tmp).__REDUX_DEVTOOLS_EXTENSION__ && (window as Tmp).__REDUX_DEVTOOLS_EXTENSION__!())