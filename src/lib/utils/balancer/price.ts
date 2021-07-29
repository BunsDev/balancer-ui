import { Pool } from '@/services/balancer/subgraph/types';
import { Prices } from '@/services/coingecko';
import * as SDK from '@georgeroman/balancer-v2-pools';
import BigNumber from 'bignumber.js';

function stablePoolSpotPrice(
  amp: BigNumber, //TODO - is this the right data type?
  scaledBalances: BigNumber[],  //TODO - is this the right data type?
  tokenIndexA: number, 
  tokenIndexB: number): BigNumber 
  {
  const invariant = SDK.StableMath._calculateInvariant(amp, scaledBalances, true);
  const [balanceX, balanceY] = [scaledBalances[tokenIndexA], scaledBalances[tokenIndexB]];

  const a = amp.times(2);
  const b = invariant.minus(invariant.times(a));
  const axy2 = a.times(2).times(balanceX).times(balanceY);

  const derivativeX = axy2.plus(a.times(balanceY).times(balanceY)).plus(b.times(balanceY));
  const derivativeY = axy2.plus(a.times(balanceX).times(balanceX)).plus(b.times(balanceX));

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
  // TODO [improvement]: if price is missing, compute spot price based on balances and amp factor
  if (pool.poolType == 'Stable' || pool.poolType == 'MetaStable') {
    let sumBalance = 0;
    let sumValue = 0;
    let refTokenIndex = 0;
    let refTokenPrice = 0;

    for (let i = 0; i < pool.tokens.length; i++) {
      const token = pool.tokens[i];
      // if a token's price is unkown, ignore it
      // it will be computed at the next step
      if (!prices[token.address]) {
        continue;
      }
      const price = prices[token.address].price;
      const balance = parseFloat(pool.tokens[i].balance);
      refTokenIndex = i;
      refTokenPrice = price;

      const value = balance * price;
      sumValue = sumValue + value;
      sumBalance = sumBalance + balance;
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
        const balance = parseFloat(pool.tokens[i].balance);
        const balances = []; // TODO - array of token balances
        const amp = 0; // TODO - get amp from pool.amp?
        const spotPrice = stablePoolSpotPrice(amp, balances,  i, refTokenIndex);
        const value = balance * spotPrice * refTokenPrice; // TODO - requires some data type conversion?
        sumValue = sumValue + value;
        sumBalance = sumBalance + balance;
      }
      return sumValue.toString();
    } else {
      return '0';
    }
  }
  return '0';
}
