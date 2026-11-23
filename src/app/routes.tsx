import { createBrowserRouter } from "react-router";
import { AuthGuard } from "../components/AuthGuard";
import { AppShell } from "../components/AppShell";
import { LoginPage, RegisterPage } from "../pages/AuthPages";
import { CalendarPage } from "../pages/CalendarPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { MessagesPage } from "../pages/MessagesPage";
import { NotesPage } from "../pages/NotesPage";
import { ProfilePage } from "../pages/ProfilePage";
import { ProjectBoardPage } from "../pages/ProjectBoardPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { TasksPage } from "../pages/TasksPage";
import { UsersManagementPage } from "../pages/UsersManagementPage";

export const router = createBrowserRouter([
  { path: "/login", Component: LoginPage },
  { path: "/register", Component: RegisterPage },
  {
    Component: AuthGuard,
    children: [
      {
        path: "/",
        Component: AppShell,
        children: [
          { index: true, Component: DashboardPage },
          { path: "calendar", Component: CalendarPage },
          { path: "projects", Component: ProjectsPage },
          { path: "projects/:projectId", Component: ProjectBoardPage },
          { path: "tasks", Component: TasksPage },
          { path: "messages", Component: MessagesPage },
          { path: "notes", Component: NotesPage },
          { path: "documents", Component: DocumentsPage },
          { path: "profile", Component: ProfilePage },
          { path: "users", Component: UsersManagementPage },
        ],
      },
    ],
  },
]);
