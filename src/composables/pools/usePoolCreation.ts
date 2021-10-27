import { ref, reactive, toRefs, watch } from 'vue';
import useTokens from '@/composables/useTokens';
import useWeb3 from '@/services/web3/useWeb3';
import { poolCreator } from '@/services/pool-creator/pool-creator.service';
import BigNumber from 'bignumber.js';

export type TokenWeight = {
  tokenAddress: string;
  weight: number;
  isLocked: boolean;
  id: number;
};

type FeeManagementType = 'governance' | 'fixed' | 'address' | 'self';

const poolCreationState = reactive({
  tokenWeights: [] as TokenWeight[],
  activeStep: 0,
  initialFee: '0',
  isFeeGovManaged: false,
  feeManagementType: 'governance' as FeeManagementType,
  thirdPartyFeeController: ''
});

export default function usePoolCreation() {
  const { getToken } = useTokens();
  const { getProvider } = useWeb3();

  const updateTokenWeights = (weights: TokenWeight[]) => {
    poolCreationState.tokenWeights = weights;
  };

  const proceed = () => {
    poolCreationState.activeStep += 1;
  };

  const setFeeManagement = (type: FeeManagementType) => {
    poolCreationState.feeManagementType = type;
  };

  const getPoolSymbol = (): string => {
    const tokenSymbols = poolCreationState.tokenWeights.map(
      (token: TokenWeight) => {
        const weightRounded = Math.round(token.weight);
        const tokenInfo = getToken(token.tokenAddress);
        return `${Math.round(weightRounded)}${tokenInfo.symbol}`;
      }
    );

    return tokenSymbols.join('-');
  };

  const createPool = () => {
    const provider = getProvider();
    poolCreator.createWeightedPool(
      provider,
      'MyPool',
      getPoolSymbol(),
      '0.01',
      poolCreationState.tokenWeights,
      poolCreationState.thirdPartyFeeController
    );
  };

  watch(
    () => poolCreationState.feeManagementType,
    () => {
      console.log('esh', poolCreationState.feeManagementType);
    }
  );

  return {
    ...toRefs(poolCreationState),
    updateTokenWeights,
    proceed,
    setFeeManagement,
    getPoolSymbol,
    createPool
  };
}
