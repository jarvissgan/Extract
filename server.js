import { createApp } from "./app.js";

const port = process.env.PORT || 3000;

createApp().listen(port, () =>
  console.log(`UI hosted on http://localhost:5173\nServer hosted on http://localhost:${port}`)
);
