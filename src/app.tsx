import { Box } from "ink"
import { useNavigation } from "./context/navigation-context.js"
import { HelpPage } from "./pages/help-page.js"
import { HomePage } from "./pages/home-page.js"

export default function App() {
  const { page } = useNavigation()

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan">
      {page === "help" ? <HelpPage /> : <HomePage />}
    </Box>
  )
}
