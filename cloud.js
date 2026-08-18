/* Volumetric cloud for the design section.
   Raw WebGL: one fullscreen triangle and a raymarching fragment shader.
   A drifting cloud above a water plane, with the reflection marched
   through the same volume rather than mirrored, so ripples distort what
   is actually there. No texture, no model, no library. Renders below
   native resolution and only while the section is on screen: rays that
   hit water march the cloud twice, which is the whole cost here. */
(function () {
  'use strict';

  var cv = document.getElementById('cloud');
  if (!cv) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false });
  if (!gl) return;                       // no WebGL: the stage stays plain black

  var VERT =
    'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  var FRAG = [
    'precision highp float;',
    'uniform vec2 R;uniform float T;',

    'float hash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;',
    ' return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',

    'float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);',
    ' return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),',
    '                mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),',
    '            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),',
    '                mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}',

    'float fbm(vec3 p){float s=0.0,a=0.5;',
    ' for(int i=0;i<4;i++){s+=a*noise(p);p*=2.03;a*=0.5;}return s;}',

    // A slab of noise sitting above the water, drifting slowly.
    'float dens(vec3 p){p.x+=T*0.040;p.z+=T*0.018;',
    ' float d=fbm(p*0.95)-0.44;',
    ' d-=smoothstep(0.0,1.9,abs(p.y-1.75))*0.55;',
    ' return clamp(d,0.0,1.0);}',

    'vec3 sky(vec3 rd){float h=clamp(rd.y*0.5+0.5,0.0,1.0);',
    ' vec3 c=mix(vec3(0.034,0.042,0.058),vec3(0.075,0.090,0.130),h);',
    ' c+=vec3(0.30,0.13,0.05)*pow(1.0-h,5.0);return c;}',

    'vec4 march(vec3 ro,vec3 rd){vec4 acc=vec4(0.0);float t=0.6;',
    ' for(int i=0;i<32;i++){',
    '   if(acc.a>0.95) break;',
    '   vec3 p=ro+rd*t;',
    '   if(t>14.0) break;',
    '   float d=dens(p);',
    '   if(d>0.012){',
    '     float lit=clamp((d-dens(p+vec3(0.34,0.50,-0.20)))*2.8,0.0,1.0);',
    '     vec3 col=mix(vec3(0.24,0.27,0.36),vec3(1.0,0.98,0.96),lit);',
    '     col=mix(col,vec3(1.0,0.60,0.32),lit*lit*0.42);',
    '     col=mix(col,vec3(0.34,0.56,1.0),(1.0-lit)*0.26);',
    '     float al=d*0.60;',
    '     acc.rgb+=(1.0-acc.a)*col*al;',
    '     acc.a+=(1.0-acc.a)*al;',
    '   }',
    '   t+=max(0.08,0.16-d*0.09);',
    ' }',
    ' return acc;}',

    'void main(){',
    ' vec2 uv=(gl_FragCoord.xy*2.0-R)/R.y;',
    ' vec3 ro=vec3(0.0,0.62,-4.0);',
    ' vec3 rd=normalize(vec3(uv,1.5));',
    ' vec3 col;',
    ' if(rd.y<-0.002){',
    // Rays heading down hit the water plane at y=0. Perturb its normal
    // with crossing waves plus drifting noise, reflect, and march the
    // same cloud again: the reflection is the real cloud, not a flip.
    '   float tw=-ro.y/rd.y;',
    '   vec3 wp=ro+rd*tw;',
    '   float w1=sin(wp.x*3.1+T*1.05)+sin(wp.z*3.9-T*0.82);',
    '   float w2=noise(vec3(wp.xz*1.7,T*0.33))*2.0-1.0;',
    '   vec3 n=normalize(vec3(w1*0.035+w2*0.055,1.0,w1*0.028+w2*0.048));',
    '   vec3 rr=reflect(rd,n);rr.y=abs(rr.y);',
    '   vec4 a=march(vec3(wp.x,0.03,wp.z),rr);',
    '   vec3 refl=sky(rr)*(1.0-a.a)+a.rgb;',
    '   float fres=pow(1.0-clamp(dot(-rd,n),0.0,1.0),3.0);',
    '   col=mix(vec3(0.012,0.020,0.033),refl,clamp(0.26+fres*0.90,0.0,1.0));',
    // Water reads darker close to the camera and mirror-like far away.
    '   col*=mix(0.50,1.0,clamp(1.0+rd.y*2.1,0.0,1.0));',
    ' } else {',
    '   vec4 a=march(ro,rd);',
    '   col=sky(rd)*(1.0-a.a)+a.rgb;',
    ' }',
    ' col=pow(max(col,0.0),vec3(0.92));',
    ' gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console) console.warn('cloud shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  // One oversized triangle covers the viewport with no index buffer.
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uR = gl.getUniformLocation(prog, 'R');
  var uT = gl.getUniformLocation(prog, 'T');

  var SCALE = 0.55;                       // render below native, then upscale
  function resize() {
    var w = Math.max(1, Math.round(cv.clientWidth * SCALE));
    var h = Math.max(1, Math.round(cv.clientHeight * SCALE));
    if (cv.width === w && cv.height === h) return;
    cv.width = w; cv.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uR, w, h);
  }

  var raf = null, t0 = performance.now();

  function draw(now) {
    raf = window.requestAnimationFrame(draw);
    resize();
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function start() { if (!raf) { resize(); raf = window.requestAnimationFrame(draw); } }
  function stop()  { if (raf) { window.cancelAnimationFrame(raf); raf = null; } }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });

  var visible = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.02 }).observe(cv);
  } else {
    visible = true;
    start();
  }
})();
