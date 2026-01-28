import { Handlers } from "$fresh/server.ts";

// Redirect /teams to the main page
// The main page now has both Player and Team views with tab navigation
export const handler: Handlers = {
  GET(_req) {
    return new Response(null, {
      status: 307,
      headers: {
        Location: "/",
      },
    });
  },
};
