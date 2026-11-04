import { createApp } from "./app.js";

const port = process.env.PORT || 3000;

const server = createApp().listen(port, () => console.log(`Extract API listening on port ${port}`));

// let Docker stop the container cleanly (finish in-flight requests)
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
