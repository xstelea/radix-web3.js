import { assert, describe, it } from 'vitest';

import { decrypt, encrypt } from './encryption';
import { transformToSealbox } from './sealbox';

describe('crypto encryption helpers', () => {
  it('round trips encrypted bytes with an explicit IV', async () => {
    const data = new TextEncoder().encode('wallet response payload');
    const encryptionKey = new Uint8Array(32).fill(7);
    const iv = new Uint8Array(12).fill(3);

    const encrypted = await encrypt(data, encryptionKey, iv);
    const sealbox = transformToSealbox(encrypted.combined);
    const decrypted = await decrypt({
      data: sealbox.cipherTextAndAuthTag,
      encryptionKey,
      iv: sealbox.iv,
    });

    assert.deepEqual(decrypted, data);
    assert.deepEqual(sealbox.iv, iv);
    assert.strictEqual(sealbox.authTag.length, 16);
  });
});
