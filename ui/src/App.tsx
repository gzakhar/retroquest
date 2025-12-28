import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./components/WalletProvider";
import { Header } from "./components/Header";
import { BoardList } from "./components/BoardList";
import { CreateBoard } from "./components/CreateBoard";
import { BoardView } from "./components/BoardView";

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-900">
          <Header />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<BoardList />} />
              <Route path="/create" element={<CreateBoard />} />
              <Route path="/board/:id" element={<BoardView />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;
