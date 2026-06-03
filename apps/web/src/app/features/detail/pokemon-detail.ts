import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';

@Component({
  selector: 'app-pokemon-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <p>{{ messages()['detail.placeholder'] }} (#{{ id() }})</p>
    </section>
  `,
})
export class PokemonDetail {
  protected readonly messages = inject(LocaleService).messages;

  /** ルートパラメータ `:id`。withComponentInputBinding で束縛される。 */
  readonly id = input<string>('');
}
