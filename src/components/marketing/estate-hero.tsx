"use client";

/* eslint-disable @next/next/no-img-element -- art directed, masked, full bleed layers from fixed URLs */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/layout/logo";
import "./estate-hero.css";

/**
 * Morning / Night hero. Three layers (still blurred sky, a house layer that only moves on Y, live
 * WebGL2 fog) with the UI above. Switching sinks the house into rising fog, swaps the time of day
 * at the deepest point (fog fully covers the roof) and floats it back up, while sky, fog, nav,
 * headline and button colours are mixed on --k (0 morning, 1 night) by one requestAnimationFrame
 * clock. No CSS transitions drive the scene and no video is used.
 */

const IMG = (file: string, width: number, quality: number) =>
  `https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2F${file}&w=${width}&q=${quality}`;

const IMAGES = {
  skyMorning: IMG("hf_20261102_040343_a73684b4-3f71-4613-a843-c8be80fb1211.png", 1600, 80),
  skyNight: IMG("hf_20261102_040308_f31964ab-ed8e-4ea4-90eb-3226c0859936.png", 1600, 80),
  groundMorning: IMG("hf_20261102_040259_1be34093-835e-4de4-b3a8-f875e6a74591.png", 2560, 85),
  houseMorning: IMG("hf_20261102_040416_e3b05fa4-cc80-4a43-afde-8a0a053933e9.png", 2560, 85),
  groundNight: IMG("hf_20261102_040211_c8fd4865-285e-4c1f-8a37-4bfe0771357b.png", 2560, 85),
  houseNight: IMG("hf_20261102_040415_2ab95096-8c39-449f-b36c-17c2813815a4.png", 2560, 85),
};

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#benefits", label: "Benefits" },
  { href: "/#safeguards", label: "Safeguards" },
  { href: "/#faq", label: "FAQ" },
];

