# Приёмка MVP

Проверка этапа D, 19 ноября 2026 года. Приложение запускалось из production-сборки на localhost. Прогон прошёл 34 unit/TestBed и 31 E2E-тест. Lint, format check и TypeScript strict прошли. Сценарии скриптов и конфигурация браузеров находятся в [плане](../plans/mvp.md) и [Playwright config](../../playwright.config.ts).

| Критерий | Доказательство |
|---|---|
| W1 | Time format и IANA-пояс в двух часах, reload, единый таймер и очистка при неактивном документе. [Clock E2E](../../e2e/clock.spec.ts) · [Clock unit](../../src/app/widgets/clock/clock.spec.ts) |
| W2 | CRUD, группировка, новая вкладка, отказ от опасного URL, локальные иконки без запросов favicon и видимые ссылки в карточке. [Bookmarks E2E](../../e2e/bookmarks.spec.ts) |
| W3 | Две заметки, многострочный текст, autosave, выбор, удаление и восстановление. TestBed воспроизводит быстрые действия до обновления компонента. [Notes E2E](../../e2e/notes.spec.ts) · [Notes TestBed](../../src/app/widgets/notes/notes.spec.ts) |
| W4 | Навигация по месяцам, високосный год, выбранный день, CRUD, ближайшие события и таймер без Clock. [Calendar E2E](../../e2e/calendar.spec.ts) · [Calendar unit](../../src/app/widgets/calendar/calendar.spec.ts) |
| L1 | Два экземпляра одного типа, удаление через настройки, сброс с подтверждением и возврат после reload. [Dashboard E2E](../../e2e/dashboard.spec.ts) · [Layout E2E](../../e2e/layout.spec.ts) |
| L2 | Свободный перенос, resize по обеим осям, видимый предпросмотр, коллизии, отмена жеста и смена ширины окна. [Layout E2E](../../e2e/layout.spec.ts) · [Grid unit](../../src/app/dashboard/layout.spec.ts) |
| L3 | Открытие инспектора клавишей Enter, фокус после Escape, ввод координат, ошибки и drag/resize через настоящий браузерный ввод touch. [Layout E2E](../../e2e/layout.spec.ts) · [Touch E2E](../../e2e/mobile-layout.spec.ts) |
| L4 | Ширины 320, 390, 760 и 1280 CSS px без горизонтальной прокрутки. Узкий макет сохраняется отдельно. [Layout E2E](../../e2e/layout.spec.ts) |
| P1 / V1 | IndexedDB в Chromium и WebKit, восстановление карточек, размеров, темы и данных. Скриншоты обеих тем и расчёт контраста токенов. [Persistence E2E](../../e2e/persistence.spec.ts) · [Скриншоты](../images/) |
| P2 | Защита от записи устаревшей вкладки в настоящих браузерах. Отказ чтения, неизвестная версия и битая геометрия, отказ записи и повтор последнего снимка. [Persistence E2E](../../e2e/persistence.spec.ts) · [Очередь TestBed](../../src/app/dashboard/dashboard-store.spec.ts) · [Валидация](../../src/app/storage/indexed-db.spec.ts) |

Пять сценариев ограничены Chromium, так как используют мышь на широком экране или CDP touch. Узкий экран дополнительно проверен в Playwright WebKit. Физический телефон и проверка экранным диктором не использовались. Замеры CPU, памяти и первоначальной загрузки опубликованы отдельно. [Performance](../performance.md)

## Приёмка публикации

19 ноября 2026 года проверена версия `f640e36` на [публичном URL DashForge](https://kkonstantin08.github.io/dashforge/). GitHub Actions завершил задания `verify`, `build-pages` и `deploy-pages`. Статус деплоя GitHub Pages — `success` для той же ревизии. В артефакт вошли HTML, CSS, JS и favicon из production-сборки. В истории из 15 коммитов проверены отслеживаемые файлы и распространённые шаблоны токенов, приватных ключей и локальных путей. Совпадений по шаблонам не было. [Прогон CI и деплой](https://github.com/kkonstantin08/dashforge/actions/runs/44420246326)

В Chromium при 1280 × 850 и 390 × 844 открылись четыре виджета. На каждом viewport проверены ответы для девяти уникальных URL, все в пределах публичного `/dashforge/`. Ошибок HTTP и необработанных исключений страницы не было. Новый текст заметки и выбранная тёмная тема восстановились после reload из IndexedDB в каждом из двух изолированных контекстов. Размеры приведены в CSS-пикселях.
