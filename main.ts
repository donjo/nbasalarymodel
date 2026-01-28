import { App, staticFiles } from "@fresh/core";

export const app = new App({ root: import.meta.url })
  .use(staticFiles())
  .fsRoutes();

if (import.meta.main) {
  await app.listen({ port: 3000 });
}
