# Web

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.13.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## BFF connection (dev proxy)

The frontend never calls PokeAPI directly. All data requests go to the Hono BFF under the
`API_BASE_URL` token (default `/api`, see `src/app/core/api-base-url.ts`).

During `ng serve`, `proxy.conf.json` (wired via `angular.json` → `serve.options.proxyConfig`)
forwards `/api/*` to the BFF at `http://localhost:3000`, stripping the `/api` prefix so that
`/api/pokemon/list` reaches the BFF route `GET /pokemon/list`. Start the BFF alongside the web
dev server:

```bash
# from the repository root
pnpm dev:bff   # Hono BFF on http://localhost:3000
pnpm dev:web   # Angular dev server on http://localhost:4200 (proxies /api → BFF)
```

In other environments, route `/api` to the BFF at the edge/reverse proxy, or override the
`API_BASE_URL` injection token with an absolute BFF URL.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
