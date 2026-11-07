'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff, Loader2, X } from 'lucide-react';

interface DemoAccount {
  email: string;
  name: string;
  role: string;
  initial: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'alice@example.com',
    name: 'Alice Cooper',
    role: 'Host and owner',
    initial: 'A',
  },
  {
    email: 'bob@example.com',
    name: 'Bob Builder',
    role: 'Member',
    initial: 'B',
  },
];

interface DemoAccountsGridProps {
  onDevSignIn: (email: string, name: string, passcode: string) => Promise<void>;
  isLoading: boolean;
}

export function DemoAccountsGrid({ onDevSignIn, isLoading }: DemoAccountsGridProps) {
  const [selectedAccount, setSelectedAccount] = useState<DemoAccount | null>(null);
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (selectedAccount) {
      setPasscode('');
      setError(null);
      setShowPassword(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedAccount]);

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedAccount(null);
    setPasscode('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const cleanPasscode = passcode.trim();
    if (!cleanPasscode) {
      setError('Please enter the demo passcode.');
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onDevSignIn(selectedAccount.email, selectedAccount.name, cleanPasscode);
    } catch (err: unknown) {
      setError((err as Error).message || 'Incorrect passcode for demo accounts.');
      inputRef.current?.focus();
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <p className="demo-h">Or try a demo account</p>
      <div className="demo">
        {DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.email}
            type="button"
            onClick={() => setSelectedAccount(acc)}
            disabled={isLoading || isSubmitting}
            aria-label={`Sign in as ${acc.name}, ${acc.role}`}
          >
            <span>{acc.initial}</span>
            <div>
              <b>{acc.name}</b>
              {acc.role}
            </div>
          </button>
        ))}
      </div>

      {/* Demo Passcode Modal */}
      {selectedAccount && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(42, 26, 20, 0.55)',
            backdropFilter: 'blur(3px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '430px',
              background: '#FFFDF9',
              border: '2.5px solid var(--ink, #3B2B26)',
              borderRadius: '26px',
              boxShadow: '6px 6px 0 var(--ink, #3B2B26)',
              padding: '24px 20px',
              animation: 'slideUpFade 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    background: 'var(--lilac, #C5B4FF)',
                    border: '2px solid var(--ink, #3B2B26)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Lock className="w-5 h-5 text-stone-800" />
                </div>
                <div>
                  <h3
                    id="demo-modal-title"
                    style={{
                      margin: 0,
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
                      color: 'var(--ink, #3B2B26)',
                    }}
                  >
                    Demo Account Access
                  </h3>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: '0.82rem',
                      color: 'var(--muted, #7A5C54)',
                      fontWeight: 700,
                    }}
                  >
                    Protected access for <b>{selectedAccount.name}</b> ({selectedAccount.role})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: '2px solid var(--ink, #3B2B26)',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  color: 'var(--ink, #3B2B26)',
                  boxShadow: '2px 2px 0 var(--ink, #3B2B26)',
                  flexShrink: 0,
                }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label
                  htmlFor="demo-passcode"
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    marginBottom: '6px',
                    color: 'var(--ink, #3B2B26)',
                  }}
                >
                  Enter demo passcode
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    ref={inputRef}
                    id="demo-passcode"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter passcode"
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '12px 42px 12px 14px',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      borderRadius: '16px',
                      border: error ? '2px solid #b91c1c' : '2px solid var(--ink, #3B2B26)',
                      background: '#FFFFFF',
                      outline: 'none',
                      color: 'var(--ink, #3B2B26)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: 'var(--muted, #7A5C54)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div
                  role="alert"
                  style={{
                    padding: '8px 12px',
                    background: '#FEF2F2',
                    borderRadius: '12px',
                    border: '1.5px solid #F87171',
                    color: '#B91C1C',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="btn"
                  style={{
                    background: '#FFFFFF',
                    padding: '0 18px',
                    minHeight: '44px',
                    fontSize: '0.88rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn"
                  style={{
                    background: 'var(--tomato, #E8714F)',
                    color: '#FFFFFF',
                    padding: '0 20px',
                    minHeight: '44px',
                    fontSize: '0.88rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <span>Sign in as {selectedAccount.name.split(' ')[0]}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
