import { useState } from 'react';
import axios from 'axios';
import { marked } from 'marked';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function App() {
  const [transcript, setTranscript] = useState('');
  const [instruction, setInstruction] = useState(
    'Summarize in bullet points for executives and highlight only action items.'
  );
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState('');
  const [subject, setSubject] = useState('Meeting Summary');
  const [status, setStatus] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'md'].includes(ext)) {
      alert('Please upload a .txt or .md file for this demo.');
      return;
    }
    const text = await file.text();
    setTranscript(text);
  };

  const generate = async () => {
    if (!transcript.trim()) {
      alert('Please paste or upload a transcript.');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const resp = await axios.post(`${API_BASE}/api/summarize`, {
        transcript,
        instruction,
      });
      setSummary(resp.data.summary || '');
    } catch (err) {
      setStatus(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!summary.trim()) {
      alert('Generate or edit a summary first.');
      return;
    }
    const recipients = emails
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      alert('Enter at least one recipient email (comma-separated).');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const html = marked.parse(summary);
      await axios.post(`${API_BASE}/api/send-email`, {
        recipients,
        subject,
        html,
      });
      setStatus('✅ Email sent!');
    } catch (err) {
      setStatus(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: 'auto' }}>
      <h2>AI Meeting Notes Summarizer</h2>

      <textarea
        placeholder="Paste transcript here..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={8}
        style={{ width: '100%', marginBottom: '10px' }}
      />

      <input type="file" accept=".txt,.md" onChange={onFile} />

      <textarea
        placeholder="Custom instruction"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        rows={2}
        style={{ width: '100%', margin: '10px 0' }}
      />

      <button disabled={loading} onClick={generate}>
        {loading ? 'Generating...' : 'Generate Summary'}
      </button>

      {summary && (
        <>
          <h3>Summary (Editable)</h3>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={10}
            style={{ width: '100%', marginBottom: '10px' }}
          />

          <input
            type="text"
            placeholder="Recipients (comma separated)"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            style={{ width: '100%', marginBottom: '10px' }}
          />
          <input
            type="text"
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: '100%', marginBottom: '10px' }}
          />
          <button disabled={loading} onClick={sendEmail}>
            {loading ? 'Sending...' : 'Send via Email'}
          </button>
        </>
      )}

      {status && <p>{status}</p>}
    </div>
  );
}
