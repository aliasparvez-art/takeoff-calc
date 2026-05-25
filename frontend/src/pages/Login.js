import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FileText } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-qto-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-qto-primary rounded-qto mb-4">
            <FileText className="w-8 h-8 text-qto-primary-text" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-heading font-bold text-qto-text-primary mb-2">
            QTO Application
          </h1>
          <p className="text-qto-text-secondary text-sm">Quantity Take-Off System</p>
        </div>

        <div className="qto-panel p-8">
          <h2 className="text-xl font-heading font-semibold text-qto-text-primary mb-6">
            Sign In
          </h2>

          {error && (
            <div className="bg-qto-error/10 border border-qto-error rounded-qto p-3 mb-4" data-testid="login-error">
              <p className="text-qto-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="qto-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="qto-input w-full"
                required
                data-testid="email-input"
              />
            </div>

            <div className="mb-6">
              <label className="qto-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="qto-input w-full"
                required
                data-testid="password-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="qto-btn w-full mb-4"
              data-testid="login-button"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-qto-text-secondary text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-qto-primary hover:text-qto-primary-hover transition-qto" data-testid="register-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;