import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { parseJSON } from './parseJson'
import { typedError } from './typedError'

export const ErrorReason = {
  FailedToFetch: 'FailedToFetch',
  FailedToGetResponseText: 'FailedToGetResponseText',
  FailedToParseResponseToJson: 'FailedToParseResponseToJson',
  RequestStatusNotOk: 'RequestStatusNotOk',
} as const

export type ErrorReason = (typeof ErrorReason)[keyof typeof ErrorReason]

const resolveFetch = (fetchable: ReturnType<typeof fetch>) =>
  ResultAsync.fromPromise(fetchable, typedError).mapErr(
    (error): FetchError => ({
      reason: ErrorReason.FailedToFetch,
      jsError: error,
      status: -1,
    })
  )

const getResponseText = (response: Response) =>
  ResultAsync.fromPromise(response.text(), typedError).mapErr(
    (error): FailedToGetResponseTextError => ({
      reason: ErrorReason.FailedToGetResponseText,
      jsError: error,
      status: response.status,
    })
  )

export type FetchWrapperError<ER = unknown> =
  | FailedToGetResponseTextError
  | FailedToParseResponseToJsonError
  | ErrorResponse<ER>
  | FetchError

export type FailedToGetResponseTextError = {
  reason: typeof ErrorReason.FailedToGetResponseText
  jsError: Error
  status: number
}

export type FailedToParseResponseToJsonError = {
  reason: typeof ErrorReason.FailedToParseResponseToJson
  jsError: Error
  data: string
  status: number
}

export type ErrorResponse<ER = unknown> = {
  reason: typeof ErrorReason.RequestStatusNotOk
  data: ER
  status: number
}

export type FetchError = {
  reason: typeof ErrorReason.FailedToFetch
  jsError: Error
  status: number
}

export const fetchWrapper = <R = unknown, ER = unknown>(
  fetchable: ReturnType<typeof fetch>
): ResultAsync<{ status: number; data: R }, FetchWrapperError<ER>> =>
  resolveFetch(fetchable).andThen((response) =>
    getResponseText(response)
      .andThen((text) =>
        parseJSON<R>(text).mapErr(
          (error): FailedToParseResponseToJsonError => ({
            status: response.status,
            reason: ErrorReason.FailedToParseResponseToJson,
            jsError: error,
            data: text,
          })
        )
      )
      .andThen((data) =>
        response.ok
          ? okAsync({
              status: response.status,
              data: data as R,
            })
          : errAsync({
              status: response.status,
              reason: ErrorReason.RequestStatusNotOk,
              data: data as unknown as ER,
            } satisfies ErrorResponse<ER>)
      )
  )
