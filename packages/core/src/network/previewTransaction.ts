import {
  TransactionPreviewOperationRequest,
  PublicKey as GatewayPublicKey,
  GatewayApiClient,
} from '@radixdlt/babylon-gateway-api-sdk'
import {
  Intent,
  PublicKey,
  RadixEngineToolkit,
} from '@radixdlt/radix-engine-toolkit'

export type PartialTransactionPreviewResponse = {
  receipt: {
    status: 'Succeeded' | 'Failed' | 'Rejected'
    fee_summary: {
      execution_cost_units_consumed: number
      finalization_cost_units_consumed: number
      xrd_total_execution_cost: string
      xrd_total_finalization_cost: string
      xrd_total_royalty_cost: string
      xrd_total_storage_cost: string
      xrd_total_tipping_cost: string
    }
  }
}

const retPublicKeyToGatewayPublicKey = (
  publicKey: PublicKey,
): GatewayPublicKey => {
  switch (publicKey.curve) {
    case 'Secp256k1':
      return {
        key_type: 'EcdsaSecp256k1',
        key_hex: publicKey.hex(),
      }
    case 'Ed25519':
      return {
        key_type: 'EddsaEd25519',
        key_hex: publicKey.hex(),
      }
  }
}

export const previewTransactionFactory =
  ({
    networkId,
    gatewayApiClient,
  }: {
    networkId: number
    gatewayApiClient: GatewayApiClient
  }) =>
  async ({
    intent,
    signerPublicKeys,
    blobsHex = [],
  }: {
    intent: Intent
    signerPublicKeys: PublicKey[]
    blobsHex?: string[]
  }) => {
    // Translate the RET models to the gateway models for preview.
    const request: TransactionPreviewOperationRequest = {
      transactionPreviewRequest: {
        manifest: await RadixEngineToolkit.Instructions.convert(
          intent.manifest.instructions,
          networkId,
          'String',
        ).then((instructions) => instructions.value as string),
        blobs_hex: blobsHex,
        start_epoch_inclusive: intent.header.startEpochInclusive,
        end_epoch_exclusive: intent.header.endEpochExclusive,
        notary_public_key: retPublicKeyToGatewayPublicKey(
          intent.header.notaryPublicKey,
        ),
        notary_is_signatory: intent.header.notaryIsSignatory,
        tip_percentage: intent.header.tipPercentage,
        nonce: intent.header.nonce,
        signer_public_keys: signerPublicKeys.map(
          retPublicKeyToGatewayPublicKey,
        ),
        // TODO: Add message
        flags: {
          assume_all_signature_proofs: false,
          skip_epoch_check: false,
          use_free_credit: false,
        },
      },
    }

    return gatewayApiClient.transaction.innerClient
      .transactionPreview(request)
      .then((response) => response as PartialTransactionPreviewResponse)
  }
