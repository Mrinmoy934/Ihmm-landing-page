import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppRoutes } from './routes';
import { Agentation } from 'agentation';
import './index.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        {import.meta.env.DEV && <Agentation endpoint="http://localhost:4747" />}
      </AuthProvider>
    </Router>
  );
}

export default App;
