import { okAsync, ResultAsync } from 'neverthrow'
import { RadixNetworkClient } from 'radix-web3.js'
import { Logger } from './logger'

export type StateVersionManager = ReturnType<typeof createStateVersionManager>

export const createStateVersionManager = ({
  gatewayApi,
  startStateVersion,
  logger,
}: {
  gatewayApi: RadixNetworkClient
  startStateVersion?: number
  logger?: Logger
}) => {
  let stateVersion = startStateVersion

  const getStateVersion = () =>
    stateVersion ? okAsync(stateVersion) : getCurrentStateVersion()

  const getCurrentStateVersion = () =>
    ResultAsync.fromPromise(gatewayApi.getCurrentStateVersion(), (error) => ({
      reason: 'Failed to get current state version',
      method: 'getLatestStateVersion',
      error,
    }))

  return {
    getStateVersion,
    setStateVersion: (value: number) => {
      if (value !== stateVersion) {
        logger?.debug(`setting new state version: ${value}`)
        stateVersion = value
      }
    },
  }
}
