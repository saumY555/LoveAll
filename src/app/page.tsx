import React from 'react';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingJoinSection } from '@/components/landing/LandingJoinSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingMobileDock } from '@/components/landing/LandingMobileDock';

export default function HomePage() {
  return (
    <div className="loveall-landing">
      <div className="loveall-wrap">
        <LandingHeader />
        <main id="top">
          <LandingHero />
          <LandingFeatures />
          <LandingHowItWorks />
          <LandingJoinSection />
        </main>
        <LandingFooter />
      </div>
      <LandingMobileDock />
    </div>
  );
}
