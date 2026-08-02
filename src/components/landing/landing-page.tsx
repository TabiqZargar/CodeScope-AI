"use client";

import { Nav } from "./nav";
import { Hero } from "./hero";
import { DemoPreview } from "./demo-preview";
import { Features } from "./features";
import { Architecture } from "./architecture";
import { Showcase } from "./showcase";
import { Footer } from "./footer";

export function LandingPage() {
  return (
    <div className="font-coder-sans flex min-h-dvh flex-col">
      <Nav />
      <main className="flex-1">
        <Hero />
        <section className="mx-auto max-w-6xl px-5 pb-4">
          <div className="mx-auto max-w-3xl">
            <DemoPreview />
          </div>
        </section>
        <Features />
        <Architecture />
        <Showcase />
      </main>
      <Footer />
    </div>
  );
}
