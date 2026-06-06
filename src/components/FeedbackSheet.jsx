import { useState } from 'react';
import BottomSheet from './ui/BottomSheet';
import PillButton from './ui/PillButton';
import InputField from './ui/InputField';

const FORMSPREE_URL = 'https://formspree.io/f/mykoekwg';
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function FeedbackSheet({ open, onClose }) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const isValid =
    email.trim() && EMAIL_RE.test(email.trim()) && message.trim().length > 0;

  const handleClose = () => {
    // Reset on close
    setName(''); setEmail(''); setMessage('');
    setSending(false); setSent(false); setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!isValid || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          _replyto: email.trim(),
          _subject: `MySurau feedback from ${name.trim() || email.trim()}`,
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent(true);
      setTimeout(() => handleClose(), 1500);
    } catch {
      setError("Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const btnLabel = sent ? 'Sent ✓' : sending ? 'Sending…' : 'Send feedback';

  return (
    <BottomSheet open={open} onClose={handleClose} detent="large" hideHandle>
      <div className="fs-container">
        <div className="fs-header">
          <h2 className="fs-title">We'd love to hear from you 💬</h2>
          <button className="sheet-close-btn" onClick={handleClose} aria-label="Close">✕</button>
        </div>
        <p className="fs-subtitle">
          Share your thoughts, report a bug or suggest a feature.
        </p>

        <div className="fs-fields">
          <InputField
            label="Name (optional)"
            id="fb-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
          />
          <InputField
            label="Email"
            id="fb-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <div className="input-field">
            <label className="input-field__label" htmlFor="fb-message">Message</label>
            <textarea
              id="fb-message"
              className="fs-textarea"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your feedback here…"
              rows={5}
            />
          </div>
        </div>

        {error && <p className="fs-error">{error}</p>}

        <PillButton
          onClick={handleSubmit}
          disabled={!isValid || sending || sent}
        >
          {btnLabel}
        </PillButton>
      </div>
    </BottomSheet>
  );
}
