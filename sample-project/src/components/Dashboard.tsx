// A React-style component (matches *.tsx / components/ heuristic).
import { usePrice } from "../hooks/usePrice";
import { appState } from "../store/state";

export function Dashboard() {
  const btc = usePrice("BTCUSDT");
  return {
    type: "div",
    props: {
      running: appState.running,
      children: `${btc.symbol}: ${btc.display}`,
    },
  };
}
