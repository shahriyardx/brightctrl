import { useNavigation } from "./context/navigation-context"
import { HelpPage } from "./pages/help-page"
import { HomePage } from "./pages/home-page"

export default function App() {
  const { page } = useNavigation()

  return (
    <box
      flexDirection="column"
      borderColor="gray"
      borderStyle="double"
      width="100%"
    >
      {page === "help" ? <HelpPage /> : <HomePage />}
    </box>
  )
}
