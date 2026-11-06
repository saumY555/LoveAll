'use client';

import React from 'react';

interface DemoAccountsGridProps {
  onDevSignIn: (email: string, name: string) => void;
  isLoading: boolean;
}

export function DemoAccountsGrid({ onDevSignIn, isLoading }: DemoAccountsGridProps) {
  return (
    <>
      <p className="demo-h">Or try a demo account</p>
      <div className="demo">
        <button
          type="button"
          onClick={() => onDevSignIn('alice@example.com', 'Alice Cooper')}
          disabled={isLoading}
          aria-label="Sign in as Alice Cooper, Host and owner"
        >
          <span>A</span>
          <div>
            <b>Alice Cooper</b>
            Host and owner
          </div>
        </button>

        <button
          type="button"
          onClick={() => onDevSignIn('bob@example.com', 'Bob Builder')}
          disabled={isLoading}
          aria-label="Sign in as Bob Builder, Member"
        >
          <span>B</span>
          <div>
            <b>Bob Builder</b>
            Member
          </div>
        </button>
      </div>
    </>
  );
}
