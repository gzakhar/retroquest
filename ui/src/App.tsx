import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./components/WalletProvider";
import { Header } from "./components/Header";
import { SessionList } from "./components/SessionList";
import { CreateSession } from "./components/CreateSession";
import { SessionView } from "./components/SessionView";

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-900">
          <Header />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<SessionList />} />
              <Route path="/create" element={<CreateSession />} />
              <Route path="/session/:id" element={<SessionView />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;
