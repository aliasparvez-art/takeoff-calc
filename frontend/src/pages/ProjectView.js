import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../lib/api';
import logger from '../lib/logger';
import {
  ArrowLeft, ChevronDown, ChevronUp, Plus, Save, Download,
  Upload, Trash2, Calculator, FileText, DollarSign, Link2
} from 'lucide-react';

import ProjectHeader from '../components/ProjectHeader';
import BOQTable from '../components/BOQTable';
import DrawingManager from '../components/DrawingManager';
import RateAnalysis from '../components/RateAnalysis';
import ReferencesPanel from '../components/ReferencesPanel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProjectView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [boqRows, setBoqRows] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('boq');
  const [showHeaderPanel, setShowHeaderPanel] = useState(true);
  const [pendingOpenMark, setPendingOpenMark] = useState(null);

  const fetchProjectData = useCallback(async () => {
    try {
      const [projectRes, boqRes, drawingsRes, marksRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/boq-rows`),
        api.get(`/projects/${projectId}/drawings`),
        api.get(`/projects/${projectId}/marks`),
      ]);
      
      setProject(projectRes.data);
      setBoqRows(boqRes.data);
      setDrawings(drawingsRes.data);
      setMarks(marksRes.data);
    } catch (error) {
      logger.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleUpdateProject = async (updatedData) => {
    try {
      await api.put(`/projects/${projectId}`, updatedData);
      setProject({ ...project, ...updatedData });
    } catch (error) {
      logger.error('Error updating project:', error);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Item No', 'Description', 'Unit', 'Location', 'Drawing Ref', 'Spec Ref',
      'NOS', 'L', 'B', 'D/H', 'Qty (calc.)', 'Deduction', 'Remarks'
    ];
    
    const rows = boqRows.map(row => [
      row.item_no,
      row.description,
      row.unit,
      row.location,
      row.drawing_ref,
      row.spec_ref,
      row.nos,
      row.length,
      row.breadth,
      row.depth,
      row.quantity,
      row.is_deduction ? 'Yes' : 'No',
      row.remarks
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'project'}_boq.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const exportData = {
      project,
      boq_rows: boqRows,
      drawings: drawings.map(d => ({
        id: d.id,
        filename: d.filename,
        scale_factor: d.scale_factor,
        scale_ratio: d.scale_ratio
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'project'}_data.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-qto-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-qto-primary border-t-transparent"></div>
          <p className="mt-4 text-qto-text-secondary">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-qto-bg">
        <div className="text-center">
          <p className="text-qto-text-primary text-lg">Project not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="qto-btn mt-4"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-qto-bg">
      {/* Top Bar */}
      <div className="border-b border-qto-border bg-qto-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="qto-btn-ghost px-3 py-2 flex items-center gap-2"
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-lg font-heading font-bold text-qto-text-primary">
                {project.name}
              </h1>
              <div className="flex items-center gap-3 text-xs text-qto-text-secondary font-mono">
                {project.project_number && <span>{project.project_number}</span>}
                <span>Rev {project.revision_no}</span>
                <span className={`px-2 py-0.5 rounded-qto ${
                  project.status === 'Final' ? 'bg-qto-success/20 text-qto-success' :
                  project.status === 'Issued for Review' ? 'bg-qto-primary/20 text-qto-primary' :
                  'bg-qto-text-secondary/20 text-qto-text-secondary'
                }`}>
                  {project.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="qto-btn-ghost px-3 py-2 flex items-center gap-2"
              data-testid="export-csv-button"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="qto-btn-ghost px-3 py-2 flex items-center gap-2"
              data-testid="export-json-button"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={handlePrint}
              className="qto-btn-ghost px-3 py-2 flex items-center gap-2"
              data-testid="print-button"
            >
              <FileText className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Project Header Panel */}
      <div className="border-b border-qto-border">
        <button
          onClick={() => setShowHeaderPanel(!showHeaderPanel)}
          className="w-full px-4 py-2 bg-qto-surface hover:bg-qto-surface-hover transition-qto flex items-center justify-between"
          data-testid="toggle-header-button"
        >
          <span className="text-sm font-heading font-semibold text-qto-text-primary uppercase tracking-wider">
            Project Metadata
          </span>
          {showHeaderPanel ? (
            <ChevronUp className="w-4 h-4 text-qto-text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-qto-text-secondary" />
          )}
        </button>
        {showHeaderPanel && (
          <ProjectHeader project={project} onUpdate={handleUpdateProject} />
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-qto-border bg-qto-surface px-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('boq')}
            className={`px-4 py-3 text-sm font-heading font-semibold transition-qto border-b-2 ${
              activeTab === 'boq'
                ? 'border-qto-primary text-qto-primary'
                : 'border-transparent text-qto-text-secondary hover:text-qto-text-primary'
            }`}
            data-testid="boq-tab"
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              BOQ Take-Off
            </div>
          </button>
          <button
            onClick={() => setActiveTab('drawings')}
            className={`px-4 py-3 text-sm font-heading font-semibold transition-qto border-b-2 ${
              activeTab === 'drawings'
                ? 'border-qto-primary text-qto-primary'
                : 'border-transparent text-qto-text-secondary hover:text-qto-text-primary'
            }`}
            data-testid="drawings-tab"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Drawings ({drawings.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`px-4 py-3 text-sm font-heading font-semibold transition-qto border-b-2 ${
              activeTab === 'rates'
                ? 'border-qto-primary text-qto-primary'
                : 'border-transparent text-qto-text-secondary hover:text-qto-text-primary'
            }`}
            data-testid="rates-tab"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Rate Analysis
            </div>
          </button>
          <button
            onClick={() => setActiveTab('refs')}
            className={`px-4 py-3 text-sm font-heading font-semibold transition-qto border-b-2 ${
              activeTab === 'refs'
                ? 'border-qto-primary text-qto-primary'
                : 'border-transparent text-qto-text-secondary hover:text-qto-text-primary'
            }`}
            data-testid="refs-tab"
          >
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              References ({marks.length})
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'boq' && (
          <BOQTable
            projectId={projectId}
            rows={boqRows}
            onRefresh={fetchProjectData}
            drawings={drawings}
            marks={marks}
            onMarksUpdate={fetchProjectData}
            pendingOpenMark={pendingOpenMark}
            onPendingOpenMarkConsumed={() => setPendingOpenMark(null)}
          />
        )}
        {activeTab === 'drawings' && (
          <DrawingManager
            projectId={projectId}
            drawings={drawings}
            onRefresh={fetchProjectData}
          />
        )}
        {activeTab === 'rates' && (
          <RateAnalysis
            projectId={projectId}
            boqRows={boqRows}
            onRefresh={fetchProjectData}
          />
        )}
        {activeTab === 'refs' && (
          <ReferencesPanel
            projectId={projectId}
            marks={marks}
            drawings={drawings}
            boqRows={boqRows}
            onMarksUpdate={fetchProjectData}
            onOpenMark={(mark) => {
              setPendingOpenMark(mark);
              setActiveTab('boq');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectView;
