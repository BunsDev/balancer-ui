import { computed, ComputedRef, reactive, ref, Ref, toRefs } from 'vue';
import { useStore } from 'vuex';
import { BigNumber } from 'bignumber.js';
import { formatUnits } from '@ethersproject/units';
import { AddressZero } from '@ethersproject/constants';
import { OrderBalance, OrderKind } from '@gnosis.pm/gp-v2-contracts';
import { onlyResolvesLast } from 'awesome-only-resolves-last-promise';

import { tryPromiseWithTimeout } from '@/lib/utils/promise';
import { bnum } from '@/lib/utils';
import {
  FeeInformation,
  FeeQuoteParams,
  OrderMetaData,
  PriceQuoteParams
} from '@/services/gnosis/types';
import { signOrder, UnsignedOrder } from '@/services/gnosis/signing';
import useWeb3 from '@/services/web3/useWeb3';
import { calculateValidTo, toErc20Address } from '@/services/gnosis/utils';
import { gnosisProtocolService } from '@/services/gnosis/gnosisProtocol.service';
import { match0xService } from '@/services/gnosis/match0x.service';
import { paraSwapService } from '@/services/gnosis/paraswap.service';

import useTransactions from '../useTransactions';

import { Token } from '@/types';
import { TokenInfo } from '@/types/TokenList';

import { TradeQuote } from './types';

import useNumbers from '../useNumbers';
import useTokens from '../useTokens';
import { ApiErrorCodes } from '@/services/gnosis/errors/OperatorError';

const HIGH_FEE_THRESHOLD = 0.2;
const APP_DATA =
  process.env.VUE_APP_GNOSIS_APP_DATA ??
  '0xE9F29AE547955463ED535162AEFEE525D8D309571A2B18BC26086C8C35D781EB';

type State = {
  warnings: {
    highFees: boolean;
  };
  validationError: null | string;
  submissionError: null | string;
};

const state = reactive<State>({
  warnings: {
    highFees: false
  },
  validationError: null,
  submissionError: null
});

export type GnosisTransactionDetails = {
  tokenIn: Token;
  tokenOut: Token;
  tokenInAddress: string;
  tokenOutAddress: string;
  tokenInAmount: string;
  tokenOutAmount: string;
  exactIn: boolean;
  quote: TradeQuote;
  slippageBufferRate: number;
  order: {
    validTo: OrderMetaData['validTo'];
    partiallyFillable: OrderMetaData['partiallyFillable'];
  };
};

type Props = {
  exactIn: Ref<boolean>;
  tokenInAddressInput: Ref<string>;
  tokenInAmountInput: Ref<string>;
  tokenOutAddressInput: Ref<string>;
  tokenOutAmountInput: Ref<string>;
  tokenInAmountScaled: ComputedRef<BigNumber>;
  tokenOutAmountScaled: ComputedRef<BigNumber>;
  tokenIn: ComputedRef<TokenInfo>;
  tokenOut: ComputedRef<TokenInfo>;
  slippageBufferRate: ComputedRef<number>;
};

const PRICE_QUOTE_TIMEOUT = 10000;

const priceQuotesResolveLast = onlyResolvesLast(getPriceQuotes);
const feeQuoteResolveLast = onlyResolvesLast(getFeeQuote);

function getPriceQuotes(params: PriceQuoteParams) {
  return Promise.allSettled([
    tryPromiseWithTimeout(
      gnosisProtocolService.getPriceQuote(params),
      PRICE_QUOTE_TIMEOUT
    ),
    tryPromiseWithTimeout(
      match0xService.getPriceQuote(params),
      PRICE_QUOTE_TIMEOUT
    ),
    tryPromiseWithTimeout(
      paraSwapService.getPriceQuote(params),
      PRICE_QUOTE_TIMEOUT
    )
  ]);
}

function getFeeQuote(params: FeeQuoteParams) {
  return gnosisProtocolService.getFeeQuote(params);
}

