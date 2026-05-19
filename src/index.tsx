import { render } from "ink"
import { runCLI } from "./cli"
import App from "./app"
import { MonitorsProvider } from "./context/monitors-context"
import { NavigationProvider } from "./context/navigation-context"

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
