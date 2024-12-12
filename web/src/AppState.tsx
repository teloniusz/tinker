import { useReducer } from 'react'
import { createContainer } from 'react-tracked'
import { socketConnected } from './services'
import { UserInfo } from './models/user'

export interface AlertData {
  type: string
  text: string
}

export interface AppState {
  isConnected: boolean
  userInfo: UserInfo
  estimationInProgress: boolean
  estimationErrorMessage: string | null
  alert: AlertData | null
}

export type DispatchState = (dispatch: (state: AppState) => AppState) => void

const initialState: AppState = {
  isConnected: socketConnected(),
  userInfo: { id: 0, first_name: '', last_name: '' },
  estimationInProgress: false,
  estimationErrorMessage: null,
  alert: null,
}

export type Action =
  | { type: 'CONNECTED'; isConnected: boolean }
  | { type: 'USER_INFO'; userInfo: UserInfo }
  | { type: 'SET_ALERT'; alert: AlertData | null }

const reducer = (state: AppState, action: Action) => {
  switch (action.type) {
    case 'CONNECTED': {
      const { isConnected } = action
      return { ...state, isConnected }
    }
    case 'USER_INFO': {
      const { userInfo } = action
      return { ...state, userInfo }
    }
    case 'SET_ALERT': {
      const { alert } = action
      return { ...state, alert }
    }
  }
}

export const { Provider: AppStateProvider, useTracked: useAppState } = createContainer(() =>
  useReducer(reducer, initialState)
)

export const setAlert = (dispatch: React.Dispatch<Action>, alert: AlertData | null, delay?: number | null) => {
  dispatch({ type: 'SET_ALERT', alert })
  if (delay !== null) {
    delay = delay ?? 3000
    setTimeout(() => dispatch({ type: 'SET_ALERT', alert: null }), delay)
  }
}
