/**
 * App — root component.
 *
 * Wires the GameLayout into the React tree. The game is a single full-viewport
 * experience, so no router is needed at this stage. Providers (QueryClient,
 * InternetIdentity) are already mounted in main.tsx.
 */
import { GameLayout } from "@/components/game/GameLayout";

export default function App() {
  return <GameLayout />;
}
