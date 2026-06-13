import { it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { describe, expect } from 'vitest';

import {
  SignatureFileSchema,
  SignatureTemplateSchema,
  SigningRequestSchema,
  SubintentsFileSchema,
} from './schemas';
import { workflowTemplate } from './templates';

describe('workflow templates', () => {
  it.effect('creates valid subintents file templates', () =>
    Effect.sync(() => {
      const template = workflowTemplate('subintents');

      expect(Schema.decodeUnknownSync(SubintentsFileSchema)(template)).toEqual(
        template,
      );
    }),
  );

  it.effect('creates valid signing request templates', () =>
    Effect.sync(() => {
      const template = workflowTemplate('signing-request');

      expect(Schema.decodeUnknownSync(SigningRequestSchema)(template)).toEqual(
        template,
      );
    }),
  );

  it.effect('creates valid signature response templates', () =>
    Effect.sync(() => {
      const signatureTemplate = workflowTemplate('signature-template');
      const signatureFile = workflowTemplate('signature-file');

      expect(
        Schema.decodeUnknownSync(SignatureTemplateSchema)(signatureTemplate),
      ).toEqual(signatureTemplate);
      expect(
        Schema.decodeUnknownSync(SignatureFileSchema)(signatureFile),
      ).toEqual(signatureFile);
    }),
  );
});
