import { inject, Pipe, PipeTransform } from '@angular/core';
import { LocaleService } from './locale.service';
import { MessageKey } from './messages';

/**
 * UI 文言をテンプレートから参照するパイプ。`{{ 'nav.list' | t }}` の形で使う。
 * LocaleService が signal でロケールを保持するため、impure 指定でロケール変更を反映する。
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(key: MessageKey): string {
    return this.locale.translate(key);
  }
}
