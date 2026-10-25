import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useTheme } from "../theme/ThemeContext";

interface AuroraOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  hue: number;
  phase: number;
  speed: number;
}

export function AmbientSignalBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { theme } = useTheme();

  useEffect(() => {
    if (shouldReduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse spotlight coordinates with smooth interpolation
    let mouseX = width / 2;
    let mouseY = height / 3;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Initialize 4 ethereal floating aurora light fields
    const orbs: AuroraOrb[] = [
      {
        x: width * 0.25,
        y: height * 0.2,
        vx: 0.15,
        vy: 0.08,
        radius: 360,
        baseRadius: 360,
        hue: 160, // Emerald / Mint
        phase: 0,
        speed: 0.0008,
      },
      {
        x: width * 0.75,
        y: height * 0.3,
        vx: -0.12,
        vy: 0.1,
        radius: 400,
        baseRadius: 400,
        hue: 220, // Indigo / Sapphire
        phase: Math.PI * 0.5,
        speed: 0.0007,
      },
      {
        x: width * 0.5,
        y: height * 0.75,
        vx: 0.08,
        vy: -0.14,
        radius: 340,
        baseRadius: 340,
        hue: 260, // Violet
        phase: Math.PI,
        speed: 0.0006,
      },
      {
        x: width * 0.85,
        y: height * 0.85,
        vx: -0.09,
        vy: -0.07,
        radius: 300,
        baseRadius: 300,
        hue: 185, // Cyan
        phase: Math.PI * 1.5,
        speed: 0.0009,
      },
    ];

    let lastTime = performance.now();
    let isVisible = true;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const isDark = theme === "dark";

    const render = (now: number) => {
      if (!isVisible) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Smooth mouse lerp
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // Render drifting ethereal aurora light fields with soft radial gradients
      orbs.forEach((orb) => {
        orb.phase += orb.speed * (dt * 60);
        orb.x += orb.vx * (dt * 60);
        orb.y += orb.vy * (dt * 60);

        // Soft rebound inside canvas padding
        const pad = orb.radius * 0.6;
        if (orb.x < -pad) orb.vx = Math.abs(orb.vx);
        if (orb.x > width + pad) orb.vx = -Math.abs(orb.vx);
        if (orb.y < -pad) orb.vy = Math.abs(orb.vy);
        if (orb.y > height + pad) orb.vy = -Math.abs(orb.vy);

        // Subtle breathing radius
        const currentRadius = orb.baseRadius + Math.sin(orb.phase) * 40;

        const grad = ctx.createRadialGradient(
          orb.x,
          orb.y,
          0,
          orb.x,
          orb.y,
          currentRadius
        );

        if (isDark) {
          // Dark theme: deep emerald / indigo / cyan soft glow
          if (orb.hue === 160) {
            grad.addColorStop(0, "rgba(100, 230, 181, 0.085)");
            grad.addColorStop(0.5, "rgba(16, 185, 129, 0.035)");
            grad.addColorStop(1, "transparent");
          } else if (orb.hue === 220) {
            grad.addColorStop(0, "rgba(120, 169, 255, 0.075)");
            grad.addColorStop(0.5, "rgba(99, 102, 241, 0.03)");
            grad.addColorStop(1, "transparent");
          } else if (orb.hue === 260) {
            grad.addColorStop(0, "rgba(167, 139, 250, 0.065)");
            grad.addColorStop(0.5, "rgba(139, 92, 246, 0.025)");
            grad.addColorStop(1, "transparent");
          } else {
            grad.addColorStop(0, "rgba(6, 182, 212, 0.07)");
            grad.addColorStop(0.5, "rgba(56, 189, 248, 0.025)");
            grad.addColorStop(1, "transparent");
          }
        } else {
          // Light theme: ultra-delicate cool tints for high readability
          if (orb.hue === 160) {
            grad.addColorStop(0, "rgba(8, 127, 91, 0.045)");
            grad.addColorStop(0.5, "rgba(16, 185, 129, 0.02)");
            grad.addColorStop(1, "transparent");
          } else if (orb.hue === 220) {
            grad.addColorStop(0, "rgba(36, 95, 199, 0.04)");
            grad.addColorStop(0.5, "rgba(99, 102, 241, 0.015)");
            grad.addColorStop(1, "transparent");
          } else {
            grad.addColorStop(0, "rgba(147, 51, 234, 0.03)");
            grad.addColorStop(0.5, "rgba(168, 85, 247, 0.01)");
            grad.addColorStop(1, "transparent");
          }
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render interactive cursor spotlight
      if (mouseX > 0 && mouseY > 0) {
        const spotRadius = isDark ? 420 : 360;
        const spotGrad = ctx.createRadialGradient(
          mouseX,
          mouseY,
          0,
          mouseX,
          mouseY,
          spotRadius
        );

        if (isDark) {
          spotGrad.addColorStop(0, "rgba(100, 230, 181, 0.05)");
          spotGrad.addColorStop(0.4, "rgba(120, 169, 255, 0.025)");
          spotGrad.addColorStop(1, "transparent");
        } else {
          spotGrad.addColorStop(0, "rgba(36, 95, 199, 0.035)");
          spotGrad.addColorStop(0.4, "rgba(8, 127, 91, 0.015)");
          spotGrad.addColorStop(1, "transparent");
        }

        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, spotRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [shouldReduceMotion, theme]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
      data-testid="ambient-signal-background"
    >
      {/* ── Layer 1: Solid Base Theme Surface ── */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          theme === "dark" ? "bg-[#090D14]" : "bg-[#F4F7FB]"
        }`}
      />

      {/* ── Layer 2: Architectural Hairline Grid with Vignette ── */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.045] transition-opacity duration-500"
        style={{
          backgroundImage:
            theme === "dark"
              ? "linear-gradient(to right, #E8EEF7 1px, transparent 1px), linear-gradient(to bottom, #E8EEF7 1px, transparent 1px)"
              : "linear-gradient(to right, #172033 1px, transparent 1px), linear-gradient(to bottom, #172033 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 15%, black 40%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 15%, black 40%, transparent 85%)",
        }}
      />

      {/* ── Layer 3: Top Luminous Horizon Light Beam ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[1px] pointer-events-none"
        style={{
          background:
            theme === "dark"
              ? "linear-gradient(90deg, transparent 0%, rgba(100, 230, 181, 0.4) 30%, rgba(120, 169, 255, 0.6) 50%, rgba(167, 139, 250, 0.4) 70%, transparent 100%)"
              : "linear-gradient(90deg, transparent 0%, rgba(8, 127, 91, 0.3) 30%, rgba(36, 95, 199, 0.45) 50%, rgba(147, 51, 234, 0.3) 70%, transparent 100%)",
        }}
      />

      {/* ── Layer 4: Top Ambient Horizon Glow ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[280px] pointer-events-none rounded-full blur-[100px] opacity-70 transition-colors duration-500"
        style={{
          background:
            theme === "dark"
              ? "radial-gradient(ellipse at top, rgba(120, 169, 255, 0.08) 0%, rgba(100, 230, 181, 0.05) 50%, transparent 80%)"
              : "radial-gradient(ellipse at top, rgba(36, 95, 199, 0.06) 0%, rgba(8, 127, 91, 0.04) 50%, transparent 80%)",
        }}
      />

      {/* ── Layer 5: Dynamic Luminous Aurora & Interactive Spotlight Canvas ── */}
      {!shouldReduceMotion && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      )}
    </div>
  );
}
