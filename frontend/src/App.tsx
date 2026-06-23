import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './routes/LoginPage';
import { RegisterPage } from './routes/RegisterPage';
import { DashboardPage } from './routes/DashboardPage';
import { TemplatesPage } from './routes/TemplatesPage';
import { TemplateEditorPage } from './routes/TemplateEditorPage';
import { ExercisesPage } from './routes/ExercisesPage';
import { TrainHomePage } from './routes/TrainHomePage';
import { SessionPage } from './routes/SessionPage';
import { HistoryPage } from './routes/HistoryPage';
import { NutritionPage } from './routes/NutritionPage';
import { FoodLibraryPage } from './routes/FoodLibraryPage';
import { NutritionTargetsPage } from './routes/NutritionTargetsPage';
import { SupplementsPage } from './routes/SupplementsPage';
import { MorePage } from './routes/MorePage';
import { SleepPage } from './routes/SleepPage';
import { SettingsPage } from './routes/SettingsPage';
import { CoachPage } from './routes/CoachPage';
import { GeneratePlanPage } from './routes/GeneratePlanPage';
import { PlanDetailPage } from './routes/PlanDetailPage';
import { PlanHistoryPage } from './routes/PlanHistoryPage';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/train" element={<TrainHomePage />} />
                <Route path="/coach" element={<CoachPage />} />
                <Route path="/coach/generate" element={<GeneratePlanPage />} />
                <Route path="/coach/plans" element={<PlanHistoryPage />} />
                <Route path="/coach/plans/:id" element={<PlanDetailPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/templates/new" element={<TemplateEditorPage />} />
                <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
                <Route path="/exercises" element={<ExercisesPage />} />
                <Route path="/sessions/:id" element={<SessionPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/nutrition" element={<NutritionPage />} />
                <Route path="/nutrition/foods" element={<FoodLibraryPage />} />
                <Route path="/nutrition/targets" element={<NutritionTargetsPage />} />
                <Route path="/sleep" element={<SleepPage />} />
                <Route path="/supplements" element={<SupplementsPage />} />
                <Route path="/more" element={<MorePage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
