import { HashRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { GameDetailPage } from "@/features/games/GameDetailPage";
import { PlayersPage } from "@/features/players/PlayersPage";
import { SessionDetailPage } from "@/features/sessions/SessionDetailPage";
import { SessionsPage } from "@/features/sessions/SessionsPage";
import { SettlementPage } from "@/features/settlement/SettlementPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const App = () => (
  <HashRouter>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<SessionsPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
        <Route path="/sessions/:sessionId/games/:gameId" element={<GameDetailPage />} />
        <Route path="/sessions/:sessionId/settlement" element={<SettlementPage />} />
      </Route>
    </Routes>
  </HashRouter>
);
