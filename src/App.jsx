import Navbar from "./components/Navbar";
import Preloader from "./components/Preloader";
import Hero from "./components/Hero";
import Books from "./components/Books";
import Story from "./components/Story";
import Footer from "./components/Footer";
import { useData } from "./context/DataContext";
import HireModal from "./components/HireModal";
import RoomScroll from "./components/RoomScroll";
import PrivacyModal from "./components/PrivacyModal";
import ConsentBanner from "./components/ConsentBanner";

export default function App() {
  const { loading, error } = useData();

  if (loading) return <div className="grid min-h-screen place-items-center">Loading...</div>;
  if (error) return <div className="p-10 text-red-600">Could not load data: {error}</div>;

  return (
    <div className="min-h-screen overflow-x-clip bg-bg text-ink transition-colors">
      <Preloader />
      <HireModal />
      <PrivacyModal />
      <ConsentBanner />
<RoomScroll />
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-28">
        <Hero />
        <Books />
        <Story />
      </main>
      <Footer />
    </div>
  );
}