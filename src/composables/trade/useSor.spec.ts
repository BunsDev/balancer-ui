import { ref, computed } from 'vue';
import { mount } from 'vue-composable-tester';
import { BigNumber } from '@ethersproject/bignumber';

import useSor from '@/composables/trade/useSor';
import { configService } from '@/services/config/config.service';
import { mocked } from 'ts-jest/utils';
import { SorManager } from '@/lib/utils/balancer/helpers/sor/sorManager';
import { rpcProviderService } from '@/services/rpc-provider/rpc-provider.service';
import OldBigNumber from 'bignumber.js';

jest.mock('vue-i18n');
jest.mock('vuex');
jest.mock('@/composables/useEthereumTxType');
jest.mock('@/composables/useEthers');
jest.mock('@/composables/useUserSettings');
jest.mock('@/composables/useTransactions');
jest.mock('@/lib/utils/balancer/helpers/sor/sorManager');
jest.mock('@/locales');
jest.mock('@/services/web3/useWeb3');
jest.mock('@/services/rpc-provider/rpc-provider.service');

const mockNativeAssetAddress = configService.network.nativeAsset.address;
const mockEthPrice = 3000;
const mockTokenPrice = 0.2;

jest.mock('@/composables/useTokens', () => {
  return jest.fn().mockImplementation(() => {
    return {
      injectTokens: jest.fn().mockImplementation(),
      priceFor: jest.fn().mockImplementation(address => {
        if (address === mockNativeAssetAddress) {
          return mockEthPrice;
        }
        return mockTokenPrice;
      }),
      useTokens: jest.fn().mockImplementation()
    };
  });
});

const mockTokenInfo = {
  chainId: 1,
  address: '0x0',
  name: 'mockTokenIn',
  decimals: 18,
  symbol: 'MTI'
};

const computedMockTokenInfo = computed(() => mockTokenInfo);

const mockProps = {
  exactIn: ref(false),
  tokenInAddressInput: ref('0x0'),
  tokenInAmountInput: ref('1'),
  tokenOutAddressInput: ref('0x0'),
  tokenOutAmountInput: ref('1'),
  tokens: ref({}),
  wrapType: ref(0),
  tokenIn: computedMockTokenInfo,
  tokenOut: computedMockTokenInfo,
  slippageBufferRate: computed(() => 1)
};

describe('useSor', () => {
  it('Should load', () => {
    const { result } = mount(() => useSor(mockProps));
    expect(result).toBeTruthy();
  });
});

describe('setSwapCost', () => {
  const sorManager = new SorManager(
    false,
    rpcProviderService.jsonProvider,
    BigNumber.from(1),
    1,
    1,
    '1',
    'source',
    'sg'
  );

  const mockedSorManager = mocked(sorManager);

  beforeEach(() => {
    mockedSorManager.setCostOutputToken.mockClear();
  });

  it('Should pass a correct gas price to sorManager', async () => {
    const { result: sor } = mount(() => useSor(mockProps));

    const tokenAddress = '0x0';
    const tokenDecimals = 5;
    const expectedTokenPriceInEth = new OldBigNumber(
      mockEthPrice / mockTokenPrice
    ).toString();

    await sor.setSwapCost(tokenAddress, tokenDecimals, mockedSorManager as any);
    expect(mockedSorManager.setCostOutputToken).toBeCalledWith(
      tokenAddress,
      tokenDecimals,
      expectedTokenPriceInEth
    );
  });
});
