import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Extractor from "@/pages/Extractor";

function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Extractor />} />
                </Routes>
            </BrowserRouter>
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        border: "2px solid #0A0A0A",
                        borderRadius: 0,
                        boxShadow: "4px 4px 0 0 #0A0A0A",
                        fontFamily: "IBM Plex Mono, monospace",
                        background: "#fff",
                        color: "#0A0A0A",
                    },
                }}
            />
        </div>
    );
}

export default App;
