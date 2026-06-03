import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';

@Component({
  selector: 'app-pokemon-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <p>{{ messages()['list.placeholder'] }}</p>
    </section>
  `,
})
export class PokemonList {
  protected readonly messages = inject(LocaleService).messages;
}
