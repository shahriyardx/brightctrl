import { createContext, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"

export type Page = "home" | "help"

type NavigationContextValue = {
  page: Page
  setPage: (page: Page) => void
  goHome: () => void
  goHelp: () => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>("home")
  const navigation = useMemo(
    () => ({
      page,
      setPage,
      goHome: () => setPage("home" as const),
      goHelp: () => setPage("help" as const),
    }),
    [page],
  )

  return (
    <NavigationContext.Provider value={navigation}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error("useNavigation must be used inside NavigationProvider")
  }
  return context
}
