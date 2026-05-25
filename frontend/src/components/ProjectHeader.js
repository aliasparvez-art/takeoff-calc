import React, { useState } from 'react';
import { Save } from 'lucide-react';

const ProjectHeader = ({ project, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: project.name,
    project_number: project.project_number,
    client: project.client,
    prepared_by: project.prepared_by,
    checked_by: project.checked_by,
    revision_no: project.revision_no,
    status: project.status,
  });
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  return (
    <div className="p-4 bg-qto-bg" data-testid="project-header">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="qto-label">Project Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onFocus={() => setIsEditing(true)}
            className="qto-input w-full"
            data-testid="header-project-name"
          />
        </div>

        <div>
          <label className="qto-label">Project Number / Contract No.</label>
          <input
            type="text"
            value={formData.project_number}
            onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
            onFocus={() => setIsEditing(true)}
            className="qto-input w-full"
            data-testid="header-project-number"
          />
        </div>

        <div>
          <label className="qto-label">Client / Owner</label>
          <input
            type="text"
            value={formData.client}
            onChange={(e) => setFormData({ ...formData, client: e.target.value })}
            onFocus={() => setIsEditing(true)}
            className="qto-input w-full"
            data-testid="header-client"
          />
        </div>

        <div>
          <label className="qto-label">Prepared By</label>
          <input
            type="text"
            value={formData.prepared_by}
            onChange={(e) => setFormData({ ...formData, prepared_by: e.target.value })}
            onFocus={() => setIsEditing(true)}
            className="qto-input w-full"
            data-testid="header-prepared-by"
          />
        </div>

        <div>
          <label className="qto-label">Checked By</label>
          <input
            type="text"
            value={formData.checked_by}
            onChange={(e) => setFormData({ ...formData, checked_by: e.target.value })}
            onFocus={() => setIsEditing(true)}
            className="qto-input w-full"
            data-testid="header-checked-by"
          />
        </div>

        <div>
          <label className="qto-label">Revision No.</label>
          <input
            type="text"
            value={formData.revision_no}
            onChange={(e) => setFormData({ ...formData, revision_no: e.target.value })}
            onFocus={() => setIsEditing(true)}
            className="qto-input w-full"
            data-testid="header-revision"
          />
        </div>

        <div>
          <label className="qto-label">Status</label>
          <select
            value={formData.status}
            onChange={(e) => {
              setFormData({ ...formData, status: e.target.value });
              setIsEditing(true);
            }}
            className="qto-input w-full"
            data-testid="header-status"
          >
            <option value="Draft">Draft</option>
            <option value="Issued for Review">Issued for Review</option>
            <option value="Final">Final</option>
          </select>
        </div>

        <div>
          <label className="qto-label">Date</label>
          <div className="qto-input w-full bg-qto-surface-hover">
            {new Date(project.updated_at).toLocaleDateString()}
          </div>
        </div>

        {isEditing && (
          <div className="flex items-end">
            <button
              onClick={handleSave}
              className="qto-btn w-full flex items-center justify-center gap-2"
              data-testid="save-header-button"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectHeader;
