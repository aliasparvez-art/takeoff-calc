import React, { useState } from 'react';
import axios from 'axios';
import api from '../lib/api';
import logger from '../lib/logger';
import { Upload, FileText, Trash2, Image } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DrawingManager = ({ projectId, drawings, onRefresh }) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await api.post(`/projects/${projectId}/drawings`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (error) {
        logger.error('Error uploading drawing:', error);
      }
    }
    setUploading(false);
    onRefresh();
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="qto-panel p-6" data-testid="drawing-manager">
      <h3 className="text-lg font-heading font-semibold text-qto-text-primary mb-6">
        Drawing Manager
      </h3>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-qto p-12 text-center mb-6 transition-qto ${
          dragActive
            ? 'border-qto-primary bg-qto-primary/10'
            : 'border-qto-border hover:border-qto-primary/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        data-testid="upload-zone"
      >
        <Upload className="w-12 h-12 text-qto-text-secondary mx-auto mb-4" />
        <h4 className="text-qto-text-primary font-heading font-semibold mb-2">
          Upload Drawings
        </h4>
        <p className="text-qto-text-secondary text-sm mb-4">
          Drag & drop PDF, PNG, or JPG files here, or click to browse
        </p>
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.dwg"
          onChange={(e) => handleFileUpload(Array.from(e.target.files))}
          className="hidden"
          id="file-upload"
          data-testid="file-input"
        />
        <label
          htmlFor="file-upload"
          className="qto-btn inline-block cursor-pointer"
        >
          {uploading ? 'Uploading...' : 'Browse Files'}
        </label>
        <p className="text-xs text-qto-text-secondary mt-4">
          Note: DWG files should be converted to PDF or PNG for best results
        </p>
      </div>

      {/* Drawings Grid */}
      {drawings.length === 0 ? (
        <div className="text-center py-8" data-testid="empty-drawings">
          <FileText className="w-16 h-16 text-qto-text-secondary mx-auto mb-4" />
          <p className="text-qto-text-secondary">No drawings uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="drawings-grid">
          {drawings.map((drawing) => (
            <DrawingCard
              key={drawing.id}
              drawing={drawing}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DrawingCard = ({ drawing, onRefresh }) => {
  const isPDF = drawing.filename.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpg|jpeg)$/i.test(drawing.filename);

  return (
    <div
      className="qto-panel p-4 hover:bg-qto-surface-hover transition-qto"
      data-testid={`drawing-card-${drawing.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isPDF ? (
              <FileText className="w-5 h-5 text-qto-primary" />
            ) : (
              <Image className="w-5 h-5 text-qto-success" />
            )}
            <h4 className="text-sm font-heading font-semibold text-qto-text-primary truncate">
              {drawing.filename}
            </h4>
          </div>
          <div className="text-xs text-qto-text-secondary font-mono space-y-1">
            <div>Scale: {drawing.scale_ratio}</div>
            <div>Factor: {drawing.scale_factor.toFixed(4)}</div>
            <div>Pages: {drawing.page_count}</div>
          </div>
        </div>
      </div>
      <div className="text-xs text-qto-text-secondary">
        {new Date(drawing.created_at).toLocaleDateString()}
      </div>
    </div>
  );
};

export default DrawingManager;