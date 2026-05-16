# Radix Web3.js

JavaScript and TypeScript packages for building Radix applications, wallet
connections, Gateway integrations, transaction workflows, and agent-friendly
tooling.

## Documentation

- [Docs site](https://xstelea.github.io/radix-web3.js/)

## Packages


| Package                             | Path                                                         | Description                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `radix-web3.js`                     | [packages/core](./packages/core)                             | Core Radix client utilities for accounts, keypairs, manifests, balances, and transaction submission.                     |
| `radix-connect`                     | [packages/connect](./packages/connect)                       | TypeScript client for encrypted Radix Wallet interactions through Radix Connect Relay.                                   |
| `@radix-effects/gateway`            | [packages/gateway](./packages/gateway)                       | Effect-based Radix Gateway API client for Node.js and browser runtimes.                                                  |
| `@radix-effects/tx-tool`            | [packages/tx-tool](./packages/tx-tool)                       | Effect transaction helpers for building, analyzing, previewing, signing, submitting, and tracking Radix transactions.    |
| `@radix-effects/transaction-stream` | [packages/transaction-stream](./packages/transaction-stream) | Effect stream utilities for polling and processing Radix Gateway transaction history.                                    |
| `rdx-cli`                           | [packages/cli](./packages/cli)                               | Agent-first CLI for Transaction Manifest V2 workflows, subintents, out-of-band signing, and transaction status tracking. |
| `radix-agent-toolkit`               | [packages/agent-toolkit](./packages/agent-toolkit)           | GOAT SDK wallet integration for exposing Radix account and transaction tools to agents.                                  |
| `sbor-ez-mode`                      | [packages/sbor-ez-mode](./packages/sbor-ez-mode)             | Small schema builder for parsing and working with Radix SBOR-shaped values.                                              |
| `@radix-effects/shared`             | [packages/shared](./packages/shared)                         | Shared Effect schemas and branded types used by the Radix Effects packages.                                              |


## Apps


| App  | Path                     | Description                                       |
| ---- | ------------------------ | ------------------------------------------------- |
| Docs | [apps/docs](./apps/docs) | Docusaurus documentation site for the repository. |


