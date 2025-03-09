import {
  createTransactionStream,
  TransactionStreamError,
} from 'radix-transaction-stream'

const transactionStream = createTransactionStream({
  debug: true,
  logLevel: 'debug',
})

const main = async () => {
  while (true) {
    const result = await transactionStream.next()

    if (result.isErr()) {
      if (
        'parsedError' in result.error &&
        result.error.parsedError ===
          TransactionStreamError.StateVersionBeyondEndOfKnownLedger
      ) {
        console.log(
          'State version beyond end of known ledger, chill a bit and retry',
        )
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } else {
        console.error(JSON.stringify(result.error, null, 2))
      }
    } else {
      if (result.value.transactions.length > 0) {
        console.log(
          `stateVersion: ${result.value.stateVersion}, found ${result.value.transactions.length} transactions`,
        )
      }
    }
  }
}

main()
