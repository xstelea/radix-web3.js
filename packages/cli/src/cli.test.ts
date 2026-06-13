import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { runRdx } from './index';
import { SignatureFileSchema } from './schemas';

const stokenetFaucetManifest =
  'CALL_METHOD Address("component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl") "lock_fee" Decimal("10"); CALL_METHOD Address("component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl") "free"; CALL_METHOD Address("account_tdx_2_1284vgk4yrqj7p0plsa2hptcxrt9lpw2s446jlu8egcl7zwk4wzg36g") "try_deposit_batch_or_abort" Expression("ENTIRE_WORKTOP") Enum<0u8>();';

describe('rdx command interface', () => {
  it('prints JSON command results by default', async () => {
    const result = await runRdx({ argv: ['config', 'show'], cwd: '/' });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      type: 'commandResult',
      command: 'config show',
      network: 'mainnet',
      artifactScope: 'local',
    });
    expect(result.stderr).toBe('');
  });

  it('prints text only when requested', async () => {
    const result = await runRdx({
      argv: ['--format', 'text', 'config', 'show'],
      cwd: '/',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('network: mainnet');
    expect(() => JSON.parse(result.stdout)).toThrow();
  });

  it('prints compact Markdown instructions for agents', async () => {
    const result = await runRdx({ argv: ['llm'], cwd: '/' });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('# rdx Agent Guide');
    expect(result.stdout).toContain('rdx tx prepare --manifest');
    expect(result.stdout).toContain(
      'v1 CLI workflow files support Ed25519 only',
    );
    expect(result.stdout).toContain(
      '`rdx` never stores, accepts, or derives private keys',
    );
    expect(result.stdout).toContain('## Standalone Subintent Lifecycle');
    expect(result.stdout).toContain(
      'rdx subintent prepare --manifest <subintent.rtm> --header <header.json> --root-manifest <root.rtm>',
    );
    expect(result.stdout).toContain('signedPartialTransactionHex');
    expect(() => JSON.parse(result.stdout)).toThrow();
  });

  it('prints structured JSON errors by default', async () => {
    const result = await runRdx({ argv: ['unknown'], cwd: '/' });

    expect(result.exitCode).toBe(64);
    expect(JSON.parse(result.stderr)).toMatchObject({
      type: 'error',
      code: 'UNKNOWN_COMMAND',
      message: 'Unknown command: unknown',
    });
    expect(result.stdout).toBe('');
  });

  it('prints resolved project config', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-'));
    await writeFile(
      join(cwd, '.rdxconfig.json'),
      JSON.stringify({ network: 'stokenet', artifactScope: 'global' }),
      'utf8',
    );

    const result = await runRdx({ argv: ['config', 'show'], cwd });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      network: 'stokenet',
      artifactScope: 'global',
    });
  });

  it('derives a virtual account address from an Ed25519 public key', async () => {
    const publicKeyHex = '1'.repeat(64);
    const result = await runRdx({
      argv: ['account', 'derive', '--public-key', publicKeyHex],
      cwd: '/',
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      type: 'commandResult',
      command: 'account derive',
      network: 'mainnet',
      derivation: 'virtualAccount',
      publicKey: { curve: 'Ed25519', hex: publicKeyHex },
    });
    expect(JSON.parse(result.stdout).accountAddress).toMatch(/^account_rdx1/);
  });

  it('prints only the derived account address in text mode', async () => {
    const result = await runRdx({
      argv: [
        '--format',
        'text',
        'account',
        'derive',
        '--public-key',
        '1'.repeat(64),
      ],
      cwd: '/',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^account_rdx1/);
    expect(result.stdout.trim()).not.toContain('{');
  });

  it('rejects invalid public keys for account derivation', async () => {
    const result = await runRdx({
      argv: ['account', 'derive', '--public-key', 'not-a-public-key'],
      cwd: '/',
    });

    expect(result.exitCode).toBe(64);
    expect(JSON.parse(result.stderr)).toMatchObject({
      type: 'error',
      code: 'INVALID_PUBLIC_KEY',
    });
    expect(result.stdout).toBe('');
  });

  it('derives account addresses on the resolved config network', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-account-derive-'));
    await writeFile(
      join(cwd, '.rdxconfig.json'),
      JSON.stringify({ network: 'stokenet' }),
      'utf8',
    );

    const result = await runRdx({
      argv: ['account', 'derive', '--public-key', '1'.repeat(64)],
      cwd,
    });

    const output = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(output.network).toBe('stokenet');
    expect(output.accountAddress).toMatch(/^account_tdx_2_1/);
  });

  it('does not keep the unreleased account balance command alias', async () => {
    const result = await runRdx({
      argv: ['account', 'balance', 'account_rdx1...'],
      cwd: '/',
    });

    expect(result.exitCode).toBe(64);
    expect(JSON.parse(result.stderr)).toMatchObject({
      type: 'error',
      code: 'UNKNOWN_COMMAND',
    });
    expect(result.stdout).toBe('');
  });

  it('prints transaction artifact paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-path-'));
    await writePreparedArtifact({
      cwd,
      transactionId: 'txid_1',
      network: 'mainnet',
      intentHash: 'intent_1',
      manifestSourceFile: 'root.rtm',
    });

    const result = await runRdx({ argv: ['tx', 'path', 'txid_1'], cwd });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      type: 'commandResult',
      command: 'tx path',
      transactionId: 'txid_1',
      artifactPath: join(cwd, '.rdx', 'transactions', 'txid_1'),
    });
  });

  it('prints filtered transaction artifact lists', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-list-'));
    await writePreparedArtifact({
      cwd,
      transactionId: 'txid_1',
      network: 'mainnet',
      intentHash: 'intent_alpha',
      manifestSourceFile: 'alpha.rtm',
    });
    await writePreparedArtifact({
      cwd,
      transactionId: 'txid_2',
      network: 'stokenet',
      intentHash: 'intent_beta',
      manifestSourceFile: 'beta.rtm',
    });

    const result = await runRdx({
      argv: ['tx', 'list', '--pattern', 'beta', '--network', 'stokenet'],
      cwd,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      type: 'commandResult',
      command: 'tx list',
      artifacts: [
        {
          transactionId: 'txid_2',
          network: 'stokenet',
          manifestSourceFile: 'beta.rtm',
        },
      ],
    });
  });

  it('prints workflow templates', async () => {
    const result = await runRdx({
      argv: ['template', 'print', 'signature-file'],
      cwd: '/',
    });

    expect(result.exitCode).toBe(0);
    expect(
      Schema.decodeUnknownSync(SignatureFileSchema)(JSON.parse(result.stdout)),
    ).toMatchObject({
      type: 'signatureFile',
      version: 1,
    });
  });

  it('prepares transaction artifacts from workflow files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-prepare-'));
    const manifestPath = join(cwd, 'root.rtm');
    const notaryFilePath = join(cwd, 'notary.json');
    await writeFile(manifestPath, stokenetFaucetManifest, 'utf8');
    await writeFile(
      join(cwd, '.rdxconfig.json'),
      JSON.stringify({ network: 'stokenet' }),
      'utf8',
    );
    await writeFile(
      notaryFilePath,
      JSON.stringify({
        type: 'notary',
        version: 1,
        publicKey: {
          curve: 'Ed25519',
          hex: '1111111111111111111111111111111111111111111111111111111111111111',
        },
      }),
      'utf8',
    );

    const result = await runRdx({
      argv: [
        'tx',
        'prepare',
        '--manifest',
        manifestPath,
        '--notary-file',
        notaryFilePath,
      ],
      cwd,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      type: 'commandResult',
      command: 'tx prepare',
      startEpochInclusive: 1,
      endEpochExclusive: 10,
    });
  });

  it('prepares transaction artifacts with notary settings from config', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-config-notary-'));
    const manifestPath = join(cwd, 'root.rtm');
    await writeFile(manifestPath, stokenetFaucetManifest, 'utf8');
    await writeFile(
      join(cwd, '.rdxconfig.json'),
      JSON.stringify({
        network: 'stokenet',
        notary: {
          publicKey: {
            curve: 'Ed25519',
            hex: '2'.repeat(64),
          },
          notaryIsSignatory: false,
        },
      }),
      'utf8',
    );

    const result = await runRdx({
      argv: ['tx', 'prepare', '--manifest', manifestPath],
      cwd,
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    const prepared = JSON.parse(await readFile(output.preparedPath, 'utf8'));
    expect(prepared).toMatchObject({
      notaryPublicKey: { curve: 'Ed25519', hex: '2'.repeat(64) },
      notaryIsSignatory: false,
    });
  });

  it('prepares direct child subintents from workflow files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-subintents-'));
    const manifestPath = join(cwd, 'root.rtm');
    const notaryFilePath = join(cwd, 'notary.json');
    const subintentsPath = join(cwd, 'subintents.json');
    await writeFile(
      manifestPath,
      `${stokenetFaucetManifest}\nYIELD_TO_CHILD NamedIntent("child_one");`,
      'utf8',
    );
    await writeFile(
      join(cwd, '.rdxconfig.json'),
      JSON.stringify({ network: 'stokenet' }),
      'utf8',
    );
    await writeFile(
      notaryFilePath,
      JSON.stringify({
        type: 'notary',
        version: 1,
        publicKey: {
          curve: 'Ed25519',
          hex: '1'.repeat(64),
        },
      }),
      'utf8',
    );
    await writeFile(
      subintentsPath,
      JSON.stringify({
        type: 'subintents',
        version: 1,
        subintents: {
          child_one: { manifest: 'YIELD_TO_PARENT;' },
        },
      }),
      'utf8',
    );

    const result = await runRdx({
      argv: [
        'tx',
        'prepare',
        '--manifest',
        manifestPath,
        '--notary-file',
        notaryFilePath,
        '--subintents',
        subintentsPath,
      ],
      cwd,
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    const prepared = JSON.parse(await readFile(output.preparedPath, 'utf8'));
    expect(prepared.subintentOrder).toEqual(['child_one']);
  });

  it('prepares and builds standalone subintent artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-subintent-'));
    const manifestPath = join(cwd, 'payment.rtm');
    const headerPath = join(cwd, 'subintent-header.json');
    await writeFile(manifestPath, 'YIELD_TO_PARENT;', 'utf8');
    await writeFile(
      headerPath,
      JSON.stringify({
        type: 'subintentHeader',
        version: 1,
        header: {
          networkId: 1,
          startEpochInclusive: 1,
          endEpochExclusive: 10,
          intentDiscriminator: 123,
        },
      }),
      'utf8',
    );

    const prepareResult = await runRdx({
      argv: [
        'subintent',
        'prepare',
        '--manifest',
        manifestPath,
        '--header',
        headerPath,
        '--no-preview',
      ],
      cwd,
    });

    expect(prepareResult.exitCode).toBe(0);
    const preparedOutput = JSON.parse(prepareResult.stdout);
    expect(preparedOutput).toMatchObject({
      type: 'commandResult',
      command: 'subintent prepare',
    });

    const signaturePath = join(cwd, 'signature.json');
    await writeFile(
      signaturePath,
      JSON.stringify({
        type: 'signatureFile',
        version: 1,
        transactionId: preparedOutput.subintentHash.id,
        signatures: [
          {
            scope: { kind: 'subintent', subintentId: 'root' },
            account: null,
            hash: preparedOutput.subintentHash,
            publicKey: { curve: 'Ed25519', hex: '1'.repeat(64) },
            signature: { curve: 'Ed25519', hex: '2'.repeat(128) },
          },
        ],
      }),
      'utf8',
    );

    const buildResult = await runRdx({
      argv: [
        'subintent',
        'build',
        '--prepared',
        preparedOutput.preparedPath,
        '--signature',
        signaturePath,
      ],
      cwd,
    });

    expect(buildResult.exitCode).toBe(0);
    expect(JSON.parse(buildResult.stdout)).toMatchObject({
      type: 'commandResult',
      command: 'subintent build',
      signedPartialTransactionHex: expect.stringMatching(/^[0-9a-f]+$/),
    });
  });

  it('creates notary signing artifacts from complete transaction artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rdx-cli-notarize-'));
    await writeCompleteNotarizeArtifact({ cwd, transactionId: 'txid_1' });

    const result = await runRdx({
      argv: ['tx', 'notarize', 'txid_1'],
      cwd,
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      type: 'commandResult',
      command: 'tx notarize',
      transactionId: 'txid_1',
    });
    const notaryTemplate = JSON.parse(
      await readFile(output.notarySignatureTemplatePath, 'utf8'),
    );
    expect(notaryTemplate).toMatchObject({
      scope: { kind: 'notary' },
      publicKey: { curve: 'Ed25519', hex: '1'.repeat(64) },
    });
  });
});

