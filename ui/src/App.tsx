import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./components/WalletProvider";
import { SessionProvider } from "./contexts/SessionContext";
import { IdentityProvider } from "./contexts/IdentityContext";
import { Header } from "./components/Header";
import { BoardList } from "./components/BoardList";
import { CreateBoard } from "./components/CreateBoard";
import { BoardView } from "./components/BoardView";
import { PdaExplorerPage } from "./components/PdaExplorerPage";

function App() {
  return (
    <WalletProvider>
      <SessionProvider>
        <IdentityProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-gray-900">
              <Header />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Routes>
                  <Route path="/" element={<BoardList />} />
                  <Route path="/create" element={<CreateBoard />} />
                  <Route path="/board/:id" element={<BoardView />} />
                  <Route path="/pda-explorer" element={<PdaExplorerPage />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </IdentityProvider>
      </SessionProvider>
    </WalletProvider>
  );
}

export default App;
