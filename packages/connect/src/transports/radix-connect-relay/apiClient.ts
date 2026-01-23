export type RadixConnectRelayApiClient = ReturnType<
  typeof createRadixConnectRelayApiClient
>;

export type RadixConnectRelaySuccessResponse = {
  sessionId: string;
  publicKey: string;
  data: string;
};

export type RadixConnectRelayErrorResponse = {
  sessionId: string;
  error: string;
};

export type RadixConnectRelayResponse =
  | RadixConnectRelaySuccessResponse
  | RadixConnectRelayErrorResponse;

export const createRadixConnectRelayApiClient = (input: {
  baseUrl: string;
}) => {
  const getResponses = (sessionId: string) =>
    fetch(input.baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        method: 'getResponses',
        sessionId,
      }),
    })
      .then((response) => response.json())
      .then((data): RadixConnectRelayResponse[] => data);

  return {
    getResponses,
  };
};
