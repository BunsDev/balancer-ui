import { Ref } from 'vue';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { callStatic, sendTransaction } from '@/lib/utils/balancer/web3';
import {
  Vault__factory,
  BalancerHelpers__factory
} from '@balancer-labs/typechain';
import JoinParams from './serializers/JoinParams';
import ExitParams from './serializers/ExitParams';
import { FullPool } from '@/services/balancer/subgraph/types';
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers';
import ConfigService, { configService } from '@/services/config/config.service';

export default class ExchangeService {
  pool: Ref<FullPool>;
  vaultAddress: string;
  helpersAddress: string;

  constructor(
    pool: Ref<FullPool>,
    private readonly config: ConfigService = configService
  ) {
    this.pool = pool;
    this.vaultAddress = this.config.network.addresses.vault;
    this.helpersAddress = this.config.network.addresses.balancerHelpers;
  }

  public async queryJoin(
    provider: Web3Provider | JsonRpcProvider,
    account: string,
    amountsIn: string[],
    bptOut = '0'
  ) {
    const txParams = this.joinParams.serialize(account, amountsIn, bptOut);

    return await callStatic(
      provider,
      this.helpersAddress,
      BalancerHelpers__factory.abi,
      'queryJoin',
      txParams
    );
  }

  public async join(
    provider: Web3Provider | JsonRpcProvider,
    account: string,
    amountsIn: string[],
    bptOut = '0'
  ): Promise<TransactionResponse> {
    const txParams = this.joinParams.serialize(account, amountsIn, bptOut);

    return await sendTransaction(
      provider,
      this.vaultAddress,
      Vault__factory.abi,
      'joinPool',
      txParams
    );
  }

  public async queryExit(
    provider: Web3Provider | JsonRpcProvider,
    account: string,
    amountsOut: string[],
    bptIn: string,
    exitTokenIndex: number | null,
    exactOut: boolean
  ) {
    const txParams = this.exitParams.serialize(
      account,
      amountsOut,
      bptIn,
      exitTokenIndex,
      exactOut
    );

    return await callStatic(
      provider,
      this.helpersAddress,
      BalancerHelpers__factory.abi,
      'queryExit',
      txParams
    );
  }

  public async exit(
    provider: Web3Provider | JsonRpcProvider,
    account: string,
    amountsOut: string[],
    bptIn: string,
    exitTokenIndex: number | null,
    exactOut: boolean
  ): Promise<TransactionResponse> {
    const txParams = this.exitParams.serialize(
      account,
      amountsOut,
      bptIn,
      exitTokenIndex,
      exactOut
    );

    return await sendTransaction(
      provider,
      this.vaultAddress,
      Vault__factory.abi,
      'exitPool',
      txParams
    );
  }

  private get joinParams() {
    return new JoinParams(this);
  }

  private get exitParams() {
    return new ExitParams(this);
  }
}