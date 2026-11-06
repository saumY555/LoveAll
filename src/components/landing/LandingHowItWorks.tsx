'use client';

import React from 'react';

export function LandingHowItWorks() {
  return (
    <section className="loveall-section" aria-labelledby="how">
      <div className="loveall-head">
        <h2 id="how">Easy as 1, 2, 3</h2>
      </div>
      <ol className="loveall-steps">
        <li>
          <h3>Create an event</h3>
          <p>Get a 6-character passcode or QR code to share with friends.</p>
        </li>
        <li>
          <h3>Drop your photos</h3>
          <p>Everyone uploads their favorites. We speed them up and spot the faces.</p>
        </li>
        <li>
          <h3>Filter and download</h3>
          <p>Tap a friend to see your photos together, then download them all as a ZIP.</p>
        </li>
      </ol>
    </section>
  );
}
