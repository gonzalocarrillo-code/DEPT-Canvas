import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { AppShell } from "@/app/AppShell";
import { ErrorScreen } from "@/app/ErrorScreen";
import { NotFound } from "@/app/NotFound";

// Route-level code splitting: the heavy surfaces (CE.SDK editor, React Flow graph)
// load on demand, keeping the initial bundle small.
const ProjectsHome = lazy(() => import("@/routes/ProjectsHome").then((m) => ({ default: m.ProjectsHome })));
const NewProject = lazy(() => import("@/routes/NewProject").then((m) => ({ default: m.NewProject })));
const BriefComposer = lazy(() => import("@/routes/BriefComposer").then((m) => ({ default: m.BriefComposer })));
const GraphPage = lazy(() => import("@/routes/GraphPage").then((m) => ({ default: m.GraphPage })));
const EditorPage = lazy(() => import("@/routes/EditorPage").then((m) => ({ default: m.EditorPage })));
const VariationStudio = lazy(() => import("@/batch/VariationStudio").then((m) => ({ default: m.VariationStudio })));
const SkillsLibrary = lazy(() => import("@/skills/SkillsLibrary").then((m) => ({ default: m.SkillsLibrary })));
const ProfileScreen = lazy(() => import("@/account/ProfileScreen").then((m) => ({ default: m.ProfileScreen })));
const AdminScreen = lazy(() => import("@/admin/AdminScreen").then((m) => ({ default: m.AdminScreen })));
const LoginScreen = lazy(() => import("@/auth/LoginScreen").then((m) => ({ default: m.LoginScreen })));

// react-router v8 Data Mode.
export const router = createBrowserRouter([
  { path: "/login", element: <LoginScreen />, errorElement: <ErrorScreen /> },
  {
    path: "/",
    element: <AppShell />,
    errorElement: <ErrorScreen />,
    children: [
      { index: true, element: <ProjectsHome /> },
      { path: "new", element: <NewProject /> },
      { path: "new/brief", element: <BriefComposer /> },
      { path: "account", element: <ProfileScreen /> },
      { path: "admin", element: <AdminScreen /> },
      { path: "skills", element: <SkillsLibrary /> },
      { path: "project/:projectId/graph", element: <GraphPage /> },
      { path: "project/:projectId/editor", element: <EditorPage /> },
      { path: "project/:projectId/editor/:sceneId", element: <EditorPage /> },
      { path: "project/:projectId/batch", element: <VariationStudio /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
