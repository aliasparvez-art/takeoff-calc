import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Plus, FileText, LogOut, User, Folder } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await axios.get(`${API}/projects`, {
        withCredentials: true,
      });
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-qto-bg">
      {/* Header */}
      <header className="border-b border-qto-border bg-qto-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-qto-primary rounded-qto flex items-center justify-center">
                <FileText className="w-6 h-6 text-qto-primary-text" strokeWidth={2.5} />
              </div>
              <h1 className="text-xl font-heading font-bold text-qto-text-primary">
                QTO Application
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-qto-bg rounded-qto">
                <User className="w-4 h-4 text-qto-text-secondary" />
                <span className="text-sm text-qto-text-primary">{user?.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="qto-btn-ghost px-4 py-2 flex items-center gap-2"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-heading font-bold text-qto-text-primary mb-2">
              Projects
            </h2>
            <p className="text-qto-text-secondary text-sm">
              Manage your quantity take-off projects
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="qto-btn flex items-center gap-2"
            data-testid="create-project-button"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-qto-primary border-t-transparent"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="qto-panel p-12 text-center" data-testid="empty-state">
            <Folder className="w-16 h-16 text-qto-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-heading font-semibold text-qto-text-primary mb-2">
              No projects yet
            </h3>
            <p className="text-qto-text-secondary mb-6">
              Create your first project to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="qto-btn"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="projects-grid">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="qto-panel p-6 cursor-pointer hover:bg-qto-surface-hover transition-qto"
                data-testid={`project-card-${project.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-heading font-semibold text-qto-text-primary">
                    {project.name}
                  </h3>
                  <span className={`px-2 py-1 rounded-qto text-xs font-mono ${
                    project.status === 'Final' ? 'bg-qto-success/20 text-qto-success' :
                    project.status === 'Issued for Review' ? 'bg-qto-primary/20 text-qto-primary' :
                    'bg-qto-text-secondary/20 text-qto-text-secondary'
                  }`}>
                    {project.status}
                  </span>
                </div>
                {project.project_number && (
                  <p className="text-sm text-qto-text-secondary mb-2 font-mono">
                    {project.project_number}
                  </p>
                )}
                {project.client && (
                  <p className="text-sm text-qto-text-secondary mb-4">
                    Client: {project.client}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-qto-text-secondary font-mono">
                  <span>Rev {project.revision_no}</span>
                  <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchProjects();
          }}
        />
      )}
    </div>
  );
};

const CreateProjectModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    project_number: '',
    client: '',
    prepared_by: '',
    checked_by: '',
    revision_no: '1',
    status: 'Draft',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(`${API}/projects`, formData, {
        withCredentials: true,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" data-testid="create-project-modal">
      <div className="qto-panel p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-heading font-semibold text-qto-text-primary mb-6">
          Create New Project
        </h2>

        {error && (
          <div className="bg-qto-error/10 border border-qto-error rounded-qto p-3 mb-4">
            <p className="text-qto-error text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="qto-label">Project Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="qto-input w-full"
                required
                data-testid="project-name-input"
              />
            </div>

            <div>
              <label className="qto-label">Project Number</label>
              <input
                type="text"
                value={formData.project_number}
                onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
                className="qto-input w-full"
                data-testid="project-number-input"
              />
            </div>

            <div>
              <label className="qto-label">Client</label>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                className="qto-input w-full"
                data-testid="client-input"
              />
            </div>

            <div>
              <label className="qto-label">Prepared By</label>
              <input
                type="text"
                value={formData.prepared_by}
                onChange={(e) => setFormData({ ...formData, prepared_by: e.target.value })}
                className="qto-input w-full"
                data-testid="prepared-by-input"
              />
            </div>

            <div>
              <label className="qto-label">Checked By</label>
              <input
                type="text"
                value={formData.checked_by}
                onChange={(e) => setFormData({ ...formData, checked_by: e.target.value })}
                className="qto-input w-full"
                data-testid="checked-by-input"
              />
            </div>

            <div>
              <label className="qto-label">Revision No.</label>
              <input
                type="text"
                value={formData.revision_no}
                onChange={(e) => setFormData({ ...formData, revision_no: e.target.value })}
                className="qto-input w-full"
                data-testid="revision-input"
              />
            </div>

            <div>
              <label className="qto-label">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="qto-input w-full"
                data-testid="status-select"
              >
                <option value="Draft">Draft</option>
                <option value="Issued for Review">Issued for Review</option>
                <option value="Final">Final</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="qto-btn-secondary flex-1"
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="qto-btn flex-1"
              data-testid="submit-button"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;
