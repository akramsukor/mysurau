export default function AccountDeletion() {
  return (
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#111827',
    }}>
      <div style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>MySurau</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
            Delete Your Account
          </h1>
          <p style={{ fontSize: 16, color: '#374151', lineHeight: 1.6 }}>
            You can delete your MySurau account directly from the app. This will permanently
            remove your account and all associated data.
          </p>
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
            How to delete your account
          </h2>
          <ol style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { step: 1, text: 'Open the MySurau app on your device.' },
              { step: 2, text: 'Tap the menu icon in the top right corner of the screen.' },
              { step: 3, text: 'Scroll to the bottom of the menu.' },
              { step: 4, text: 'Tap "Delete account".' },
              { step: 5, text: 'Confirm the deletion when prompted. Your account and all associated data will be permanently deleted.' },
            ].map(({ step, text }) => (
              <li key={step} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <span style={{
                  minWidth: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: '#111827',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {step}
                </span>
                <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.6, marginTop: 4 }}>
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* What gets deleted */}
        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: 12,
          padding: '24px',
          marginBottom: 48,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            What gets deleted
          </h2>
          <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Your account and profile information',
              'Your login credentials',
              'Any surau or mosque submissions linked to your account',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#6b7280', marginTop: 2 }}>•</span>
                <span style={{ fontSize: 14, color: '#374151' }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact fallback */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Need help?
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            If you're unable to access the app or need further assistance, email us at{' '}
            <a href="mailto:support@mysurau.com" style={{ color: '#111827', fontWeight: 500 }}>
              support@mysurau.com
            </a>{' '}
            and we'll process your request within 7 days.
          </p>
        </div>
      </div>
    </div>
  );
}
