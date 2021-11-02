export type QueryArgs = Record<string, any>;
export type QueryAttrs = Record<string, any>;
export type QueryBuilder = (
  args?: QueryArgs,
  attrs?: QueryAttrs
) => Record<string, any>;

export enum PoolType {
  Weighted = 'Weighted',
  Investment = 'Investment',
  Stable = 'Stable',
  MetaStable = 'MetaStable',
  LiquidityBootstrapping = 'LiquidityBootstrapping'
}
export type TimeTravelPeriod = '24h';

export interface PoolToken {
  address: string;
  balance: string;
  weight: string;
  priceRate: string | null;
}

export interface Pool {
  id: string;
  address: string;
  poolType: PoolType;
  swapFee: string;
  owner: string;
  factory: string;
  tokens: PoolToken[];
  tokensList: string[];
  tokenAddresses: string[];
  totalLiquidity: string;
  totalShares: string;
  totalSwapFee: string;
  totalSwapVolume: string;
  hasLiquidityMiningRewards: boolean;
  onchain?: OnchainPoolData;
  createTime: number;
}

export interface DecoratedPool extends Pool {
  dynamic: {
    period: TimeTravelPeriod;
    volume: string;
    apr: {
      pool: string;
      thirdParty: string;
      liquidityMining: string;
      liquidityMiningBreakdown: { [address: string]: string };
      total: string;
    };
    fees: string;
    isNewPool: boolean;
  };
}

export interface OnchainTokenData {
  balance: string;
  weight: number;
  decimals: number;
  logoURI: string;
  name: string;
  symbol: string;
}

export interface OnchainPoolData {
  tokens: Record<string, OnchainTokenData>;
  totalSupply: string;
  decimals: number;
  swapFee: string;
  amp?: string;
  swapEnabled: boolean;
}

export interface FullPool extends DecoratedPool {
  onchain: OnchainPoolData;
}

export type AnyPool = Pool | FullPool | DecoratedPoolWithShares;

export interface PoolShare {
  poolId: {
    id: string;
  };
  balance: string;
}

export interface DecoratedPoolWithShares extends DecoratedPool {
  shares: string;
}

export type PoolActivityType = 'Join' | 'Exit';

export interface PoolActivity {
  amounts: string[];
  timestamp: number;
  tx: string;
  type: PoolActivityType;
}

export interface PoolSwap {
  tokenIn: string;
  tokenOut: string;
  tokenAmountIn: string;
  tokenAmountOut: string;
  timestamp: number;
  tx: string;
}

export interface PoolSnapshot {
  pool: {
    id: string;
  };
  timestamp: number;
  amounts: string[];
  totalShares: string;
  swapVolume: string;
  swapFees: string;
}

export type PoolSnapshots = Record<number, PoolSnapshot>;

export type TradePairSnapshot = {
  timestamp: number;
  totalSwapFee: string;
  totalSwapVolume: string;
  pair: {
    token0: {
      symbol: string;
      address: string;
    };
    token1: {
      symbol: string;
      address: string;
    };
  };
};
