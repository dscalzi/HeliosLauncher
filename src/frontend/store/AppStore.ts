import { writable } from "svelte/store";
import { PossibleViewState } from '../types/PossibleAppState';

export const currentView = writable<PossibleViewState>(PossibleViewState.Loading);
export const mainReady = writable(false);