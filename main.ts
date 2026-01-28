import { App, staticFiles } from "fresh";

export const app = new App({ root: import.meta.url })
  .use(staticFiles())
  .fsRoutes();

if (import.meta.main) {
  await app.listen({ port: 3000 });
}
