'use client';

import { useEffect, useState } from 'react';
import { usePageConfig } from '@/contexts/PageConfigContext';

interface Page {
  id: string;
  pageName: string;
  platform: string;
}

interface AISettingsSectionProps {
  pageId: string;
  page: Page;
}

export default function AISettingsSection({ pageId }: AISettingsSectionProps) {
  const { aiSettings, loading, error, fetchAISettings, updateAISettings, clearError } = usePageConfig();
  const [formData, setFormData] = useState({
    aiEnabled: true,
    autoReply: true,
    aiPersonality: 'professional',
    responseTone: 'balanced',
    responseLength: 'medium',
    customInstructions: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [pageId]);

  useEffect(() => {
    if (aiSettings) {
      setFormData({
        aiEnabled: aiSettings.aiEnabled,
        autoReply: aiSettings.autoReply,
        aiPersonality: aiSettings.aiPersonality,
        responseTone: aiSettings.responseTone,
        responseLength: aiSettings.responseLength,
        customInstructions: aiSettings.customInstructions || '',
      });
    }
  }, [aiSettings]);

  const loadSettings = async () => {
    try {
      await fetchAISettings(pageId);
    } catch (err) {
      // Error handled by context
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      await updateAISettings(pageId, formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      // Error handled by context
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      aiEnabled: true,
      autoReply: true,
      aiPersonality: 'professional',
      responseTone: 'balanced',
      responseLength: 'medium',
      customInstructions: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          AI Settings
        </h2>
        <p className="text-zinc-400 text-sm mt-1">
          Configure how the AI responds to messages on this page
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-red-400 font-medium">Error</h3>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
              <button
                onClick={() => {
                  clearError();
                  loadSettings();
                }}
                className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-400 font-medium">Settings saved successfully!</p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 space-y-6">
        {/* AI Status Toggle */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div>
            <h3 className="text-white font-semibold">Enable AI Responses</h3>
            <p className="text-zinc-400 text-sm mt-1">
              Allow AI to respond to messages automatically
            </p>
          </div>
          <button
            onClick={() => setFormData({ ...formData, aiEnabled: !formData.aiEnabled })}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              formData.aiEnabled ? 'bg-blue-500' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                formData.aiEnabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Auto Reply Toggle */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div>
            <h3 className="text-white font-semibold">Auto Reply</h3>
            <p className="text-zinc-400 text-sm mt-1">
              Automatically send AI responses without manual approval
            </p>
          </div>
          <button
            onClick={() => setFormData({ ...formData, autoReply: !formData.autoReply })}
            disabled={!formData.aiEnabled}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              formData.autoReply && formData.aiEnabled ? 'bg-blue-500' : 'bg-white/10'
            } ${!formData.aiEnabled && 'opacity-50 cursor-not-allowed'}`}
          >
            <div
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                formData.autoReply ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* AI Personality */}
        <div>
          <label className="block text-white font-semibold mb-2">
            AI Personality
          </label>
          <select
            value={formData.aiPersonality}
            onChange={(e) => setFormData({ ...formData, aiPersonality: e.target.value })}
            disabled={!formData.aiEnabled}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 disabled:opacity-50"
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="casual">Casual</option>
            <option value="technical">Technical</option>
          </select>
          <p className="text-zinc-500 text-xs mt-2">
            Choose the overall personality style for AI responses
          </p>
        </div>

        {/* Response Tone */}
        <div>
          <label className="block text-white font-semibold mb-2">
            Response Tone
          </label>
          <select
            value={formData.responseTone}
            onChange={(e) => setFormData({ ...formData, responseTone: e.target.value })}
            disabled={!formData.aiEnabled}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 disabled:opacity-50"
          >
            <option value="balanced">Balanced</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
            <option value="enthusiastic">Enthusiastic</option>
          </select>
          <p className="text-zinc-500 text-xs mt-2">
            Fine-tune the tone of voice used in responses
          </p>
        </div>

        {/* Response Length */}
        <div>
          <label className="block text-white font-semibold mb-2">
            Response Length
          </label>
          <select
            value={formData.responseLength}
            onChange={(e) => setFormData({ ...formData, responseLength: e.target.value })}
            disabled={!formData.aiEnabled}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 disabled:opacity-50"
          >
            <option value="short">Short - Brief and concise</option>
            <option value="medium">Medium - Balanced detail</option>
            <option value="detailed">Detailed - Comprehensive explanations</option>
          </select>
          <p className="text-zinc-500 text-xs mt-2">
            Control how verbose the AI responses should be
          </p>
        </div>

        {/* Custom Instructions */}
        <div>
          <label className="block text-white font-semibold mb-2">
            Custom Instructions
          </label>
          <textarea
            value={formData.customInstructions}
            onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
            disabled={!formData.aiEnabled}
            rows={6}
            placeholder="Add specific instructions for how the AI should behave on this page..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 disabled:opacity-50 resize-none"
          />
          <p className="text-zinc-500 text-xs mt-2">
            Provide specific guidance, context, or rules for the AI to follow
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving || !formData.aiEnabled}
            className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Settings
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-medium transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
