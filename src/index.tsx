import { createRoot } from "@opentui/react"
import { createCliRenderer } from "@opentui/core"
import { runCLI } from "./cli"
import App from "./app"
import { MonitorsProvider } from "./context/monitors-context"
import { NavigationProvider } from "./context/navigation-context"

const args = process.argv.slice(2)

if (args.length > 0) {
  await runCLI(args)
} else {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: "alternate-screen",
  })
  createRoot(renderer).render(
    <NavigationProvider>
      <MonitorsProvider>
        <App />
      </MonitorsProvider>
    </NavigationProvider>,
  )
}
