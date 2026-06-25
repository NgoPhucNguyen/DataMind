import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Wallet from "./pages/Wallet";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<Navigate to="/login" />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/home"
          element={<Home />}
        />

        <Route
          path="/pricing"
          element={<Pricing />}
        />

        <Route
          path="/wallet"
          element={<Wallet />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