const writePreparedArtifact = async (input: {
  cwd: string;
  transactionId: string;
  network: 'mainnet' | 'stokenet';
  intentHash: string;
  manifestSourceFile: string;
}) => {
  const artifactPath = join(
    input.cwd,
    '.rdx',
    'transactions',
    input.transactionId,
  );
  await mkdir(artifactPath, { recursive: true });
  await writeFile(
    join(artifactPath, 'prepared.json'),
    JSON.stringify(
      {
        type: 'preparedTransaction',
        version: 1,
        transactionId: input.transactionId,
        network: input.network,
        intentHash: { id: input.intentHash, hex: 'aa' },
        manifestSourceFile: input.manifestSourceFile,
        transactionIntentPath: 'transactionIntent.json',
        staticAnalysisPath: 'staticAnalysis.json',
        signingRequests: [],
        signatureTemplates: [],
        subintentOrder: [],
        authorizationAnalysis: { rootIntent: [], subintents: {} },
      },
      null,
      2,
    ),
    'utf8',
  );
};

const writeCompleteNotarizeArtifact = async (input: {
  cwd: string;
  transactionId: string;
}) => {
  const artifactPath = join(
    input.cwd,
    '.rdx',
    'transactions',
    input.transactionId,
  );
  const requestPath = 'signing-requests/root/account_rdx1.json';
  const request = {
    type: 'signingRequest',
    version: 1,
    transactionId: input.transactionId,
    scope: { kind: 'rootIntent' },
    account: 'account_rdx1...',
    hash: { id: 'intent_1', hex: 'aa' },
    signingRequestPath: requestPath,
  };

  await mkdir(join(artifactPath, 'signing-requests', 'root'), {
    recursive: true,
  });
  await writeFile(
    join(artifactPath, 'prepared.json'),
    JSON.stringify(
      {
        type: 'preparedTransaction',
        version: 1,
        transactionId: input.transactionId,
        network: 'mainnet',
        intentHash: { id: 'intent_1', hex: 'aa' },
        manifestSourceFile: 'root.rtm',
        transactionIntentPath: 'transactionIntent.json',
        staticAnalysisPath: 'staticAnalysis.json',
        signingRequests: [requestPath],
        signatureTemplates: [],
        subintentOrder: [],
        authorizationAnalysis: { rootIntent: [], subintents: {} },
        notaryPublicKey: { curve: 'Ed25519', hex: '1'.repeat(64) },
        notaryIsSignatory: true,
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(artifactPath, requestPath),
    JSON.stringify(request, null, 2),
    'utf8',
  );
  await writeFile(
    join(artifactPath, 'transactionIntent.json'),
    JSON.stringify(
      {
        type: 'transactionIntent',
        version: 1,
        transactionId: input.transactionId,
        encoded: {
          kind: 'transactionIntentV2',
          value: {
            transactionHeader: {
              notaryPublicKey: '1'.repeat(64),
              notaryIsSignatory: true,
              tipBasisPoints: 0,
            },
            rootIntentCore: {
              header: {
                networkId: 2,
                startEpochInclusive: 1,
                endEpochExclusive: 10,
                intentDiscriminator: 0,
              },
              instructions: stokenetFaucetManifest,
              blobs: [],
              message: { kind: 'None' },
              children: [],
            },
            nonRootSubintents: [],
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(artifactPath, 'signatures.json'),
    JSON.stringify(
      {
        type: 'signatureFile',
        version: 1,
        transactionId: input.transactionId,
        signatures: [
          {
            scope: request.scope,
            account: request.account,
            hash: request.hash,
            signingRequestPath: request.signingRequestPath,
            publicKey: { curve: 'Ed25519', hex: '2'.repeat(64) },
            signature: { curve: 'Ed25519', hex: '3'.repeat(128) },
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
};
