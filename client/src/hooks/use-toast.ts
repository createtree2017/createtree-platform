/**
 * use-toast.ts — createTree 프로젝트 단일 토스트 시스템
 *
 * [통합 이력]
 * - 기존 3개 파일(hooks/use-toast.ts, hooks/useToast.ts, components/ui/use-toast.ts,
 *   components/ui/use-toast.tsx)을 이 파일 하나로 통합 (2026-03-25)
 * - 자동 닫힘: 기본 3초, toast() 호출 시 duration 옵션으로 개별 조정 가능
 *
 * [사용법]
 *   import { useToast } from "@/hooks/use-toast"   // hook 방식
 *   import { toast }    from "@/hooks/use-toast"   // 직접 호출 방식
 *
 * ⚠️ 절대 하지 말 것:
 *   - 이 파일을 복사하여 components/ui/ 등에 별도 파일 생성
 *   - components/ui/use-toast.ts / use-toast.tsx 부활
 *   - hooks/useToast.ts 래퍼 파일 재생성
 */
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

/** 동시 표시 최대 토스트 수 */
const TOAST_LIMIT = 3

/**
 * dismiss 애니메이션 종료 후 DOM에서 제거될 때까지의 지연 (ms)
 * - dismiss()가 호출되면 open=false → 페이드 아웃 애니메이션 → TOAST_REMOVE_DELAY 후 DOM 제거
 */
const TOAST_REMOVE_DELAY = 500

/** 자동 닫힘 기본 시간 (ms). toast() 호출 시 duration 옵션으로 개별 조정 가능 */
const DEFAULT_DURATION = 3000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  /** 자동 닫힘 시간(ms). undefined 이면 DEFAULT_DURATION 사용 */
  duration?: number
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast> }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
  | { type: ActionType["REMOVE_TOAST"]; toastId?: ToasterToast["id"] }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) return

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => addToRemoveQueue(toast.id))
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? { ...t, open: false }
            : t
        ),
      }
    }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return { ...state, toasts: [] }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

type Toast = Omit<ToasterToast, "id">

function toast({ duration, ...props }: Toast) {
  const id = genId()
  const resolvedDuration = duration ?? DEFAULT_DURATION

  const update = (props: ToasterToast) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } })

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  // 자동 닫힘 타이머 (resolvedDuration ms 후 dismiss)
  setTimeout(dismiss, resolvedDuration)

  return { id, dismiss, update }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) =>
      dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
