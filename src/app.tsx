import { Box } from "ink"
import { useNavigation } from "./context/navigation-context"
import { HelpPage } from "./pages/help-page"
import { HomePage } from "./pages/home-page"

export default function App() {
  const { page } = useNavigation()

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan">
      {page === "help" ? <HelpPage /> : <HomePage />}
    </Box>
  )
}
