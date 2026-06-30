import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

const queryClient = new QueryClient();

// NOTE: The game UI renders independently of Internet Identity. II is only
// needed for high-score submission, which already degrades gracefully when
// the actor is unavailable (see hooks/useHighScore.ts). Wrapping the entire
// tree in <InternetIdentityProvider> previously blocked the start screen
// from rendering on devices where II was slow or unavailable to load —
// producing a blank black screen. The game shell now mounts unconditionally.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
