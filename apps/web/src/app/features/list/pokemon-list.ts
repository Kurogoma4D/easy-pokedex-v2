import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

@Component({
  selector: 'app-pokemon-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <section>
      <p>{{ 'list.placeholder' | t }}</p>
    </section>
  `,
})
export class PokemonList {}
