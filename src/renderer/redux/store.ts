import { createStore } from 'redux'
import reducer from './reducers'

export type StoreType = ReturnType<typeof reducer>

export default createStore(reducer)