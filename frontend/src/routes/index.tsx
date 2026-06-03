// src/routes/index.tsx
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicRoute } from "./PublicRoute";
import { Navigate } from "react-router-dom";

// Layouts
import RootLayout from "@/components/layouts/RootLayout";
import DashboardLayout from "@/components/layouts/DashboardLayout";

// Pages (Se crearan después)
import LoginPage from '@/features/auth/pages/LoginPage';
import RegisterPage from '@/features/auth/pages/RegisterPage';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import WorkoutsPage from '@/features/workouts/pages/WorkoutsPage';
import CreateWorkoutPage from "@/features/workouts/pages/CreateTemplatePage";
import EditTemplatePage from "@/features/workouts/pages/EditTemplatePage";
import StartSessionPage from '@/features/workouts/pages/StartSessionPage';
import SessionDetailPage from '@/features/workouts/pages/SessionDetailPage';
import TemplateDetailPage from '@/features/workouts/pages/TemplateDetailPage';
import EditSessionPage from '@/features/workouts/pages/EditSessionPage';
import ExercisesPage from '@/features/exercises/pages/ExercisesPage';
import ProfilePage from '@/features/profile/pages/ProfilePage';
import StatsPage from '@/features/stats/pages/StatsPage';
import NotFoundPage from '@/pages/NotFoundPage';



export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },

      // Rutas públicas
      {
        element: <PublicRoute />,
        children: [
          {
            path: 'login',
            element: <LoginPage />
          },
          {
            path: 'register',
            element: <RegisterPage />
          },
        ]
      },

      // Rutas protegidas
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              {
                path: 'dashboard',
                element: <DashboardPage />
              },
              {
                path: 'workouts',
                element: <WorkoutsPage />
              },
              {
                path: 'workouts/templates/new',
                element: <CreateWorkoutPage />
              },
              {
                path: 'workouts/sessions/start',
                element: <StartSessionPage />
              },
              {
                path: 'workouts/sessions/:id',
                element: <SessionDetailPage />
              },
              {
                path: 'workouts/sessions/:id/edit',
                element: <EditSessionPage />
              },
              {
                path: 'workouts/templates/:id',
                element: <TemplateDetailPage />
              },
              {
                path: 'workouts/templates/:id/edit',
                element: <EditTemplatePage />
              },
              {
                path: 'exercises',
                element: <ExercisesPage />
              },
              {
                path: 'profile',
                element: <ProfilePage />
              },
              {
                path: 'stats',
                element: <StatsPage />
              }
            ]
          }
        ]
      },

      // Página 404
      {
        path: '*',
        element: <NotFoundPage />
      }
    ]
  }
])