// Timings and depth of the switch (ms, fraction of the hero height).
const SINK = 240;
const RISE = 820;
const DEPTH = 0.27;
const FOG_MAX_WIDTH = 960;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const VERTEX = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 R;uniform float T,S,K;out vec4 O;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;mat2 m=mat2(1.6,1.2,-1.2,1.6);p=mat2(.8,.6,-.6,.8)*p+5.3;for(int i=0;i<5;i++){s+=a*n(p);p=m*p;a*=.5;}return s;}
void main(){
  vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
  float asp=R.x/R.y;vec2 p=vec2(uv.x*asp,uv.y);
  float t=T*.05;
  vec2 w=vec2(fbm(p*1.3+vec2(t,-t*.6)),fbm(p*1.3+vec2(-t*.8,t)+7.));
  float d=fbm(p*1.9+w*1.7+vec2(t*1.6,-t*1.1+S*.5));
  float e=fbm(p*.9-w+vec2(-t,t*.5)+3.);
  float low=smoothstep(.70,1.04,uv.y+(d-.5)*.34);
  float side=smoothstep(.2,.0,uv.x+(e-.5)*.28)+smoothstep(.8,1.,uv.x+(e-.5)*.28);
  side*=smoothstep(.25,.6,uv.y)*.2;
  float wisps=smoothstep(.5,.78,d)*smoothstep(.22,.5,uv.y)*smoothstep(.86,.6,uv.y)*.18;
  float rest=clamp(low+side+wisps,0.,1.);
  float front=1.02-S*.68;
  float rise=smoothstep(front-.02,front+.26,uv.y+(d-.5)*.5);
  float haze=S*(.3+.46*d);
  float a=clamp(max(rest,max(rise*.97,haze)),0.,1.);
  vec3 dayA=vec3(.97,.93,.84),dayB=vec3(.79,.78,.71);
  vec3 nitA=vec3(.40,.45,.57),nitB=vec3(.15,.19,.29);
  vec3 c=mix(mix(dayB,dayA,d*1.15),mix(nitB,nitA,d*1.1),K);
  float porch=exp(-dot((uv-vec2(.72,.74))*vec2(1.7,2.6),(uv-vec2(.72,.74))*vec2(1.7,2.6))*3.2);
  c=mix(c,vec3(.86,.55,.27),K*porch*.42*(1.-S));
  O=vec4(c*a,a);
}`;

type Time = 0 | 1;

export function EstateHero() {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const morningSetRef = useRef<HTMLDivElement>(null);
  const nightSetRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<(time: Time) => void>(() => undefined);
  const [pressed, setPressed] = useState<Time>(1);

  useEffect(() => {
    const hero = heroRef.current!;
    const canvas = canvasRef.current!;
    const style = hero.style;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let target: Time = 1;
    let from = 1;
    let start = -1e9;
    let queued: Time | null = null;
    let swapped = true;
    let k = 1;
    let animating = false;
    let clock = 0;
    let visible = true;
    let frameId = 0;

    const show = (time: Time) => {
      morningSetRef.current!.dataset.on = String(time === 0);
      nightSetRef.current!.dataset.on = String(time === 1);
    };

    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
    const uniforms: Record<"R" | "T" | "S" | "K", WebGLUniformLocation | null> = { R: null, T: null, S: null, K: null };
    let program: WebGLProgram | null = null;
    if (gl) {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
        return shader;
      };
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      gl.useProgram(program);
      for (const name of ["R", "T", "S", "K"] as const) uniforms[name] = gl.getUniformLocation(program, name);
    }

    const size = () => {
      if (!gl) return;
      const width = Math.round(Math.min(hero.clientWidth, FOG_MAX_WIDTH));
      const height = Math.round((width * hero.clientHeight) / Math.max(1, hero.clientWidth));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const begin = (time: Time, now: number) => {
      target = time;
      from = k;
      start = now;
      swapped = false;
      animating = true;
    };

    pickRef.current = (time: Time) => {
      if (time === target && queued === null) return;
      setPressed(time);
      if (calm) {
        target = time;
        k = time;
        show(time);
        frame(clock);
        return;
      }
      if (animating) queued = time;
      else begin(time, clock);
    };

    const frame = (now: number) => {
      clock = now;
      const d = now - start;
      let y = 0;
      let surge = 0;
      let dip = 0;
      let k2 = k;
      if (animating) {
        if (d < SINK) {
          const x = d / SINK;
          y = x * x * (3 - 2 * x) * DEPTH;
        } else {
          if (!swapped) {
            swapped = true;
            show(target);
          }
          const x = clamp((d - SINK) / RISE);
          y = Math.pow(1 - x, 3.4) * DEPTH;
        }
        surge = smooth(0, SINK * 0.92, d) * (1 - smooth(SINK + 70, SINK + RISE * 0.92, d));
        dip = smooth(30, 190, d) * (1 - smooth(330, 720, d));
        k = from + (target - from) * smooth(120, 520, d);
        k2 = from + (target - from) * smooth(340, 760, d);
        if (d >= SINK + RISE) {
          animating = false;
          k = k2 = target;
          y = surge = dip = 0;
          if (queued !== null && queued !== target) {
            const next = queued;
            queued = null;
            begin(next, now);
          } else queued = null;
        }
      }
      style.setProperty("--sink", `${(y * hero.clientHeight).toFixed(1)}px`);
      style.setProperty("--k", k.toFixed(3));
      style.setProperty("--k2", k2.toFixed(3));
      style.setProperty("--dip", dip.toFixed(3));
      if (gl) {
        gl.uniform2f(uniforms.R, canvas.width, canvas.height);
        // Reduced motion: a still fog bank instead of drifting fog.
        gl.uniform1f(uniforms.T, calm ? 12 : now / 1000);
        gl.uniform1f(uniforms.S, surge);
        gl.uniform1f(uniforms.K, k);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };

    const loop = (now: number) => {
      frame(now);
      frameId = visible && !document.hidden && !calm ? requestAnimationFrame(loop) : 0;
    };
    const resume = () => {
      if (!frameId && visible && !document.hidden) frameId = requestAnimationFrame(loop);
    };

    size();
    frameId = requestAnimationFrame(loop);
    const onResize = () => {
      size();
      if (calm) frame(clock);
    };
    window.addEventListener("resize", onResize);
    const onVisibility = () => (calm ? frame(performance.now()) : resume());
    document.addEventListener("visibilitychange", onVisibility);
    // Stop rendering while the hero is scrolled out of view.
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible && !calm) resume();
    });
    observer.observe(hero);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (gl && program) gl.deleteProgram(program);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <section ref={heroRef} className="eh-hero" aria-labelledby="hero-title">
      <div className="eh-layer eh-sky">
        <img alt="" src={IMAGES.skyMorning} decoding="async" fetchPriority="low" />
        <img alt="" src={IMAGES.skyNight} className="eh-sky-night" decoding="async" fetchPriority="high" />
      </div>
      <div className="eh-layer eh-home">
        <div ref={morningSetRef} className="eh-set" data-on="false">
          <div className="eh-layer eh-ground">
            <img alt="" src={IMAGES.groundMorning} decoding="async" fetchPriority="low" />
          </div>
          <img
            className="eh-cut"
            alt="A charcoal farmhouse with solar panels in soft morning light"
            src={IMAGES.houseMorning}
            decoding="async"
            fetchPriority="low"
          />
        </div>
        <div ref={nightSetRef} className="eh-set" data-on="true">
          <div className="eh-layer eh-ground">
            <img alt="" src={IMAGES.groundNight} decoding="async" fetchPriority="high" />
          </div>
          <img
            className="eh-cut"
            alt="The same farmhouse at dusk with warm amber windows"
            src={IMAGES.houseNight}
            fetchPriority="high"
          />
        </div>
      </div>
      <div className="eh-tilt" />
      <canvas ref={canvasRef} className="eh-fog" aria-hidden="true" />

      <div className="eh-ui">
        <header className="eh-bar">
          <Link className="eh-logo" href="/" aria-label="EstateFlow home" aria-current="page">
            <LogoMark />
            EstateFlow
          </Link>
          <nav aria-label="Main">
            <ul className="eh-links">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="eh-side">
            <Link className="eh-side-link" href="/sign-in">
              Sign in
            </Link>
            <Link className="eh-cta" href="/#pilot" aria-label="Book a pilot walkthrough">
              <span className="max-[820px]:hidden">Book a pilot walkthrough</span>
              <span className="min-[821px]:hidden">Book a pilot</span>
            </Link>
          </div>
        </header>

        <h1 id="hero-title" className="eh-title">
          <span className="eh-line1">Every visitor verified.</span>
          <span>
            <i>Every naira</i> <span className="eh-accent">accounted for.</span>
          </span>
        </h1>

        <div className="eh-dock">
          <div className="eh-toggle" role="group" aria-label="Time of day">
            <button type="button" className="eh-morning" aria-pressed={pressed === 0} onClick={() => pickRef.current(0)}>
              <b>Morning</b>
              <small>Passes in seconds</small>
            </button>
            <button type="button" className="eh-night" aria-pressed={pressed === 1} onClick={() => pickRef.current(1)}>
              <b>Night</b>
              <small>Alerts straight to the gate</small>
            </button>
          </div>
          <p className="eh-cap">
            Six digit visitor passes your guards check in seconds, dues paid through Paystack with
            <br /> real receipts, and a ledger every resident can read.
          </p>
        </div>
      </div>
    </section>
  );
}
