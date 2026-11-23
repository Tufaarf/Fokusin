import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { GlobalDialogContainer } from "../components/GlobalDialogContainer";
import { NotificationToastContainer } from "../components/NotificationToast";
import { realtimeSocket } from "../services/echo";
import { useAppStore } from "../store";
import { router } from "./routes";

export default function App() {
  const theme = useAppStore((state) => state.theme);
  const currentUser = useAppStore((state) => state.currentUser);
  const syncWithBackend = useAppStore((state) => state.syncWithBackend);
  const syncChats = useAppStore((state) => state.syncChats);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.title = "Fokusin - By Tufaarf";
  }, [theme]);

  useEffect(() => {
    if (currentUser) {
      syncWithBackend();
      realtimeSocket.connect();

      // Background periodic chat check every 10 seconds for real-time notification badges across the app
      const chatInterval = window.setInterval(() => {
        syncChats();
      }, 10000);

      return () => {
        window.clearInterval(chatInterval);
        realtimeSocket.disconnect();
      };
    } else {
      realtimeSocket.disconnect();
    }
  }, [currentUser, syncWithBackend, syncChats]);

  return (
    <>
      <RouterProvider router={router} />
      <NotificationToastContainer />
      <GlobalDialogContainer />
    </>
  );
}
