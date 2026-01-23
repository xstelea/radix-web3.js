export const RadixNetworkId = {
  Mainnet: 1,
  Stokenet: 2,
  Alphanet: 10,
  Betanet: 11,
  Kisharnet: 12,
  RCnetV1: 12,
  Zabanet: 14,
  RCnetV3: 14,
  Gilganet: 32,
  Enkinet: 33,
  Hammunet: 34,
  Nergalnet: 35,
  Mardunet: 36,
  Dumunet: 37,
} as const;

const RadixNetwork = {
  Mainnet: {
    networkName: 'Mainnet',
    networkId: RadixNetworkId.Mainnet,
    gatewayUrl: 'https://mainnet.radixdlt.com',
    dashboardUrl: 'https://dashboard.radixdlt.com',
  },
  Stokenet: {
    networkName: 'Stokenet',
    networkId: RadixNetworkId.Stokenet,
    gatewayUrl: 'https://stokenet.radixdlt.com',
    dashboardUrl: 'https://stokenet-dashboard.radixdlt.com',
  },
  Kisharnet: {
    networkName: 'Kisharnet',
    networkId: RadixNetworkId.Kisharnet,
    gatewayUrl: 'https://kisharnet-gateway.radixdlt.com',
    dashboardUrl: 'https://kisharnet-dashboard.radixdlt.com',
  },
  RCnetV1: {
    networkName: 'RCnetV1',
    networkId: RadixNetworkId.RCnetV1,
    gatewayUrl: 'https://rcnet.radixdlt.com',
    dashboardUrl: 'https://rcnet-dashboard.radixdlt.com',
  },
  Mardunet: {
    networkName: 'Mardunet',
    networkId: RadixNetworkId.Mardunet,
    gatewayUrl: 'https://mardunet-gateway.radixdlt.com',
    dashboardUrl: 'https://mardunet-dashboard.rdx-works-main.extratools.works',
  },
  Zabanet: {
    networkName: 'Zabanet',
    networkId: RadixNetworkId.Zabanet,
    gatewayUrl: 'https://zabanet-gateway.radixdlt.com',
    dashboardUrl: 'https://rcnet-v3-dashboard.radixdlt.com',
  },
  RCnetV3: {
    networkName: 'RCNetV3',
    networkId: RadixNetworkId.RCnetV3,
    gatewayUrl: 'https://zabanet-gateway.radixdlt.com',
    dashboardUrl: 'https://rcnet-v3-dashboard.radixdlt.com',
  },
  Gilganet: {
    networkName: 'Gilganet',
    networkId: RadixNetworkId.Gilganet,
    gatewayUrl: 'https://gilganet-gateway.radixdlt.com',
    dashboardUrl: 'https://gilganet-dashboard.rdx-works-main.extratools.works',
  },
  Enkinet: {
    networkName: 'Enkinet',
    networkId: RadixNetworkId.Enkinet,
    gatewayUrl: 'https://enkinet-gateway.radixdlt.com',
    dashboardUrl: 'https://enkinet-dashboard.rdx-works-main.extratools.works',
  },
  Hammunet: {
    networkName: 'Hammunet',
    networkId: RadixNetworkId.Hammunet,
    gatewayUrl: 'https://hammunet-gateway.radixdlt.com',
    dashboardUrl: 'https://hammunet-dashboard.rdx-works-main.extratools.works',
  },
  Dumunet: {
    networkName: 'Dumunet',
    networkId: RadixNetworkId.Dumunet,
    gatewayUrl: 'https://dumunet-gateway.radixdlt.com',
    dashboardUrl: 'https://dumunet-dashboard.rdx-works-main.extratools.works',
  },
} as const;

export const getRadixGatewayBaseUrl = (
  networkId: keyof typeof RadixNetwork = 'Mainnet',
) => RadixNetwork[networkId].gatewayUrl;
