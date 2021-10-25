import exchangeProxyAbi from '@/lib/abi/ExchangeProxy.json';
import configs from '@/lib/config';
import { SwapToken, SwapTokenType } from '../swap/swap.service';
import { Swap } from '@balancer-labs/sor/dist/types';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { networkId } from '@/composables/useNetwork';
import { web3Service } from '../web3/web3.service';

export default class ExchangeProxyService {
  abi: any;

  constructor() {
    this.abi = exchangeProxyAbi;
  }

  private get address() {
    return configs[networkId.value].addresses.exchangeProxy;
  }

  public multihopBatchSwap(
    swaps: Swap[][],
    tokenIn: SwapToken,
    tokenOut: SwapToken,
    options: Record<string, any> = {}
  ) : Promise<TransactionResponse> {
    if (tokenOut.type === SwapTokenType.min) {
      return this.multihopBatchSwapExactIn(
        swaps,
        tokenIn.address,
        tokenOut.address,
        tokenIn.amount.toString(),
        tokenOut.amount.toString(),
        options
      );
    }

    if (tokenIn.type === SwapTokenType.max) {
      return this.multihopBatchSwapExactOut(
        swaps,
        tokenIn.address,
        tokenOut.address,
        tokenIn.amount.toString(),
        options
      );
    }

    return Promise.reject(
      new Error('Invalid swap, must specify minimum out, or maximum in.')
    );
  }

  public multihopBatchSwapExactIn(
    swaps: Swap[][],
    tokenIn: string,
    tokenOut: string,
    totalAmountIn: string,
    minTotalAmountOut: string,
    options: Record<string, any> = {}
  ): Promise<TransactionResponse> {
    return web3Service.sendTransaction(
      this.address,
      this.abi,
      'multihopBatchSwapExactIn',
      [swaps, tokenIn, tokenOut, totalAmountIn, minTotalAmountOut],
      options
    );
  }

  public multihopBatchSwapExactOut(
    swaps: Swap[][],
    tokenIn: string,
    tokenOut: string,
    maxTotalAmountIn: string,
    options: Record<string, any> = {}
  ): Promise<TransactionResponse> {
    return web3Service.sendTransaction(
      this.address,
      this.abi,
      'multihopBatchSwapExactOut',
      [swaps, tokenIn, tokenOut, maxTotalAmountIn],
      options
    );
  }
}

export const exchangeProxyService = new ExchangeProxyService();
