export default function useTokens() {
  return {
    injectTokens: jest.fn().mockImplementation(),
    priceFor: jest.fn().mockImplementation(),
    getToken: jest.fn().mockImplementation(address => {
      const mockTokens = {
        '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2': {
          symbol: 'MKR'
        },
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
          symbol: 'WETH'
        },
        '0xdac17f958d2ee523a2206206994597c13d831ec7': {
          symbol: 'USDT'
        }
      };
      return mockTokens[address];
    })
  };
}
