import bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { toHex } from './helpers';
import { secureRandom } from './secureRandom';

export const RADIX_KEY_TYPE = {
  TRANSACTION_SIGNING: 1460,
  AUTHENTICATION_SIGNING: 1678,
  MESSAGE_ENCRYPTION: 1391,
} as const;

export const RADIX_ENTITY_TYPE = {
  ACCOUNT: 525,
  IDENTITY: 618,
} as const;

/**
 * Generates a BIP39 derivation path for Radix Ed25519 keys
 * @param networkId - The network ID (e.g. 1 for mainnet, 2 for stokenet)
 * @param keyType - The type of key (TRANSACTION_SIGNING, AUTHENTICATION_SIGNING, or MESSAGE_ENCRYPTION)
 * @param entityType - The type of entity (ACCOUNT or IDENTITY)
 * @param index - The index of the key (defaults to 0)
 * @returns A BIP39 derivation path string
 *
 * Example:
 * m/44'/1022'/1'/525'/1460'/0'
 */
export const getRadixBIP39DerivationPath = ({
  networkId,
  keyType,
  entityType,
  index = 0,
}: {
  networkId: number;
  keyType: keyof typeof RADIX_KEY_TYPE;
  entityType: keyof typeof RADIX_ENTITY_TYPE;
  index?: number;
}) =>
  `m/44'/1022'/${networkId}'/${RADIX_ENTITY_TYPE[entityType]}'/${RADIX_KEY_TYPE[keyType]}'/${index}'`;

export const generateBIP39Mnemonic = (byteCount = 32) =>
  bip39.entropyToMnemonic(toHex(secureRandom(byteCount)));

/**
 * Converts a BIP39 mnemonic phrase to a private key using a derivation path.
 * Optionally uses a password for seed generation.
 * @param mnemonic - The BIP39 mnemonic phrase (12 or 24 words).
 * @param password - Optional password for seed generation.
 * @param derivationPath - The BIP39 derivation path (e.g. m/44'/1022'/1'/525'/1460'/0').
 * @returns A promise that resolves to a hex-encoded private key.
 */
export const mnemonicToPrivateKey = async ({
  mnemonic,
  password,
  derivationPath,
}: {
  mnemonic: string;
  password?: string;
  derivationPath: string;
}) =>
  bip39
    .mnemonicToSeed(mnemonic, password)
    .then((seedBuffer) => seedBuffer.toString('hex'))
    .then((seedHex) => derivePath(derivationPath, seedHex))
    .then((childKey) => childKey.key.toString('hex'));
