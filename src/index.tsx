#!/usr/bin/env node
import { render } from "ink"
import { runCLI } from "./cli.js"
import App from "./app.js"
import { MonitorsProvider } from "./context/monitors-context.js"
import { NavigationProvider } from "./context/navigation-context.js"

const args = process.argv.slice(2)

if (args.length > 0) {
  await runCLI(args)
} else {
  const { waitUntilExit } = render(
    <NavigationProvider>
      <MonitorsProvider>
        <App />
      </MonitorsProvider>
    </NavigationProvider>,
  )
  await waitUntilExit()
}
