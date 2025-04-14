import 'websocket-polyfill'

import { run_zapper } from "./zapper.js"

// Don't wrap in an async main() function - let Node.js handle the promise rejection
run_zapper().catch((error) => {
    console.error("Application failed:")
    if (error?.cause) {
        console.error("Caused by:", error.cause)
    }
    console.error(error.stack || error)
    process.exit(1)
})
