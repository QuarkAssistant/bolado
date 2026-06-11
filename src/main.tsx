import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DailyApp from "./DailyApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DailyApp />
  </StrictMode>,
);
