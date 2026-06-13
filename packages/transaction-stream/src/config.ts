import { Option, Duration, Context, Layer, Ref } from 'effect';

import { type Config, makeTransactionDetailsOptIns } from './schemas';

export class ConfigService extends Context.Service<ConfigService>()('Config', {
  make: Ref.make<Config>({
    stateVersion: Option.none(),
    limitPerPage: 100,
    waitTime: Duration.seconds(60),
    optIns: makeTransactionDetailsOptIns(),
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
  static readonly DefaultWithoutDependencies = this.Default;
}
