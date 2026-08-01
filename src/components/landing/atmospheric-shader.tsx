"use client";

import { useEffect, useRef } from "react";

/**
 * Atmospheric background shader canvas as specified in the UI design mockup.
 * Renders an animated WebGL gradient with indigo and cyan radial glows.
 */
export function AtmosphericShader() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function syncSize() {
      const w = canvas?.clientWidth || 1280;
      const h = canvas?.clientHeight || 720;
      if (canvas && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    syncSize();

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(canvas);

    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 uv = v_texCoord;
    
    // Create a very subtle, dark atmospheric gradient base (#06070A)
    vec3 color = vec3(0.0235, 0.0275, 0.0392);
    
    // Large, slow moving radial gradients (Auroras)
    float t = u_time * 0.2;
    
    // Indigo glow bottom right
    float d1 = length(uv - vec2(0.8 + 0.2 * sin(t), 0.2 + 0.1 * cos(t)));
    vec3 indigo = vec3(0.4235, 0.3882, 1.0); // #6C63FF
    color += indigo * (0.08 * exp(-d1 * 2.5));
    
    // Cyan glow top left
    float d2 = length(uv - vec2(0.2 + 0.1 * cos(t * 0.8), 0.8 + 0.1 * sin(t * 1.2)));
    vec3 cyan = vec3(0.2745, 0.8392, 1.0); // #46D6FF
    color += cyan * (0.06 * exp(-d2 * 3.0));
    
    // Add very subtle noise texture
    float noise = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    color += (noise - 0.5) * 0.015;
    
    // Soft vignette
    float vignette = smoothstep(1.2, 0.4, length(uv - 0.5));
    color *= vignette;
    
    gl_FragColor = vec4(color, 1.0);
}`;

    function cs(type: number, src: string) {
      if (!gl) return null;
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    const prog = gl.createProgram();
    if (!prog) return;

    const vsShader = cs(gl.VERTEX_SHADER, vs);
    const fsShader = cs(gl.FRAGMENT_SHADER, fs);
    if (!vsShader || !fsShader) return;

    gl.attachShader(prog, vsShader);
    gl.attachShader(prog, fsShader);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");

    let animId: number;
    function render(t: number) {
      if (!gl || !canvas) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    }
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full opacity-40 pointer-events-none z-0">
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
