import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

@Component({
  selector: 'app-pokemon-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <section>
      <p>{{ 'detail.placeholder' | t }} (#{{ id() }})</p>
    </section>
  `,
})
export class PokemonDetail {
  /** ルートパラメータ `:id`。withComponentInputBinding で束縛される。 */
  readonly id = input<string>('');
}
