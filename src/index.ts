#!/usr/bin/env node

import { main } from "./lib";

(async () => {
  if (require.main === module) {
    await main();
  }
})();
