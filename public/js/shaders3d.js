/* shaders3d.js — all GLSL for the Monster Arena 3D renderer */
(function (G) {
  'use strict';
  const H = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2DShadow;\n';

  // ---------- shared noise ----------
  const NOISE = `
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
vec2 h22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.3,9.1); a*=.5; } return s; }
float fbm3(vec2 p){ float a=.5, s=0.; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=p*2.07+vec2(5.2,1.3); a*=.5; } return s; }
// voronoi: returns (distToEdge, cellId)
vec2 vor(vec2 p){ vec2 n=floor(p), f=fract(p); float md=8.; vec2 mg, mr;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j); vec2 o=h22(n+g); vec2 r=g+o-f; float d=dot(r,r); if(d<md){ md=d; mr=r; mg=g; } }
  md=8.; for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){ vec2 g=mg+vec2(i,j); vec2 o=h22(n+g); vec2 r=g+o-f; if(dot(mr-r,mr-r)>1e-5) md=min(md, dot(.5*(mr+r), normalize(r-mr))); }
  return vec2(md, h21(n+mg)); }
`;

  // ---------- shared lighting ----------
  const LIGHT = `
uniform vec3 uEye;
uniform vec3 uSunDir, uSunCol, uSkyTop, uSkyHor, uGroundCol;
uniform vec3 uFogCol; uniform float uFogDen;
uniform vec4 uPL[10]; uniform vec3 uPLC[10]; uniform int uNPL;
uniform mat4 uLightVP; uniform sampler2DShadow uShadow; uniform float uShadowOn;
uniform float uTime;
in vec4 vSh;
vec3 skyEnv(vec3 d){
  float h = clamp(d.y,-1.,1.);
  vec3 c = mix(uSkyHor, uSkyTop, smoothstep(0.,.7,h));
  c = mix(c, uGroundCol, smoothstep(0.,-.4,h)*0.9);
  c += uSunCol * pow(max(dot(d,uSunDir),0.), 48.) * 1.5;
  return c;
}
float shadowAt(vec4 sc, float ndl){
  if(uShadowOn<.5) return 1.;
  vec3 p = sc.xyz/sc.w*.5+.5;
  if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
  float bias = 0.0016 + 0.004*(1.-ndl);
  vec2 ts = vec2(1./2048.);
  float s = 0.;
  s += texture(uShadow, vec3(p.xy, p.z-bias));
  s += texture(uShadow, vec3(p.xy+vec2( 1.2, 0.4)*ts, p.z-bias));
  s += texture(uShadow, vec3(p.xy+vec2(-1.2,-0.4)*ts, p.z-bias));
  s += texture(uShadow, vec3(p.xy+vec2( 0.4,-1.3)*ts, p.z-bias));
  s += texture(uShadow, vec3(p.xy+vec2(-0.4, 1.3)*ts, p.z-bias));
  s += texture(uShadow, vec3(p.xy+vec2( 2.4, 2.2)*ts, p.z-bias));
  s += texture(uShadow, vec3(p.xy+vec2(-2.4,-2.2)*ts, p.z-bias));
  s += texture(uShadow, vec3(p.xy+vec2( 2.2,-2.4)*ts, p.z-bias));
  s += texture(uShadow, vec3(p.xy+vec2(-2.2, 2.4)*ts, p.z-bias));
  return s/9.;
}
float D_GGX(float nh, float a){ float a2=a*a; float d=nh*nh*(a2-1.)+1.; return a2/(3.14159*d*d+1e-5); }
vec3 shade(vec3 wp, vec3 N, vec3 albedo, float rough, float metal, vec3 emis, float ao){
  vec3 V = normalize(uEye - wp);
  float ndv = max(dot(N,V), 0.001);
  rough = clamp(rough, .06, 1.);
  vec3 F0 = mix(vec3(.04), albedo, metal);
  vec3 diffC = albedo*(1.-metal);
  float a = rough*rough;
  // sun
  float ndl = max(dot(N,uSunDir),0.);
  float sh = ndl>0. ? shadowAt(vSh, ndl) : 1.;
  vec3 H = normalize(uSunDir+V); float nh=max(dot(N,H),0.), vh=max(dot(V,H),0.);
  vec3 F = F0 + (1.-F0)*pow(1.-vh,5.);
  vec3 spec = D_GGX(nh,a)*F*0.25/(max(ndl,.05)*max(ndv,.05)+.05) ;
  vec3 col = (diffC*ndl*(1.-F) + spec*ndl) * uSunCol * sh;
  // hemisphere + env
  vec3 hemi = mix(uGroundCol, uSkyTop*.9+uSkyHor*.4, N.y*.5+.5);
  col += diffC*hemi*ao*.75;
  vec3 R = reflect(-V,N);
  vec3 Fe = F0 + (max(vec3(1.-rough),F0)-F0)*pow(1.-ndv,5.);
  col += skyEnv(R)*Fe*ao*(1.-rough*.65)*(.35+.65*sh+metal*.5);
  // point lights
  for(int i=0;i<10;i++){
    if(i>=uNPL) break;
    vec3 Lv = uPL[i].xyz - wp; float d = length(Lv); float r = uPL[i].w;
    if(d>r) continue;
    vec3 L = Lv/d; float att = 1.-d/r; att*=att;
    float nl = max(dot(N,L),0.);
    vec3 Hh = normalize(L+V); float nhh = max(dot(N,Hh),0.);
    col += (diffC*nl + F0*D_GGX(nhh,a)*.25*nl) * uPLC[i] * att;
  }
  col += emis;
  // rim light (adds silhouette punch)
  col += uSkyTop*pow(1.-ndv,3.)*.12*ao;
  // fog
  float dist = length(uEye - wp);
  float fog = 1.-exp(-pow(dist*uFogDen,1.6));
  col = mix(col, uFogCol, clamp(fog,0.,1.));
  return col;
}
`;

  // ---------- lit mesh ----------
  const LIT_VS = H + `
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aCol;
uniform mat4 uVP, uModel, uLightVP;
out vec3 vW; out vec3 vN; out vec2 vUV; out vec4 vC; out vec4 vSh;
void main(){
  vec4 w = uModel*vec4(aPos,1.);
  vW = w.xyz; vN = normalize(transpose(inverse(mat3(uModel)))*aNrm); vUV=aUV; vC=aCol;
  vSh = uLightVP*w;
  gl_Position = uVP*w;
}`;
  const LIT_FS = H + NOISE + LIGHT + `
in vec3 vW; in vec3 vN; in vec2 vUV; in vec4 vC;
uniform vec3 uColor; uniform vec3 uEmissive; uniform float uRough, uMetal, uAlpha, uEmisK;
uniform int uMode; uniform int uTheme; uniform int uHasTex;
uniform sampler2D uAlbedo, uEmis;
uniform vec3 uFlash;
uniform float uRimK; uniform vec3 uRimCol;
out vec4 oCol;
// procedural world materials; returns albedo, modifies N,rough,emis
vec3 proc(int id, vec3 wp, inout vec3 N, inout float rough, inout vec3 emis, vec3 base){
  vec3 an = abs(N);
  vec2 uv = an.y>.7 ? wp.xz : vec2(wp.x*an.z + wp.z*an.x, wp.y);
  vec3 col = base;
  if(id==1){ // stone brick
    float rowH = 24., brickW = 52.;
    float row = floor(uv.y/rowH);
    float off = mod(row,2.)*brickW*.5;
    vec2 b = vec2(uv.x+off, uv.y);
    vec2 cell = vec2(floor(b.x/brickW), row);
    vec2 f = vec2(mod(b.x,brickW)/brickW, mod(b.y,rowH)/rowH);
    float mortar = 1. - smoothstep(0.,.07,min(min(f.x,1.-f.x), min(f.y,1.-f.y)));
    float v = h21(cell);
    col = base*(.72+.5*v) * (.85+.3*fbm3(uv*.05));
    col = mix(col, base*.35, mortar);
    N = normalize(N + vec3(0.,0.,0.) + (an.y>.7 ? vec3(0.) : vec3(0.)));
    rough = mix(.8,.95,mortar);
  } else if(id==2){ // rock
    float n = fbm(wp.xz*.04 + wp.y*.05);
    col = base*(.65+.7*n);
    float top = smoothstep(.55,.9,N.y);
    if(uTheme==1) col = mix(col, vec3(.16,.34,.13)*(.7+n), top*.85);
    else if(uTheme==2) col = mix(col, base*1.25+vec3(.08,.05,0.), top*.4);
    else if(uTheme==3){ col = mix(col, vec3(.82,.93,1.)*(.8+.3*n), top*.9); rough=.25; }
    else if(uTheme==4){ vec2 vv = vor(wp.xz*.03+wp.y*.03); float cr = smoothstep(.08,.0,vv.x); emis += vec3(1.,.35,.05)*cr*(1.4+.8*sin(uTime*2.+vv.y*20.)); col*=.8; }
    else if(uTheme==5){ vec2 vv = vor(wp.xz*.025+wp.y*.04); float cr = smoothstep(.1,.0,vv.x); emis += vec3(.7,.2,1.)*cr*(1.2+.6*sin(uTime*1.5+vv.y*20.)); }
    rough = max(rough,.7);
  } else if(id==3){ // wood crate planks
    float p = floor(uv.x/16.); float g = fbm3(vec2(uv.x*.5, uv.y*.05+p*3.));
    col = base*(.7+.6*g);
    float seam = 1.-smoothstep(0.,.8,abs(mod(uv.x,16.)-8.)-7.2);
    col *= 1.-.5*seam; rough=.85;
  } else if(id==4){ // metal plating
    float g = fbm3(uv*.08);
    col = base*(.75+.4*g); rough = .35 + .3*g;
    float rv = step(.93, h21(floor(uv/8.)))*.06; col += rv;
  } else if(id==5){ // glowing rune/trim
    float p = .65+.35*sin(uTime*2.2 + wp.x*.02 + wp.z*.02);
    emis += base*p*2.2; col = base*.5; rough=.4;
  } else if(id==6){ // floor tiles / planks
    vec2 f = fract(wp.xz/48.); vec2 c = floor(wp.xz/48.);
    float seam = 1.-smoothstep(0.,.05,min(min(f.x,1.-f.x),min(f.y,1.-f.y)));
    col = base*(.7+.5*h21(c))*(.9+.2*fbm3(wp.xz*.08)); col=mix(col,base*.3,seam); rough=.65;
  } else if(id==7){ // door-frame / trim w/ subtle glow strip
    col = base; rough=.5; emis += base*.4*(.6+.4*sin(uTime*3.));
  }
  return col;
}
void main(){
  vec3 N = normalize(vN);
  vec3 albedo; vec3 emis = uEmissive; float rough = uRough; float a = uAlpha;
  if(uHasTex==1){
    vec4 t = texture(uAlbedo, vUV);
    if(t.a<.5) discard;
    albedo = t.rgb*uColor;
    emis += texture(uEmis, vUV).rgb*uEmisK;
    // fake painted-relief detail: darken crevices using local luminance
  } else {
    albedo = vC.rgb*uColor;
    if(uMode==1) albedo = proc(int(vC.a+.5), vW, N, rough, emis, albedo);
  }
  float ao = mix(.55,1.,smoothstep(0.,70.,vW.y));
  if(uMode==0) ao = 1.;
  vec3 col = shade(vW, N, albedo, rough, uMetal, emis, ao);
  col += uFlash;
  if(uRimK>0.){ float f = pow(1.-max(dot(N,normalize(uEye-vW)),0.),2.5); col += uRimCol*f*uRimK; a = clamp(a + f*.5*uRimK,0.,1.); }
  oCol = vec4(col, a);
}`;

  // ---------- depth only (shadow) ----------
  const DEPTH_VS = H + `
layout(location=0) in vec3 aPos; layout(location=2) in vec2 aUV;
uniform mat4 uLightVP, uModel; out vec2 vUV;
void main(){ vUV=aUV; gl_Position = uLightVP*uModel*vec4(aPos,1.); }`;
  const DEPTH_FS = H + `
in vec2 vUV; uniform int uHasTex; uniform sampler2D uAlbedo; out vec4 o;
void main(){ if(uHasTex==1 && texture(uAlbedo,vUV).a<.5) discard; o=vec4(1.); }`;

  // ---------- ground ----------
  const GROUND_VS = H + `
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aCol;
uniform mat4 uVP, uLightVP; out vec3 vW; out vec3 vGN; out vec4 vSh;
void main(){ vW=aPos; vGN=aNrm; vSh=uLightVP*vec4(aPos,1.); gl_Position=uVP*vec4(aPos,1.); }`;
  const GROUND_FS = H + NOISE + LIGHT + `
in vec3 vW; in vec3 vGN; uniform int uTheme; uniform vec2 uWorld; uniform vec3 uAccent;
out vec4 oCol;
float gh(vec2 p){ // height for bump
  if(uTheme==1) return fbm(p*.35)*.8 + fbm3(p*.04)*.6;
  if(uTheme==2){ float r = sin((p.x*.7+p.y*.45)*.018 + fbm3(p*.01)*5.)*.5+.5; return r*1.4 + sin((p.x*.4-p.y*.6)*.55+fbm3(p*.1)*3.)*.12; }
  if(uTheme==3){ return fbm(p*.05)*.6; }
  if(uTheme==4){ vec2 v=vor(p*.012); return smoothstep(0.,.12,v.x)*.9 + fbm3(p*.1)*.25; }
  return fbm3(p*.06)*.3;
}
void main(){
  vec2 p = vW.xz;
  float e = 1.5;
  float h0 = gh(p), hx = gh(p+vec2(e,0.)), hz = gh(p+vec2(0.,e));
  float bump = uTheme==2 ? 3.2 : (uTheme==3 ? 1.2 : (uTheme==5 ? .6 : 2.4));
  vec3 N = normalize(vGN + vec3(-(hx-h0)/e*bump, 0., -(hz-h0)/e*bump));
  vec3 alb; float rough=.85, metal=0.; vec3 emis=vec3(0.);
  float t = uTime;
  if(uTheme==1){ // MEADOW
    float n1 = fbm(p*.008), n2 = fbm(p*.22), n3 = fbm3(p*1.3);
    vec3 g1 = vec3(.07,.2,.06), g2 = vec3(.16,.34,.09), dirt = vec3(.2,.13,.07);
    alb = mix(g1,g2,n1*.9+n2*.5);
    alb *= .8+.5*n3;
    float patch_ = smoothstep(.62,.72,fbm(p*.012+9.));
    alb = mix(alb, dirt*(.7+n2*.6), patch_);
    // flowers
    vec2 fc = floor(p/38.); vec2 fo = h22(fc)*38.; float fd = length(fract(p/38.)*38.-fo);
    float fl = step(.86,h21(fc+3.))*smoothstep(3.2,1.8,fd)*(1.-patch_);
    vec3 fcol = mix(vec3(1.,.9,.3), vec3(1.,.45,.7), step(.5,h21(fc+7.)));
    alb = mix(alb, fcol, fl); emis += fcol*fl*.15;
    // grass-blade stripes
    alb *= .92+.16*vnoise(vec2(p.x*.9, p.y*.12));
    rough=.9;
  } else if(uTheme==2){ // DESERT
    float r = gh(p)/1.5;
    vec3 s1 = vec3(.42,.31,.15), s2 = vec3(.66,.5,.26);
    alb = mix(s1,s2,r*.8+fbm(p*.03)*.3);
    float grain = vnoise(p*2.7); alb *= .9+.2*grain;
    float spark = step(.992, h21(floor(p*1.3))) ; emis += vec3(1.,.85,.5)*spark*.25;
    rough=.95;
  } else if(uTheme==3){ // ICE
    vec2 v1 = vor(p*.011); vec2 v2 = vor(p*.032+7.);
    float crack = smoothstep(.045,.0,v1.x)*.8 + smoothstep(.03,.0,v2.x)*.45;
    vec3 deep = vec3(.04,.14,.27), shallow = vec3(.22,.5,.75);
    alb = mix(deep, shallow, fbm(p*.012)*.9+.1*v1.y);
    alb = mix(alb, vec3(.75,.92,1.), crack*.45);
    float frost = smoothstep(.6,.8,fbm(p*.02+3.)); alb = mix(alb, vec3(.8,.9,.98), frost*.55);
    emis += vec3(.3,.7,1.)*crack*.15;
    rough = mix(.1,.45,frost); metal=.0;
  } else if(uTheme==4){ // LAVA
    vec2 v1 = vor(p*.012); vec2 v2 = vor(p*.04+3.);
    float crack = smoothstep(.07,.0,v1.x)*.9 + smoothstep(.035,.0,v2.x)*.5;
    float pulse = .65+.35*sin(t*1.7+v1.y*30.)*sin(t*.9+v2.y*13.);
    vec3 rock = mix(vec3(.04,.025,.025), vec3(.12,.07,.06), fbm(p*.03));
    alb = rock*(.8+.4*vnoise(p*1.7));
    emis += mix(vec3(1.,.15,.02), vec3(1.,.7,.15), crack*crack)*crack*pulse*.95;
    // ash drift
    alb = mix(alb, vec3(.2,.19,.19), smoothstep(.65,.85,fbm(p*.02+11.))*.5);
    rough=.8;
  } else { // VOID
    vec3 base = vec3(.03,.02,.07);
    float n = fbm(p*.006 + vec2(t*.01,0.));
    alb = base + vec3(.05,.02,.1)*n;
    vec2 g = abs(fract(p/128.)-.5); float line = smoothstep(.012,.0,min(g.x,g.y)*1.);
    line *= .6+.4*sin(t*1.3+(p.x+p.y)*.004);
    float line2 = smoothstep(.006,.0,min(abs(fract(p/512.)-.5).x,abs(fract(p/512.)-.5).y));
    vec3 neon = mix(vec3(.55,.2,1.), vec3(.2,.8,1.), n);
    emis += neon*(line*.35+line2*.9);
    // nebula wisps
    float neb = fbm(p*.004+3.+vec2(0.,t*.006)); emis += vec3(.25,.08,.45)*smoothstep(.5,.85,neb)*.5;
    // stars reflected in glossy floor
    float st = step(.9965,h21(floor(p*.5))); emis += vec3(.9,.8,1.)*st*(.5+.5*sin(t*3.+p.x));
    rough=.28; metal=.35;
  }
  // arena boundary: outside = darker, desaturated, then fades into fog
  vec2 q = p - uWorld*.5; vec2 dq = abs(q) - uWorld*.5;
  float out_ = max(dq.x,dq.y);
  float k = smoothstep(0.,260.,out_);
  alb = mix(alb, alb*.25+uFogCol*.1, k);
  emis *= 1.-k*.8;
  // inside: gentle vignette around world edges (inner darkening)
  float inner = smoothstep(-260.,0.,out_)*(1.-k);
  alb *= 1.-.25*inner;
  vec3 col = shade(vW, N, alb, rough, metal, emis, 1.);
  oCol = vec4(col,1.);
}`;

  // ---------- hazards ----------
  const HAZ_VS = H + `
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aCol;
uniform mat4 uVP; uniform vec4 uRect; uniform float uY; out vec3 vW; out vec2 vL; out vec4 vSh;
uniform mat4 uLightVP;
void main(){
  vec2 pad = vec2(40.);
  vec2 c = uRect.xy + uRect.zw*.5; vec2 hs = uRect.zw*.5 + pad;
  vec2 p = c + vec2(aPos.x*2.,aPos.z*2.)*hs; // aPos in [-.5,.5]
  vW = vec3(p.x, uY, p.y); vL = p - c; vSh = uLightVP*vec4(vW,1.);
  gl_Position = uVP*vec4(vW,1.);
}`;
  const HAZ_FS = H + NOISE + LIGHT + `
in vec3 vW; in vec2 vL;
uniform vec4 uRect; uniform int uKind; uniform float uPhase; uniform float uPhaseK; uniform float uSeed;
out vec4 oCol;
float sdBox(vec2 p, vec2 b, float r){ vec2 d=abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
void main(){
  vec2 hs = uRect.zw*.5;
  vec2 pw = vL + (fbm(vW.xz*.03+uSeed)-.5)*38. + (fbm(vW.xz*.09+uSeed*2.)-.5)*14.;
  float d = sdBox(pw, hs-vec2(18.), 46.);
  if(d>0.) discard;
  float depth = clamp(-d/70.,0.,1.);          // 0 at rim, 1 deep inside
  float rim = smoothstep(14.,0.,-d);
  vec3 V = normalize(uEye-vW);
  vec2 par = V.xz/max(V.y,.2) * (depth*28.);
  vec2 p = vW.xz - par;
  float t = uTime;
  vec3 col; vec3 emis=vec3(0.); vec3 N=vec3(0.,1.,0.); float rough=.6; vec3 alb=vec3(.1);
  float a=1.;
  if(uKind==0){ // QUICKSAND: spiral swirl sinking
    vec2 c = uRect.xy+uRect.zw*.5; vec2 r = p-c; float ang=atan(r.y,r.x); float rad=length(r);
    float sp = sin(ang*3.+rad*.045 - t*.7 + fbm(p*.02)*3.)*.5+.5;
    alb = mix(vec3(.2,.13,.06), vec3(.5,.36,.18), sp*.7+fbm(p*.07)*.3);
    alb *= mix(1., .35, depth);
    N = normalize(vec3((sp-.5)*.5*sin(ang), 1., (sp-.5)*.5*cos(ang)));
    rough=.95;
    alb = mix(alb, vec3(.62,.46,.22), rim*.6);
  } else if(uKind==1){ // ICE CHASM: dark abyss with glowing depth
    float l1 = fbm(p*.02 + t*.01), l2 = fbm(p*.045 - t*.015 + 5.);
    vec3 abyss = mix(vec3(.01,.03,.07), vec3(.03,.18,.38), l1);
    vec2 v = vor(p*.025); float crk = smoothstep(.06,.0,v.x);
    alb = abyss*(1.-depth*.6);
    emis += vec3(.1,.5,1.)*(l2*.35*depth + crk*.5*depth);
    alb = mix(alb, vec3(.8,.95,1.), rim*.85);
    emis += vec3(.4,.8,1.)*rim*.5;
    rough=.15;
  } else if(uKind==2){ // LAVA
    vec2 q = p*.018; q += vec2(fbm(q+t*.05), fbm(q-t*.04+4.))*1.4;
    float f = fbm(q*1.5+vec2(t*.07,0.));
    float cool = smoothstep(.35,.7,f);
    float hot = 1.-cool;
    float ph = uPhase; // 0 dormant 1 warn 2 erupt 3 after
    float boost = ph<.5?.4 : (ph<1.5? .6+.3*sin(t*14.) : (ph<2.5? 1.25 : .8));
    vec3 crust = vec3(.05,.02,.02)*(.6+f);
    vec3 glow = mix(vec3(1.,.12,.0), vec3(1.,.75,.2), hot*hot);
    alb = crust; emis += glow*hot*boost*.9 + glow*.1*boost;
    if(ph>2.5 && ph<3.5) emis*=1.-uPhaseK*.3;
    emis += vec3(1.,.5,.1)*rim*.8*boost;
    rough=.5;
  } else { // VOID
    vec2 c = uRect.xy+uRect.zw*.5; vec2 r = p-c; float ang=atan(r.y,r.x); float rad=length(r);
    float sw = sin(ang*5.+rad*.03-t*1.4)*.5+.5;
    float n = fbm(p*.03 + t*.03);
    alb = vec3(.01,.0,.03);
    emis += mix(vec3(.5,.1,.9), vec3(.1,.6,1.), n)*(sw*.35+n*.5)*depth*1.2;
    float st = step(.985, h21(floor(p*.6))); emis += vec3(1.)*st*(.6+.4*sin(t*4.+p.x))*depth;
    emis += vec3(.8,.3,1.)*rim*1.2;
    rough=.2;
  }
  vec3 outc = shade(vec3(vW.x,vW.y,vW.z), N, alb, rough, 0., emis, 1.);
  oCol = vec4(outc, 1.);
}`;

  // ---------- particles (instanced billboards / decals) ----------
  const PART_VS = H + `
layout(location=4) in vec4 iA; layout(location=5) in vec4 iB; layout(location=6) in vec4 iC;
uniform mat4 uVP; uniform vec3 uRight, uUp, uEye;
out vec2 vUV; out vec4 vCol; out vec3 vP; flat out vec4 vInfo; out float vFog;
void main(){
  int id = gl_VertexID;
  vec2 c = vec2(float(id&1)*2.-1., float(id>>1)*2.-1.);
  float sz = iA.w, rot = iC.x; float kind = iC.y; float param = iC.z; float orient = iC.w;
  vec3 P = iA.xyz; vec3 w;
  if(orient<.5){
    float cs=cos(rot), sn=sin(rot); vec2 rc = vec2(c.x*cs-c.y*sn, c.x*sn+c.y*cs)*sz;
    w = P + uRight*rc.x + uUp*rc.y;
  } else if(orient<1.5){
    float cs=cos(rot), sn=sin(rot); vec2 rc = vec2(c.x*cs-c.y*sn, c.x*sn+c.y*cs)*sz;
    w = P + vec3(rc.x,0.,rc.y);
  } else {
    vec3 ax = vec3(cos(rot),0.,sin(rot));
    vec3 side = normalize(cross(ax, uEye-P));
    w = P + ax*c.x*sz*param + side*c.y*sz;
  }
  vUV = c; vCol = iB; vP=w; vInfo = vec4(kind, param, orient, rot);
  float dist = length(uEye-w); vFog = clamp(1.-exp(-pow(dist*.00028,1.6)),0.,1.);
  gl_Position = uVP*vec4(w,1.);
}`;
  const PART_FS = H + NOISE + `
in vec2 vUV; in vec4 vCol; in vec3 vP; flat in vec4 vInfo; in float vFog;
uniform float uTime; uniform float uAdd; out vec4 oCol;
void main(){
  float kind = vInfo.x, param = vInfo.y; vec2 uv = vUV; float r = length(uv);
  float a = 0.; vec3 tint = vec3(1.);
  if(kind<.5){ a = exp(-r*r*3.2)*step(r,1.); a *= smoothstep(1.,.7,r); }
  else if(kind<1.5){ a = smoothstep(1.,.78,r); tint = mix(vec3(1.), vCol.rgb, smoothstep(0.,.8,r)); tint = mix(vec3(1.4), tint, smoothstep(0.,.5,r)); }
  else if(kind<2.5){ float w = max(param,.04); a = smoothstep(w,0.,abs(r-.86))*step(r,1.); }
  else if(kind<3.5){ float n = fbm(uv*2.2+vP.xz*.01+uTime*.2); a = smoothstep(1.,.2,r)*(.4+.9*n)*.9; a=clamp(a,0.,1.); }
  else if(kind<4.5){ a = exp(-uv.y*uv.y*10.)*smoothstep(1.,.3,abs(uv.x)); tint = mix(vec3(1.3), vec3(1.), abs(uv.x)); }
  else if(kind<5.5){ float cr = exp(-abs(uv.x)*14.)*smoothstep(1.,.0,abs(uv.y)) + exp(-abs(uv.y)*14.)*smoothstep(1.,.0,abs(uv.x)); a = cr + exp(-r*r*6.)*.9; }
  else if(kind<6.5){ // arc ring: param = fraction filled, from top clockwise
    float ang = atan(uv.x, -uv.y); if(ang<0.) ang += 6.28318; float f = ang/6.28318;
    float ring = smoothstep(.11,.0,abs(r-.9))*step(r,1.);
    a = ring*(f<=param ? 1. : .16);
  }
  else if(kind<7.5){ // telegraph disc: fill + edge
    float fill = smoothstep(1.,.97,r)*(.16+.1*sin(uTime*10.));
    float edge = smoothstep(.06,.0,abs(r-.96));
    a = fill+edge;
  }
  else if(kind<8.5){ // triangle shard
    vec2 q = vec2(abs(uv.x), uv.y); float tri = step(q.x*1.2, (1.-q.y)*.5+.0)*step(-1.,q.y)*step(q.y,1.); a = tri; }
  else if(kind<9.5){ // dashed ring
    float ang = atan(uv.y, uv.x); float dsh = step(.5, fract(ang*5.2 + param));
    a = smoothstep(.1,.0,abs(r-.92))*dsh*step(r,1.); }
  else if(kind<10.5){ // swirl (maelstrom / vortex) ground
    float ang = atan(uv.y,uv.x); float sp = sin(ang*4. - r*9. + uTime*5.)*.5+.5;
    a = smoothstep(1.,.2,r)*sp*smoothstep(0.,.25,r); }
  else if(kind<11.5){ // radial gradient soft disc
    a = smoothstep(1.,0.,r); a*=a; }
  else { // outside-of-circle danger tint (param = inner radius fraction)
    float rr = max(abs(uv.x),abs(uv.y)); float d = length(uv)-param; a = smoothstep(0.,.03,d)*(.5+.5*sin(uTime*2.+r*30.))*.5+smoothstep(0.,.03,d)*.5; a *= step(rr,.999); }
  a *= vCol.a;
  vec3 c = vCol.rgb*tint;
  c = mix(c, vec3(0.), uAdd>.5 ? vFog : 0.);
  if(uAdd>.5) oCol = vec4(c*a*.62, 0.);   // additive (blend ONE,ONE)
  else oCol = vec4(c, a);              // alpha
}`;

  // ---------- ribbons ----------
  const RIB_VS = H + `
layout(location=0) in vec3 aPos; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aCol;
uniform mat4 uVP; out vec2 vUV; out vec4 vC;
void main(){ vUV=aUV; vC=aCol; gl_Position=uVP*vec4(aPos,1.); }`;
  const RIB_FS = H + `
in vec2 vUV; in vec4 vC; out vec4 oCol;
void main(){
  float edge = 1.-abs(vUV.y*2.-1.);          // 0 at borders -> 1 at centre
  float core = smoothstep(.55,1.,edge);
  float a = pow(edge,1.6);
  vec3 c = vC.rgb*(a*.8) + vec3(1.)*core*.7;
  oCol = vec4(c*vC.a*(.4+.6*a), 0.);
}`;

  // ---------- sky ----------
  const SKY_VS = H + `
out vec2 vP; void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); vP = p*2.-1.; gl_Position=vec4(vP,.9999,1.); }`;
  const SKY_FS = H + NOISE + `
in vec2 vP; uniform mat4 uInvVP; uniform vec3 uEye, uSkyTop, uSkyHor, uFogCol, uSunDir, uSunCol; uniform float uTime; uniform int uTheme; out vec4 oCol;
void main(){
  vec4 f = uInvVP*vec4(vP,1.,1.); vec3 d = normalize(f.xyz/f.w - uEye);
  float h = d.y;
  vec3 c = mix(uFogCol, mix(uSkyHor, uSkyTop, smoothstep(0.,.5,h)), smoothstep(-.15,.1,h));
  vec2 sp = d.xz/(abs(h)+.25);
  if(uTheme==5){ float st = step(.992,h21(floor(d.xz*220.+d.y*90.))); c += vec3(.9,.8,1.)*st*(.4+.6*sin(uTime*3.+d.x*200.)); c += vec3(.25,.06,.45)*fbm(sp*1.6+uTime*.01)*smoothstep(0.,.5,h); }
  if(uTheme==3){ float au = fbm(vec2(sp.x*1.5+uTime*.03, sp.y*3.)); c += vec3(.1,.7,.6)*pow(au,2.)*smoothstep(.0,.5,h)*.7; }
  if(uTheme==4){ c += vec3(.6,.1,.0)*fbm(sp*2.+uTime*.05)*smoothstep(.4,-.1,h)*.8; }
  c += uSunCol*pow(max(dot(d,uSunDir),0.),90.)*2.5;
  oCol = vec4(c,1.);
}`;

  // ---------- post-processing ----------
  const FS_VS = H + `out vec2 vUV; void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); vUV=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;
  const PRE_FS = H + `
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThresh; out vec4 o;
void main(){
  vec3 c = vec3(0.); c += texture(uTex, vUV+uTexel*vec2(-1.,-1.)).rgb; c += texture(uTex, vUV+uTexel*vec2(1.,-1.)).rgb;
  c += texture(uTex, vUV+uTexel*vec2(-1.,1.)).rgb; c += texture(uTex, vUV+uTexel*vec2(1.,1.)).rgb; c*=.25;
  float br = max(c.r,max(c.g,c.b)); float knee = uThresh*.6;
  float soft = clamp(br-uThresh+knee,0.,2.*knee); soft = soft*soft/(4.*knee+1e-4);
  float k = max(soft, br-uThresh)/max(br,1e-4);
  o = vec4(min(c*k, vec3(40.)),1.);
}`;
  const DOWN_FS = H + `
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){
  vec3 a=texture(uTex,vUV+uTexel*vec2(-2,-2)).rgb, b=texture(uTex,vUV+uTexel*vec2(0,-2)).rgb, c=texture(uTex,vUV+uTexel*vec2(2,-2)).rgb;
  vec3 d=texture(uTex,vUV+uTexel*vec2(-2,0)).rgb, e=texture(uTex,vUV).rgb, f=texture(uTex,vUV+uTexel*vec2(2,0)).rgb;
  vec3 g=texture(uTex,vUV+uTexel*vec2(-2,2)).rgb, h=texture(uTex,vUV+uTexel*vec2(0,2)).rgb, i=texture(uTex,vUV+uTexel*vec2(2,2)).rgb;
  vec3 j=texture(uTex,vUV+uTexel*vec2(-1,-1)).rgb, k=texture(uTex,vUV+uTexel*vec2(1,-1)).rgb, l=texture(uTex,vUV+uTexel*vec2(-1,1)).rgb, m=texture(uTex,vUV+uTexel*vec2(1,1)).rgb;
  o = vec4(e*.125 + (a+c+g+i)*.03125 + (b+d+f+h)*.0625 + (j+k+l+m)*.125, 1.);
}`;
  const UP_FS = H + `
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uK; out vec4 o;
void main(){
  vec3 s = texture(uTex,vUV).rgb*4.;
  s += texture(uTex,vUV+uTexel*vec2(-1,0)).rgb*2.; s += texture(uTex,vUV+uTexel*vec2(1,0)).rgb*2.;
  s += texture(uTex,vUV+uTexel*vec2(0,-1)).rgb*2.; s += texture(uTex,vUV+uTexel*vec2(0,1)).rgb*2.;
  s += texture(uTex,vUV+uTexel*vec2(-1,-1)).rgb; s += texture(uTex,vUV+uTexel*vec2(1,-1)).rgb;
  s += texture(uTex,vUV+uTexel*vec2(-1,1)).rgb; s += texture(uTex,vUV+uTexel*vec2(1,1)).rgb;
  o = vec4(s/16.*uK,1.);
}`;
  const COMP_FS = H + `
in vec2 vUV; uniform sampler2D uScene, uBloom; uniform vec2 uRes; uniform float uBloomK, uExposure, uTime, uHurt, uLow, uFXAA, uGrain, uVig;
uniform vec3 uTint; uniform float uSat, uContrast, uFlash; uniform vec3 uFlashCol; uniform float uAber;
out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
float luma(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
vec3 fxaa(vec2 uv){
  vec2 px = 1./uRes;
  vec3 cM = texture(uScene,uv).rgb;
  vec3 cN = texture(uScene,uv+vec2(0,-px.y)).rgb, cS = texture(uScene,uv+vec2(0,px.y)).rgb;
  vec3 cW = texture(uScene,uv+vec2(-px.x,0)).rgb, cE = texture(uScene,uv+vec2(px.x,0)).rgb;
  float lM=luma(min(cM,vec3(4.))), lN=luma(min(cN,vec3(4.))), lS=luma(min(cS,vec3(4.))), lW=luma(min(cW,vec3(4.))), lE=luma(min(cE,vec3(4.)));
  float mn=min(lM,min(min(lN,lS),min(lW,lE))), mx=max(lM,max(max(lN,lS),max(lW,lE)));
  if(mx-mn < max(.05, mx*.12)) return cM;
  vec2 dir = vec2(-((lN+lE)-(lS+lW)), ((lW+lN)-(lE+lS)));
  float dr = max((lN+lS+lW+lE)*.25*.25,1./128.); float rcp = 1./(min(abs(dir.x),abs(dir.y))+dr);
  dir = clamp(dir*rcp, vec2(-8.), vec2(8.))*px;
  vec3 a = .5*(texture(uScene,uv+dir*(1./3.-.5)).rgb + texture(uScene,uv+dir*(2./3.-.5)).rgb);
  vec3 b = a*.5 + .25*(texture(uScene,uv+dir*-.5).rgb + texture(uScene,uv+dir*.5).rgb);
  float lb = luma(min(b,vec3(4.)));
  return (lb<mn||lb>mx) ? a : b;
}
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv = vUV; vec2 cc = uv-.5; float r2 = dot(cc,cc);
  vec2 off = cc*r2*uAber;
  vec3 col;
  if(uFXAA>.5){ col = fxaa(uv); col.r = texture(uScene, uv+off).r*.0 + col.r; }
  else col = vec3(texture(uScene,uv+off).r, texture(uScene,uv).g, texture(uScene,uv-off).b);
  col += texture(uBloom, uv).rgb*uBloomK;
  col *= uExposure;
  // flash (hit / pickup)
  col += uFlashCol*uFlash;
  col = aces(col);
  // grading
  col = pow(col, vec3(1./2.2));
  float l = luma(col); col = mix(vec3(l), col, uSat);
  col = (col-.5)*uContrast+.5; col *= uTint;
  // low hp desaturate
  col = mix(col, vec3(luma(col))*vec3(1.,.8,.8), uLow*.6);
  // vignette
  float v = smoothstep(.85,.15, sqrt(r2)*1.35); col *= mix(1., v, uVig);
  // hurt vignette (red edges)
  float hv = smoothstep(.15,.75,sqrt(r2)*1.4); col = mix(col, col*vec3(1.,.25,.25)+vec3(.35,0.,0.)*hv, uHurt*hv);
  // grain
  col += (hash(uv*uRes+fract(uTime)*91.)-.5)*uGrain;
  o = vec4(clamp(col,0.,1.),1.);
}`;

  G.SH3D = { LIT_VS, LIT_FS, DEPTH_VS, DEPTH_FS, GROUND_VS, GROUND_FS, HAZ_VS, HAZ_FS, PART_VS, PART_FS, RIB_VS, RIB_FS, SKY_VS, SKY_FS, FS_VS, PRE_FS, DOWN_FS, UP_FS, COMP_FS };
})(window);
