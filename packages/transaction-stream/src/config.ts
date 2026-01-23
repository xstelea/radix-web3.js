import { Option, Duration, Context, Ref } from 'effect';
import { type Config, TransactionDetailsOptInsSchema } from './schemas';

export class ConfigService extends Context.Tag('Config')<
  ConfigService,
  Ref.Ref<Config>
>() {
  static make = Ref.make<Config>({
    stateVersion: Option.none(),
    limitPerPage: 100,
    waitTime: Duration.seconds(60),
    optIns: TransactionDetailsOptInsSchema.make(),
  });
}
