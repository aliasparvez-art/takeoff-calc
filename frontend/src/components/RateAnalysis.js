import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../lib/api';
import logger from '../lib/logger';
import { Plus, DollarSign, Calculator } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RateAnalysis = ({ projectId, boqRows, onRefresh }) => {
  const [rates, setRates] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/rate-analysis`);
      setRates(data);
    } catch (error) {
      logger.error('Error fetching rates:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const getBOQItem = (boqItemId) => {
    return boqRows.find(row => row.id === boqItemId);
  };

  return (
    <div className="qto-panel p-6" data-testid="rate-analysis">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-heading font-semibold text-qto-text-primary">
          Rate Analysis & Cost Estimation
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="qto-btn flex items-center gap-2"
          data-testid="add-rate-analysis-button"
        >
          <Plus className="w-4 h-4" />
          Add Rate Analysis
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-qto-primary border-t-transparent"></div>
        </div>
      ) : rates.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-rates">
          <Calculator className="w-16 h-16 text-qto-text-secondary mx-auto mb-4" />
          <h4 className="text-lg font-heading font-semibold text-qto-text-primary mb-2">
            No rate analysis yet
          </h4>
          <p className="text-qto-text-secondary mb-6">
            Add rate analysis to calculate costs for your BOQ items
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="qto-btn"
          >
            Create Rate Analysis
          </button>
        </div>
      ) : (
        <div className="space-y-4" data-testid="rates-list">
          {rates.map((rate) => {
            const boqItem = getBOQItem(rate.boq_item_id);
            return (
              <div
                key={rate.id}
                className="p-4 bg-qto-bg rounded-qto border border-qto-border"
                data-testid={`rate-card-${rate.id}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-qto-text-primary font-heading font-semibold">
                      {boqItem?.item_no} - {boqItem?.description}
                    </h4>
                    <p className="text-sm text-qto-text-secondary mt-1">
                      Quantity: {boqItem?.quantity.toFixed(3)} {boqItem?.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-mono font-bold text-qto-primary">
                      ${rate.total_rate.toFixed(2)}
                    </div>
                    <div className="text-xs text-qto-text-secondary">per {rate.unit}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="qto-label mb-2">Materials</div>
                    <div className="space-y-1">
                      {Object.keys(rate.material_rates).length === 0 ? (
                        <div className="text-qto-text-secondary text-xs">None</div>
                      ) : (
                        Object.entries(rate.material_rates).map(([item, cost]) => (
                          <div key={item} className="flex justify-between text-xs">
                            <span className="text-qto-text-secondary">{item}</span>
                            <span className="font-mono text-qto-text-primary">${cost}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="qto-label mb-2">Labor</div>
                    <div className="space-y-1">
                      {Object.keys(rate.labor_rates).length === 0 ? (
                        <div className="text-qto-text-secondary text-xs">None</div>
                      ) : (
                        Object.entries(rate.labor_rates).map(([item, cost]) => (
                          <div key={item} className="flex justify-between text-xs">
                            <span className="text-qto-text-secondary">{item}</span>
                            <span className="font-mono text-qto-text-primary">${cost}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="qto-label mb-2">Equipment</div>
                    <div className="space-y-1">
                      {Object.keys(rate.equipment_rates).length === 0 ? (
                        <div className="text-qto-text-secondary text-xs">None</div>
                      ) : (
                        Object.entries(rate.equipment_rates).map(([item, cost]) => (
                          <div key={item} className="flex justify-between text-xs">
                            <span className="text-qto-text-secondary">{item}</span>
                            <span className="font-mono text-qto-text-primary">${cost}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-qto-border flex justify-between text-xs">
                  <div>
                    <span className="text-qto-text-secondary">Overhead: </span>
                    <span className="font-mono text-qto-text-primary">{rate.overhead_percentage}%</span>
                  </div>
                  <div>
                    <span className="text-qto-text-secondary">Profit: </span>
                    <span className="font-mono text-qto-text-primary">{rate.profit_percentage}%</span>
                  </div>
                  <div>
                    <span className="text-qto-text-secondary font-bold">Total Cost: </span>
                    <span className="font-mono font-bold text-qto-primary">
                      ${(rate.total_rate * (boqItem?.quantity || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Grand Total */}
          <div className="qto-panel p-6 bg-qto-primary/10 border-2 border-qto-primary">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-heading font-bold text-qto-text-primary">
                Project Total Estimated Cost
              </h4>
              <div className="text-3xl font-mono font-bold text-qto-primary">
                $
                {rates
                  .reduce((sum, rate) => {
                    const boqItem = getBOQItem(rate.boq_item_id);
                    return sum + rate.total_rate * (boqItem?.quantity || 0);
                  }, 0)
                  .toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateRateModal
          projectId={projectId}
          boqRows={boqRows}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchRates();
          }}
        />
      )}
    </div>
  );
};

const CreateRateModal = ({ projectId, boqRows, onClose, onSuccess }) => {
  const [selectedBOQ, setSelectedBOQ] = useState('');
  const [materials, setMaterials] = useState([{ id: crypto.randomUUID(), name: '', rate: 0 }]);
  const [labor, setLabor] = useState([{ id: crypto.randomUUID(), name: '', rate: 0 }]);
  const [equipment, setEquipment] = useState([{ id: crypto.randomUUID(), name: '', rate: 0 }]);
  const [overhead, setOverhead] = useState(10);
  const [profit, setProfit] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const materialRates = {};
    materials.forEach(m => {
      if (m.name && m.rate > 0) materialRates[m.name] = m.rate;
    });

    const laborRates = {};
    labor.forEach(l => {
      if (l.name && l.rate > 0) laborRates[l.name] = l.rate;
    });

    const equipmentRates = {};
    equipment.forEach(e => {
      if (e.name && e.rate > 0) equipmentRates[e.name] = e.rate;
    });

    try {
      await api.post(
        `/projects/${projectId}/rate-analysis`,
        {
          boq_item_id: selectedBOQ,
          material_rates: materialRates,
          labor_rates: laborRates,
          equipment_rates: equipmentRates,
          overhead_percentage: overhead,
          profit_percentage: profit,
        }
      );
      onSuccess();
    } catch (error) {
      logger.error('Error creating rate analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" data-testid="create-rate-modal">
      <div className="qto-panel p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-heading font-semibold text-qto-text-primary mb-6">
          Create Rate Analysis
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="qto-label">Select BOQ Item *</label>
            <select
              value={selectedBOQ}
              onChange={(e) => setSelectedBOQ(e.target.value)}
              className="qto-input w-full"
              required
              data-testid="boq-select"
            >
              <option value="">-- Select --</option>
              {boqRows.map(row => (
                <option key={row.id} value={row.id}>
                  {row.item_no} - {row.description} ({row.quantity.toFixed(3)} {row.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="qto-label mb-2">Material Rates</label>
              {materials.map((m, i) => (
                <div key={m.id} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Material name"
                    value={m.name}
                    onChange={(e) => {
                      const updated = [...materials];
                      updated[i].name = e.target.value;
                      setMaterials(updated);
                    }}
                    className="qto-input flex-1"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Rate"
                    value={m.rate}
                    onChange={(e) => {
                      const updated = [...materials];
                      updated[i].rate = parseFloat(e.target.value) || 0;
                      setMaterials(updated);
                    }}
                    className="qto-input w-32"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setMaterials([...materials, { id: crypto.randomUUID(), name: '', rate: 0 }])}
                className="qto-btn-secondary w-full mt-2"
              >
                + Add Material
              </button>
            </div>

            <div>
              <label className="qto-label mb-2">Labor Rates</label>
              {labor.map((l, i) => (
                <div key={l.id} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Labor type"
                    value={l.name}
                    onChange={(e) => {
                      const updated = [...labor];
                      updated[i].name = e.target.value;
                      setLabor(updated);
                    }}
                    className="qto-input flex-1"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Rate"
                    value={l.rate}
                    onChange={(e) => {
                      const updated = [...labor];
                      updated[i].rate = parseFloat(e.target.value) || 0;
                      setLabor(updated);
                    }}
                    className="qto-input w-32"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLabor([...labor, { id: crypto.randomUUID(), name: '', rate: 0 }])}
                className="qto-btn-secondary w-full mt-2"
              >
                + Add Labor
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="qto-label mb-2">Equipment Rates</label>
            {equipment.map((eq, i) => (
              <div key={eq.id} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Equipment name"
                  value={eq.name}
                  onChange={(e) => {
                    const updated = [...equipment];
                    updated[i].name = e.target.value;
                    setEquipment(updated);
                  }}
                  className="qto-input flex-1"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate"
                  value={eq.rate}
                  onChange={(e) => {
                    const updated = [...equipment];
                    updated[i].rate = parseFloat(e.target.value) || 0;
                    setEquipment(updated);
                  }}
                  className="qto-input w-32"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEquipment([...equipment, { id: crypto.randomUUID(), name: '', rate: 0 }])}
              className="qto-btn-secondary w-full mt-2"
            >
              + Add Equipment
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="qto-label">Overhead %</label>
              <input
                type="number"
                step="0.1"
                value={overhead}
                onChange={(e) => setOverhead(parseFloat(e.target.value) || 0)}
                className="qto-input w-full"
              />
            </div>
            <div>
              <label className="qto-label">Profit %</label>
              <input
                type="number"
                step="0.1"
                value={profit}
                onChange={(e) => setProfit(parseFloat(e.target.value) || 0)}
                className="qto-input w-full"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="qto-btn-secondary flex-1"
              data-testid="cancel-rate-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedBOQ}
              className="qto-btn flex-1"
              data-testid="submit-rate-button"
            >
              {loading ? 'Creating...' : 'Create Rate Analysis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RateAnalysis;