export default function useGnosis({
  exactIn,
  tokenInAddressInput,
  tokenInAmountInput,
  tokenOutAddressInput,
  tokenOutAmountInput,
  tokenInAmountScaled,
  tokenOutAmountScaled,
  tokenIn,
  tokenOut,
  slippageBufferRate
}: Props) {
  // COMPOSABLES
  const store = useStore();
  const { account, getSigner } = useWeb3();
  const { addTransaction } = useTransactions();
  const { fNum } = useNumbers();
  const { balanceFor } = useTokens();

  // DATA
  const feeQuote = ref<FeeInformation | null>(null);
  const updatingQuotes = ref(false);
  const confirming = ref(false);

  // COMPUTED
  const appTransactionDeadline = computed<number>(
    () => store.state.app.transactionDeadline
  );

  const hasValidationError = computed(() => state.validationError != null);

  // METHODS
  function getFeeAmount() {
    const feeAmountInToken = feeQuote.value?.quote.feeAmount ?? '0';
    const feeAmountOutToken = tokenOutAmountScaled.value
      .div(tokenInAmountScaled.value)
      .times(feeAmountInToken)
      .integerValue(BigNumber.ROUND_DOWN)
      .toString();

    return {
      feeAmountInToken,
      feeAmountOutToken
    };
  }

  function getQuote(): TradeQuote {
    const { feeAmountInToken, feeAmountOutToken } = getFeeAmount();

    const maximumInAmount = tokenInAmountScaled.value
      .plus(feeAmountInToken)
      .times(1 + slippageBufferRate.value)
      .integerValue(BigNumber.ROUND_DOWN)
      .toString();

    const minimumOutAmount = tokenOutAmountScaled.value
      .minus(feeAmountOutToken)
      .div(1 + slippageBufferRate.value)
      .integerValue(BigNumber.ROUND_DOWN)
      .toString();

    return {
      feeAmountInToken,
      feeAmountOutToken,
      maximumInAmount,
      minimumOutAmount
    };
  }

  async function trade(successCallback?: () => void) {
    try {
      confirming.value = true;
      state.submissionError = null;

      const quote = getQuote();

      const unsignedOrder: UnsignedOrder = {
        sellToken: tokenInAddressInput.value,
        buyToken: tokenOutAddressInput.value,
        sellAmount: bnum(
          exactIn.value ? tokenInAmountScaled.value : quote.maximumInAmount
        )
          .minus(quote.feeAmountInToken)
          .toString(),
        buyAmount: exactIn.value
          ? quote.minimumOutAmount
          : tokenOutAmountScaled.value.toString(),
        validTo: calculateValidTo(appTransactionDeadline.value),
        appData: APP_DATA,
        feeAmount: quote.feeAmountInToken,
        kind: exactIn.value ? OrderKind.SELL : OrderKind.BUY,
        receiver: account.value,
        partiallyFillable: false, // Always fill or kill,
        sellTokenBalance: OrderBalance.EXTERNAL
      };

      const { signature, signingScheme } = await signOrder(
        unsignedOrder,
        getSigner()
      );

      const orderId = await gnosisProtocolService.sendSignedOrder({
        order: {
          ...unsignedOrder,
          signature,
          receiver: account.value,
          signingScheme
        },
        owner: account.value
      });

      const sellAmount = exactIn.value
        ? tokenInAmountInput.value
        : formatUnits(quote.maximumInAmount, tokenIn.value.decimals).toString();

      const buyAmount = exactIn.value
        ? formatUnits(
            quote.minimumOutAmount,
            tokenOut.value.decimals
          ).toString()
        : tokenOutAmountInput.value;

      const tokenInAmountEst = exactIn.value ? '' : '~';
      const tokenOutAmountEst = exactIn.value ? '~' : '';

      const summary = `${tokenInAmountEst}${fNum(sellAmount, 'token')} ${
        tokenIn.value.symbol
      } -> ${tokenOutAmountEst}${fNum(buyAmount, 'token')} ${
        tokenOut.value.symbol
      }`;

      const { validTo, partiallyFillable } = unsignedOrder;

      addTransaction({
        id: orderId,
        type: 'order',
        action: 'trade',
        summary,
        details: {
          tokenIn: tokenIn.value,
          tokenOut: tokenOut.value,
          tokenInAddress: tokenInAddressInput.value,
          tokenOutAddress: tokenOutAddressInput.value,
          tokenInAmount: tokenInAmountInput.value,
          tokenOutAmount: tokenOutAmountInput.value,
          exactIn: exactIn.value,
          quote,
          slippageBufferRate: slippageBufferRate.value,
          order: {
            validTo,
            partiallyFillable
          }
        }
      });

      if (successCallback != null) {
        successCallback();
      }
      confirming.value = false;
    } catch (e) {
      state.submissionError = e.message;
      confirming.value = false;
    }
  }

  function resetState(shouldResetFees = true) {
    state.warnings.highFees = false;
    state.validationError = null;
    state.submissionError = null;

    if (shouldResetFees) {
      feeQuote.value = null;
    }
  }

  async function handleAmountChange() {
    const amountToExchange = exactIn.value
      ? tokenInAmountScaled.value
      : tokenOutAmountScaled.value;

    if (amountToExchange.isZero()) {
      tokenInAmountInput.value = '0';
      tokenOutAmountInput.value = '0';
      return;
    }

    if (amountToExchange.isNaN()) {
      tokenInAmountInput.value = '';
      tokenOutAmountInput.value = '';
      return;
    }

    updatingQuotes.value = true;
    state.validationError = null;

    let feeQuoteResult: FeeInformation | null = null;
    try {
      const feeQuoteParams: FeeQuoteParams = {
        sellToken: toErc20Address(tokenInAddressInput.value),
        buyToken: toErc20Address(tokenOutAddressInput.value),
        from: account.value || AddressZero,
        receiver: account.value || AddressZero,
        validTo: calculateValidTo(appTransactionDeadline.value),
        appData: APP_DATA,
        partiallyFillable: false,
        sellTokenBalance: OrderBalance.EXTERNAL,
        buyTokenBalance: OrderBalance.ERC20,
        kind: exactIn.value ? OrderKind.SELL : OrderKind.BUY
      };

      if (exactIn.value) {
        feeQuoteParams.sellAmountBeforeFee = amountToExchange.toString();
      } else {
        feeQuoteParams.buyAmountAfterFee = amountToExchange.toString();
      }

      // TODO: there is a chance to optimize here and not make a new request if the fee is not expired
      feeQuoteResult = await feeQuoteResolveLast(feeQuoteParams);
    } catch (e) {
      feeQuoteResult = null;

      state.validationError = e.message;
    }

    if (feeQuoteResult != null) {
      try {
        let priceQuoteAmount: string | null = null;

        const priceQuoteParams: PriceQuoteParams = {
          sellToken: tokenInAddressInput.value,
          buyToken: tokenOutAddressInput.value,
          amount: amountToExchange.toString(),
          kind: exactIn.value ? OrderKind.SELL : OrderKind.BUY,
          fromDecimals: tokenIn.value.decimals,
          toDecimals: tokenOut.value.decimals
        };

        const priceQuotes = await priceQuotesResolveLast(priceQuoteParams);

        const priceQuoteAmounts = priceQuotes.reduce<string[]>(
          (fulfilledPriceQuotes, priceQuote) => {
            if (
              priceQuote.status === 'fulfilled' &&
              priceQuote.value &&
              priceQuote.value.amount != null
            ) {
              fulfilledPriceQuotes.push(priceQuote.value.amount);
            }
            return fulfilledPriceQuotes;
          },
          []
        );

        if (priceQuoteAmounts.length > 0) {
          // For sell orders get the largest (max) quote. For buy orders get the smallest (min) quote.
          priceQuoteAmount = (exactIn.value
            ? BigNumber.max(...priceQuoteAmounts)
            : BigNumber.min(...priceQuoteAmounts)
          ).toString(10);
        }

        if (priceQuoteAmount != null) {
          feeQuote.value = feeQuoteResult;

          if (exactIn.value) {
            tokenOutAmountInput.value = bnum(
              formatUnits(priceQuoteAmount, tokenOut.value.decimals)
            ).toFixed(6, BigNumber.ROUND_DOWN);

            const { feeAmountInToken } = getQuote();

            state.warnings.highFees = bnum(feeAmountInToken)
              .div(amountToExchange)
              .gt(HIGH_FEE_THRESHOLD);
          } else {
            tokenInAmountInput.value = bnum(
              formatUnits(priceQuoteAmount, tokenIn.value.decimals)
            ).toFixed(6, BigNumber.ROUND_DOWN);

            const { feeAmountOutToken, maximumInAmount } = getQuote();

            state.warnings.highFees = bnum(feeAmountOutToken)
              .div(amountToExchange)
              .gt(HIGH_FEE_THRESHOLD);

            const priceExceedsBalance = bnum(
              formatUnits(maximumInAmount, tokenIn.value.decimals)
            ).gt(balanceFor(tokenIn.value.address));

            if (priceExceedsBalance) {
              state.validationError = ApiErrorCodes.PriceExceedsBalance;
            }
          }
        }
      } catch (e) {
        console.log('[Gnosis Quotes] Failed to update quotes', e);
      }
    }

    updatingQuotes.value = false;
  }

  return {
    // methods
    trade,
    handleAmountChange,
    resetState,

    // computed
    ...toRefs(state),
    feeQuote,
    updatingQuotes,
    hasValidationError,
    confirming,
    getQuote
  };
}
