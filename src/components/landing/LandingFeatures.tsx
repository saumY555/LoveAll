'use client';

import React from 'react';

export function LandingFeatures() {
  return (
    <section className="loveall-section" aria-labelledby="why">
      <div className="loveall-head">
        <h2 id="why">Why everyone loves sharing here</h2>
        <p>Simple, private, and made for fun, not for folders.</p>
      </div>
      <div className="loveall-feat">
        <article className="loveall-card loveall-c1">
          <div className="ico">✨</div>
          <h3>
            <span>Find friends instantly</span>
            <em>AI</em>
          </h3>
          <p>
            Pick one friend or several. &ldquo;Together&rdquo; shows photos with everyone you chose, &ldquo;Either&rdquo; shows photos with any of them.
          </p>
        </article>

        <article className="loveall-card loveall-c2">
          <div className="ico">⚡</div>
          <h3>
            <span>Smooth scrolling</span>
            <em>Fast</em>
          </h3>
          <p>
            Small previews load first, so big galleries scroll smoothly without eating your data. Full-quality originals stay safe.
          </p>
        </article>

        <article className="loveall-card loveall-c3">
          <div className="ico">🗂️</div>
          <h3>
            <span>No duplicate photos</span>
            <em>Smart</em>
          </h3>
          <p>
            Everyone uploads to one shared space. Duplicates are spotted automatically, and each photo still remembers who shared it.
          </p>
        </article>
      </div>
    </section>
  );
}
