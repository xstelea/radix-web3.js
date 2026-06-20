import { assert, describe, it } from '@effect/vitest';
import { Schema } from 'effect';

import {
  PLACEHOLDER_PUBLIC_KEY_HEX,
  PLACEHOLDER_SIGNATURE_HEX,
  SignatureFileSchema,
  SignatureTemplateSchema,
  SigningRequestSchema,
  SubintentsFileSchema,
} from './schemas';
import { workflowTemplate } from './templates';

describe('workflow templates', () => {
  it('creates valid subintents file templates', () => {
    const template = workflowTemplate('subintents');

    assert.deepEqual(
      Schema.decodeUnknownSync(SubintentsFileSchema)(template),
      template,
    );
  });

  it('creates valid signing request templates', () => {
    const template = workflowTemplate('signing-request');

    assert.deepEqual(
      Schema.decodeUnknownSync(SigningRequestSchema)(template),
      template,
    );
  });

  it('creates valid signature response templates', () => {
    const signatureTemplate = workflowTemplate('signature-template');
    const signatureFile = workflowTemplate('signature-file');

    const decodedTemplate = Schema.decodeUnknownSync(SignatureTemplateSchema)(
      signatureTemplate,
    );
    const decodedSignatureFile =
      Schema.decodeUnknownSync(SignatureFileSchema)(signatureFile);

    assert.deepEqual(decodedTemplate, signatureTemplate);
    assert.strictEqual(
      decodedTemplate.publicKey.hex,
      PLACEHOLDER_PUBLIC_KEY_HEX,
    );
    assert.strictEqual(
      decodedTemplate.signature.hex,
      PLACEHOLDER_SIGNATURE_HEX,
    );
    assert.deepEqual(decodedSignatureFile, signatureFile);
    assert.isEmpty(decodedSignatureFile.signatures);
  });
});
