import { typedError } from './typedError'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'

export const parseJSON = <T = any>(text: string): Result<T, Error> => {
  try {
    return ok(JSON.parse(text))
  } catch (error) {
    const _typedError = typedError(error)
    return err(_typedError)
  }
}
