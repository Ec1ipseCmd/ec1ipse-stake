"use client";

import React, { useEffect } from "react";
import Script from "next/script";

const particlesConfig = {
  background: {
    color: {
      value: "#121212",
    },
  },
  fpsLimit: 60,
  interactivity: {
    events: {
      onHover: {
        enable: false,
        mode: "repulse",
      },
      onClick: {
        enable: true,
        mode: "push",
      },
      resize: true,
    },
    modes: {
      repulse: {
        distance: 100,
        duration: 0.4,
      },
      push: {
        quantity: 4,
      },
    },
  },
  particles: {
    color: {
      value: "#e0e0e0",
    },
    links: {
      enable: false,
    },
    collisions: {
      enable: false,
    },
    move: {
      direction: "none",
      enable: true,
      outModes: {
        default: "bounce",
      },
      random: true,
      speed: 0.7,
      straight: false,
    },
    number: {
      density: {
        enable: true,
        area: 800,
      },
      value: 100,
    },
    opacity: {
      value: 0.5,
      random: true,
    },
    shape: {
      type: "circle",
    },
    size: {
      value: { min: 1, max: 6 },
    },
  },
  detectRetina: true,
};

const ParticlesBackground = () => {
  const initParticles = () => {
    if (window.tsParticles) {
      window.tsParticles.load("tsparticles", particlesConfig);
    } else {
      console.error("tsParticles not loaded");
    }
  };

  return (
    <>
      <div id="tsparticles"></div>
      <Script
        src="https://cdn.jsdelivr.net/npm/tsparticles@2.11.1/tsparticles.bundle.min.js"
        strategy="afterInteractive"
        onLoad={initParticles}
      />
    </>
  );
};

export default ParticlesBackground;
