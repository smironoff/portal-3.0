export type ResponseStatus =
  | 'OK'
  | 'PENDING_APPROVAL'
  | 'SYS_ERR'
  | 'NOT_FOUND'
  | 'CHALLENGE'
  | 'VALIDATION_ERROR'
  | 'ALREADY_REGISTERED'
  | 'NOT_AUTHORIZED'
  | 'NO_ACCOUNT'
  | 'DENIED'

export interface APIResponsePayload<T> {
  module: string
  action: string
  result: T & { message?: string }
  status: ResponseStatus
}

export interface APIResponse<T> {
  id: number
  session_id: string
  token: string
  payload: APIResponsePayload<T>[]
}
