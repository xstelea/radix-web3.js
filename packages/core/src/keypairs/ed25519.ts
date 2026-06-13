import { type Bytes, PrivateKey } from '@steleaio/radix-engine-toolkit';

import { randomBytes } from './helpers/randomBytes';

export const createEd25519KeyPair = (privateKey: Bytes = randomBytes(32)) =>
  new PrivateKey.Ed25519(privateKey);
