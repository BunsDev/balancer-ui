import { Pool } from '@/services/balancer/subgraph/types';
import { Prices } from '@/services/coingecko';
import * as SDK from '@georgeroman/balancer-v2-pools';
import BigNumber from 'bignumber.js';
import { bnum, scale } from '@/lib/utils';

function stablePoolSpotPrice(
  amp: BigNumber,
  scaledBalances: BigNumber[],
  tokenIndexA: number,
  tokenIndexB: number
): BigNumber {
  let invariant: BigNumber;
  try {
    invariant = SDK.StableMath._calculateInvariant(amp, scaledBalances, true);
  } catch (err) {
    // There is an issue under investigation where one of the pools fails to converge when calculating invariant and this catches that case
    // console.error(`!!!!!!! EVM ISSUE`);
    return bnum(1);
  }
  const [balanceX, balanceY] = [
    scaledBalances[tokenIndexA],
    scaledBalances[tokenIndexB]
  ];

  const a = amp.times(2);
  const b = invariant.minus(invariant.times(a));
  const axy2 = a
    .times(2)
    .times(balanceX)
    .times(balanceY);

  const derivativeX = axy2
    .plus(a.times(balanceY).times(balanceY))
    .plus(b.times(balanceY));
  const derivativeY = axy2
    .plus(a.times(balanceX).times(balanceX))
    .plus(b.times(balanceX));

  return derivativeX.div(derivativeY);
}

export function getPoolLiquidity(pool: Pool, prices: Prices) {
  if (pool.poolType == 'Weighted') {
    const totalWeight = pool.tokens.reduce(
      (total, token) => total + parseFloat(token.weight),
      0
    );
    let sumWeight = 0;
    let sumValue = 0;

    for (let i = 0; i < pool.tokens.length; i++) {
      const token = pool.tokens[i];
      if (!prices[token.address]) {
        continue;
      }
      const price = prices[token.address].price;
      const balance = parseFloat(pool.tokens[i].balance);

      const value = balance * price;
      const weight = token.weight ? parseFloat(token.weight) : 0;
      sumValue = sumValue + value;
      sumWeight = sumWeight + weight;
    }
    if (sumWeight > 0) {
      const liquidity = (sumValue / sumWeight) * totalWeight;
      return liquidity.toString();
    } else {
      return '0';
    }
  }

  // Solidity maths uses precison method for amp that must be replicated
  const AMP_PRECISION = bnum(1000);
  const poolType: string = pool.poolType;

  if (poolType === 'Stable' || poolType === 'MetaStable') {
    let sumBalance = 0;
    let sumValue = 0;
    let refTokenIndex = 0;
    let refTokenPrice = 0;
    const balances: BigNumber[] = [];
    const balancesScaled: BigNumber[] = [];

    for (let i = 0; i < pool.tokens.length; i++) {
      const token = pool.tokens[i];
      let balance: BigNumber;
      if (poolType === 'Stable') balance = bnum(token.balance);
      else balance = bnum(token.balance).times(bnum(token.priceRate));

      balances.push(balance);
      // Stable maths must use 1e18 fixed point
      balancesScaled.push(scale(balance, 18));
      // if a token's price is unkown, ignore it
      // it will be computed at the next step
      if (!prices[token.address]) {
        continue;
      }
      const price = prices[token.address].price;
      refTokenIndex = i;
      refTokenPrice = price;

      const value = balance.toNumber() * price;
      sumValue = sumValue + value;
      sumBalance = sumBalance + balance.toNumber();
    }
    // if at least the partial value of the pool is known
    // then compute the rest of the value
    if (sumBalance > 0) {
      for (let i = 0; i < pool.tokens.length; i++) {
        const token = pool.tokens[i];
        // if a token's price is known, skip it
        // it has been taken into account in the prev step
        if (prices[token.address]) {
          continue;
        }

        const amp = bnum(pool.amp);
        // Solidity maths uses precison method for amp that must be replicated
        const ampAdjusted = amp.times(AMP_PRECISION);
        const spotPrice = stablePoolSpotPrice(
          ampAdjusted,
          balancesScaled,
          i,
          refTokenIndex
        );
        // TO DO - For Debug, Remove
        console.log(`!!!!!!! SP (${pool.poolType}): ${spotPrice.toString()}`);
        const value =
          balances[i].toNumber() * spotPrice.toNumber() * refTokenPrice; // TODO - requires some data type conversion?
        sumValue = sumValue + value;
        sumBalance = sumBalance + balances[i].toNumber();
      }
      // TO DO - For Debug, Remove
      console.log(`!!!!!!! RESULT: ${sumValue.toString()}`);
      return sumValue.toString();
    } else {
      return '0';
    }
  }

  return '0';
}
