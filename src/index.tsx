#!/usr/bin/env bun
import { render } from "ink"
import App from "./app.js"

const { waitUntilExit } = render(<App />)
await waitUntilExit()
