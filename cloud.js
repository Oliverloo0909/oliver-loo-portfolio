/* Volumetric cloud for the design section.
   Raw WebGL: one fullscreen triangle and a raymarching fragment shader.
   The form is generated per pixel from noise, so there is no texture,
   no model and no library involved. Renders at a fraction of device
   resolution and only while the section is on screen, because 40 march
   steps of 4-octave noise per pixel is the whole cost of the effect. */
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

    // A slab of noise that thins out vertically, so it reads as one
    // drifting mass rather than fog filling the frame.
    'float dens(vec3 p){p.x+=T*0.045;p.z+=T*0.02;',
    ' float d=fbm(p*1.05)-0.44;',
    ' d-=smoothstep(0.0,1.7,abs(p.y))*0.55;',
    ' return clamp(d,0.0,1.0);}',

    'void main(){',
    ' vec2 uv=(gl_FragCoord.xy*2.0-R)/R.y;',
    ' vec3 ro=vec3(0.0,0.05,-4.0);',
    ' vec3 rd=normalize(vec3(uv,1.55));',
    ' vec4 acc=vec4(0.0);float t=1.3;',
    ' for(int i=0;i<40;i++){',
    '   if(acc.a>0.96) break;',
    '   vec3 pos=ro+rd*t;',
    '   float d=dens(pos);',
    '   if(d>0.012){',
    // Cheap scattering: compare density toward the light to get a normal-ish term.
    '     float lit=clamp((d-dens(pos+vec3(0.36,0.52,-0.22)))*2.6,0.0,1.0);',
    '     vec3 col=mix(vec3(0.26,0.29,0.38),vec3(1.0,0.98,0.96),lit);',
    '     col=mix(col,vec3(1.0,0.60,0.32),lit*lit*0.42);',
    '     col=mix(col,vec3(0.36,0.58,1.0),(1.0-lit)*0.30);',
    '     float al=d*0.60;',
    '     acc.rgb+=(1.0-acc.a)*col*al;',
    '     acc.a+=(1.0-acc.a)*al;',
    '   }',
    '   t+=max(0.07,0.15-d*0.09);',
    ' }',
    ' float h=uv.y*0.5+0.5;',
    ' vec3 sky=mix(vec3(0.030,0.036,0.050),vec3(0.075,0.085,0.125),h);',
    ' sky+=vec3(0.22,0.10,0.04)*pow(1.0-h,3.5);',
    ' vec3 outc=sky*(1.0-acc.a)+acc.rgb;',
    ' outc=pow(max(outc,0.0),vec3(0.94));',
    ' gl_FragColor=vec4(outc,1.0);',
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

  var SCALE = 0.6;                       // render below native, then upscale
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
