// Planet maps: Solar System Scope, CC BY 4.0 (NASA-derived, artist-adjusted imagery).
// https://www.solarsystemscope.com/textures/ — https://creativecommons.org/licenses/by/4.0/
// Earth normal/specular: Three.js r160 examples/textures/planets (MIT distribution).
// Orbital elements are illustrative; geometry scales and initial anomalies are not an ephemeris.
export async function createSolarSystem({ THREE, scene, isMobile, onProgress }) {
    const loader = new THREE.TextureLoader();
    const files = ['sun','mercury','venus_atmosphere','earth_daymap','earth_nightmap','earth_clouds','earth_normal','earth_specular','mars','jupiter','saturn','saturn_ring_alpha','uranus','neptune','moon'];
    let loaded = 0;
    const textures = Object.fromEntries(await Promise.all(files.map(async name => {
        const texture = await loader.loadAsync(`./assets/textures/2k_${name}.${name==='saturn_ring_alpha'?'png':'jpg'}`);
        texture.colorSpace = ['earth_clouds','earth_normal','earth_specular'].includes(name) ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        onProgress?.(++loaded,files.length);
        return [name,texture];
    })));
    const root = new THREE.Group(); scene.add(root);
    const sphere = new THREE.SphereGeometry(1,isMobile?64:96,isMobile?48:64);
    const bodies = [], animations = [];
    const rad = Math.PI/180;
    const worldVertex = `varying vec3 vWorldPosition; varying vec3 vWorldNormal;
        void main(){vec4 world=modelMatrix*vec4(position,1.);vWorldPosition=world.xyz;vWorldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
    function atmosphere(color, strength) {
        return new THREE.ShaderMaterial({
            uniforms:{uColor:{value:new THREE.Color(color)},uStrength:{value:strength}},
            vertexShader:worldVertex,
            fragmentShader:`varying vec3 vWorldPosition;varying vec3 vWorldNormal;uniform vec3 uColor;uniform float uStrength;
                void main(){vec3 n=normalize(vWorldNormal),v=normalize(cameraPosition-vWorldPosition),l=normalize(-vWorldPosition);
                float rim=pow(1.-max(dot(n,v),0.),3.5);float day=smoothstep(-.22,.35,dot(n,l));
                gl_FragColor=vec4(uColor*1.5,rim*day*uStrength);}`,
            transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        });
    }
    const sunGroup = new THREE.Group(); root.add(sunGroup);
    const solarTime={value:0};
    const solarNoise=`
        float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
        float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        float fbm(vec3 p){return .54*noise(p)+.27*noise(p*2.03)+.13*noise(p*4.09)+.06*noise(p*8.17);}
    `;
    const sunMaterial = new THREE.ShaderMaterial({
        uniforms:{map:{value:textures.sun},time:solarTime},
        vertexShader:`varying vec2 vUv;varying vec3 vP,vN,vLocal;void main(){vUv=uv;vLocal=position;vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
        fragmentShader:`uniform sampler2D map;uniform float time;varying vec2 vUv;varying vec3 vP,vN,vLocal;
            ${solarNoise}
            void main(){
                vec3 p=normalize(vLocal);
                vec3 flow=p*7.+vec3(0.,time*.018,0.);
                vec3 warp=vec3(fbm(flow),fbm(flow+17.),fbm(flow+43.));
                float convection=fbm(p*26.+warp*2.+time*.025);
                float grains=noise(p*220.+warp*3.);
                float cells=smoothstep(.22,.72,grains);
                float activity=fbm(p*9.+vec3(4.,0.,time*.008));
                float spots=(1.-smoothstep(.20,.27,activity))*(1.-smoothstep(.15,.48,abs(p.y)));
                float mu=max(dot(normalize(vN),normalize(cameraPosition-vP)),0.);
                float limb=.36+.64*pow(mu,.45);
                float image=dot(texture2D(map,vUv).rgb,vec3(.299,.587,.114));
                float heat=clamp(convection*.7+cells*.35+image*.18,0.,1.);
                vec3 color=mix(vec3(.62,.085,.004),vec3(2.1,.83,.12),heat);
                color*=mix(.65,1.12,cells)*(1.-spots*.86)*limb;
                gl_FragColor=vec4(color,1.);
            }`,
    });
    const sun = new THREE.Mesh(sphere,sunMaterial); sun.scale.setScalar(3.6); sunGroup.add(sun);
    // View-facing optically thin corona: radial falloff and evolving magnetic streamers.
    const coronaMaterial=new THREE.ShaderMaterial({
        uniforms:{time:solarTime},
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`uniform float time;varying vec2 vUv;${solarNoise}
            void main(){vec2 p=(vUv-.5)*24.;float r=length(p);float h=max(0.,r-3.6);float a=atan(p.y,p.x);
                float turbulence=fbm(vec3(p*.8,time*.06));
                float rays=pow(.5+.5*sin(a*19.+turbulence*5.+time*.04),5.);
                float fine=pow(.5+.5*sin(a*67.+turbulence*3.-time*.09),9.);
                float rim=exp(-h*10.)*.34;
                float corona=exp(-h*1.45)*(.08+rays*.12+fine*.045);
                float haze=exp(-h*.6)*.012;
                float mask=smoothstep(3.48,3.65,r)*(1.-smoothstep(8.,12.,r));
                gl_FragColor=vec4(vec3(2.4,.58,.055),(rim+corona+haze)*mask);
            }`,
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    const corona=new THREE.Mesh(new THREE.PlaneGeometry(24,24),coronaMaterial);
    corona.onBeforeRender=(_renderer,_scene,camera)=>{corona.quaternion.copy(camera.quaternion);corona.updateMatrixWorld();};
    sunGroup.add(corona);
    // Three-dimensional arches rooted at two photospheric footpoints.
    const prominenceMaterial=new THREE.ShaderMaterial({
        uniforms:{time:solarTime},
        vertexShader:`varying vec2 vUv;varying vec3 vP;void main(){vUv=uv;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`uniform float time;varying vec2 vUv;varying vec3 vP;${solarNoise}
            void main(){float flow=fbm(vP*18.+vec3(time*.8,-time*.4,0.));float strands=pow(.5+.5*sin(vUv.y*31.+flow*9.-time*1.1),2.);
                vec3 color=mix(vec3(1.8,.12,.008),vec3(4.,1.1,.08),flow);
                gl_FragColor=vec4(color,(.24+strands*.6)*smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x));}`,
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    });
    const prominenceRoot=new THREE.Group();sunGroup.add(prominenceRoot);
    for(let i=0;i<11;i++){
        const longitude=i*2.399963,latitude=Math.sin(i*1.71)*.7;
        const n=new THREE.Vector3(Math.cos(longitude)*Math.cos(latitude),Math.sin(latitude),Math.sin(longitude)*Math.cos(latitude));
        const tangent=new THREE.Vector3(-Math.sin(longitude),0,Math.cos(longitude));
        const width=.22+(i%4)*.12,height=.24+(i%3)*.24;
        const points=[];
        for(let j=0;j<=48;j++){
            const t=j/48,angle=(t-.5)*width;
            points.push(n.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent,Math.sin(angle)).multiplyScalar(3.58+Math.sin(t*Math.PI)*height));
        }
        const curve=new THREE.CatmullRomCurve3(points);
        const arch=new THREE.Mesh(new THREE.TubeGeometry(curve,isMobile?32:64,.018+(i%3)*.009,5,false),prominenceMaterial);
        prominenceRoot.add(arch);
    }
    bodies.push({id:'sun',name:'太阳',english:'Sun',radius:3.6,group:sunGroup,surface:sun,kind:'star',atmosphere:true,data:{diameter:1392700,distance:0,period:0,description:'太阳集中了太阳系约 99.86% 的质量。光球温度约 5,772 K；这里以暖色呈现光球纹理。'}});
    const definitions = [
        ['mercury','水星','Mercury',.38,7,87.97,.2056,7,.034,58.65,4879,.387,'mercury','rock',null,'密布撞击坑的岩质世界。几乎没有大气，昼夜温差超过 600°C。'],
        ['venus','金星','Venus',.8,10,224.7,.0068,3.39,177.36,243.02,12104,.723,'venus_atmosphere','rock',0xffd19c,'硫酸云笼罩整个星球，浓厚的二氧化碳大气使地表温度高达约 465°C。'],
        ['earth','地球','Earth',.84,14,365.25,.0167,0,23.44,.997,12756,1,'earth_daymap','rock',0x478dff,'液态海洋、移动的云层与薄薄的大气。沿着晨昏线，观察城市灯光与蓝色大气边缘。'],
        ['mars','火星','Mars',.5,18,686.98,.0934,1.85,25.19,1.026,6792,1.524,'mars','rock',0xc87e57,'氧化铁赋予火星红色外观。稀薄大气之下，保留着古老河道与巨大的火山。'],
        ['jupiter','木星','Jupiter',2.2,26,4332.59,.0489,1.30,3.13,.414,142984,5.203,'jupiter','gas',0xc5b7a5,'太阳系最大的行星。云带与大红斑在氢氦大气中流动，没有可见的固体表面。'],
        ['saturn','土星','Saturn',1.85,36,10759.22,.0565,2.49,26.73,.444,120536,9.537,'saturn','gas',0xd9c28f,'冰粒与岩屑构成宽阔的星环。卡西尼缝将明亮的 B 环与外侧 A 环分开。'],
        ['uranus','天王星','Uranus',1.22,46,30688.5,.0457,.77,97.77,.718,51118,19.191,'uranus','ice',0x87c9d6,'自转轴倾斜约 98°，如同侧躺着公转。甲烷吸收红光，使大气呈蓝绿色。'],
        ['neptune','海王星','Neptune',1.18,56,60182,.0113,1.77,28.32,.671,49528,30.069,'neptune','ice',0x689fdc,'遥远的冰巨行星，强风穿过甲烷云层。图像采用增强蓝色以便观察云带。'],
    ];
    for (let index=0;index<definitions.length;index++) {
        const [id,name,english,radius,orbit,period,ecc,inclination,tilt,rotation,diameter,distance,tex,kind,atmo,description]=definitions[index];
        const group=new THREE.Group(); root.add(group);
        const axis=new THREE.Group(); axis.rotation.z=tilt*rad; group.add(axis);
        const material=new THREE.MeshStandardMaterial({map:textures[tex],roughness:id==='earth'?.58:.96,metalness:0});
        if(id==='mercury'||id==='mars') {material.bumpMap=textures[tex]; material.bumpScale=radius*.006;}
        if(id==='earth') {
            material.emissiveMap=textures.earth_nightmap; material.emissive.set(0xffd5a0); material.emissiveIntensity=1.15;
            material.normalMap=textures.earth_normal;material.normalScale=new THREE.Vector2(.32,.32);
            material.roughnessMap=textures.earth_specular;material.roughness=1;
            material.onBeforeCompile=shader=>{
                shader.vertexShader='varying vec3 vWorldN;varying vec3 vWorldP;\n'+shader.vertexShader;
                shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWorldN=normalize(mat3(modelMatrix)*normal);vWorldP=(modelMatrix*vec4(position,1.)).xyz;');
                shader.fragmentShader='varying vec3 vWorldN;varying vec3 vWorldP;\n'+shader.fragmentShader;
                shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1.-smoothstep(-.18,.12,dot(normalize(vWorldN),normalize(-vWorldP)));');
                shader.fragmentShader=shader.fragmentShader.replace('roughnessFactor *= texelRoughness.g;','roughnessFactor *= mix(.94,.22,texelRoughness.g);');
            };
        }
        const surface=new THREE.Mesh(sphere,material); surface.scale.setScalar(radius); axis.add(surface);
        if(atmo) {const glow=new THREE.Mesh(sphere,atmosphere(atmo,id==='earth'?.62:id==='mars'?.09:.17));glow.scale.setScalar(radius*(id==='earth'?1.018:1.013));axis.add(glow);}
        let clouds=null;
        if(id==='earth') {
            clouds=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({color:0xffffff,alphaMap:textures.earth_clouds,transparent:true,opacity:.88,depthWrite:false,roughness:1}));
            clouds.scale.setScalar(radius*1.008); axis.add(clouds);
        }
        if(id==='saturn'||id==='uranus') {
            const inner=radius*(id==='saturn'?1.23:1.75),outer=radius*(id==='saturn'?2.28:2.05);
            const geometry=new THREE.RingGeometry(inner,outer,256,1); const position=geometry.attributes.position,uv=geometry.attributes.uv;
            for(let i=0;i<position.count;i++) uv.setXY(i,(Math.hypot(position.getX(i),position.getY(i))-inner)/(outer-inner),.5);
            const ringMaterial=new THREE.ShaderMaterial({
                uniforms:{map:{value:textures.saturn_ring_alpha},radius:{value:radius},center:{value:group.position},faint:{value:id==='uranus'?.22:1}},
                vertexShader:`varying vec2 vUv;varying vec3 vP;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
                fragmentShader:`uniform sampler2D map;uniform vec3 center;uniform float radius,faint;varying vec2 vUv;varying vec3 vP;
                    void main(){vec4 tex=texture2D(map,vUv);vec3 toSun=normalize(-vP),rel=vP-center;float along=dot(-rel,toSun);float closest=length(rel+toSun*max(0.,along));float shadow=along>0.?smoothstep(radius*.98,radius*1.04,closest):1.;
                    float cassini=1.-.95*(smoothstep(.70,.714,vUv.x)-smoothstep(.747,.757,vUv.x));
                    gl_FragColor=vec4(tex.rgb*(.11+shadow*.95),tex.a*cassini*faint);}`,
                side:THREE.DoubleSide,transparent:true,depthWrite:false,
            });
            const ring=new THREE.Mesh(geometry,ringMaterial); ring.rotation.x=-Math.PI/2; axis.add(ring);
            if(id==='saturn') {
                const ringNormal=new THREE.Vector3(0,1,0).applyEuler(axis.rotation);
                material.onBeforeCompile=shader=>{
                    shader.uniforms.ringCenter={value:group.position};shader.uniforms.ringNormal={value:ringNormal};shader.uniforms.ringMap={value:textures.saturn_ring_alpha};
                    shader.vertexShader='varying vec3 vRingWorld;\n'+shader.vertexShader;
                    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRingWorld=(modelMatrix*vec4(position,1.)).xyz;');
                    shader.fragmentShader='varying vec3 vRingWorld;uniform vec3 ringCenter,ringNormal;uniform sampler2D ringMap;\n'+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
                        vec3 solarDir=normalize(-vRingWorld);
                        float denom=dot(solarDir,ringNormal);
                        if(abs(denom)>.001){
                            float travel=dot(ringCenter-vRingWorld,ringNormal)/denom;
                            float radial=length(vRingWorld+solarDir*travel-ringCenter);
                            float ringU=(radial-${inner.toFixed(5)})/${(outer-inner).toFixed(5)};
                            if(travel>0. && ringU>0. && ringU<1.) outgoingLight*=1.-texture2D(ringMap,vec2(ringU,.5)).a*.78;
                        }
                        #include <opaque_fragment>`);
                };
            }
        }
        const orbitGeometry=new THREE.BufferGeometry(); const points=[];
        for(let j=0;j<=256;j++) {const E=j/256*Math.PI*2;points.push(new THREE.Vector3(orbit*(Math.cos(E)-ecc),-orbit*Math.sqrt(1-ecc*ecc)*Math.sin(E)*Math.sin(inclination*rad),orbit*Math.sqrt(1-ecc*ecc)*Math.sin(E)*Math.cos(inclination*rad)));}
        orbitGeometry.setFromPoints(points);
        root.add(new THREE.Line(orbitGeometry,new THREE.LineBasicMaterial({color:0x7b8e9a,transparent:true,opacity:.16,depthWrite:false})));
        const body={id,name,english,radius,group,surface,kind,atmosphere:!!atmo,data:{diameter,distance,period,description}};
        bodies.push(body);
        animations.push({group,axis,surface,clouds,orbit,period,ecc,inclination:inclination*rad,rotation,phase:[2.7,4.6,.55,3.6,5.3,1.9,3.7,.6][index]});
        if(id==='earth') {
            const moon=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({map:textures.moon,bumpMap:textures.moon,bumpScale:.0015,roughness:1}));
            moon.scale.setScalar(.229); group.add(moon);
            body.moon=moon;
        }
    }
    // A sparse main belt, with geometry shared in one draw call.
    const belt=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:0x80756a,roughness:1}),isMobile?550:1300);
    const dummy=new THREE.Object3D();
    for(let i=0;i<belt.count;i++) {
        const angle=i*2.399963, r=21.1+Math.sin(i*91.17)*1.35;
        dummy.position.set(Math.cos(angle)*r,Math.sin(i*23.8)*.35,Math.sin(angle)*r);
        dummy.rotation.set(i,i*.7,i*.4); dummy.scale.setScalar(.018+((i*17)%31)/1100); dummy.updateMatrix(); belt.setMatrixAt(i,dummy.matrix);
    }
    root.add(belt);
    const earth=bodies.find(body=>body.id==='earth');
    let displayTime=0;
    function update(dt,days) {
        displayTime+=dt; solarTime.value=displayTime;
        sun.rotation.y=displayTime*.018;prominenceRoot.rotation.y=sun.rotation.y;
        for(const a of animations) {
            const mean=a.phase+days/a.period*Math.PI*2; let E=mean;
            for(let k=0;k<5;k++) E-=(E-a.ecc*Math.sin(E)-mean)/(1-a.ecc*Math.cos(E));
            const z=a.orbit*Math.sqrt(1-a.ecc*a.ecc)*Math.sin(E);
            a.group.position.set(a.orbit*(Math.cos(E)-a.ecc),-z*Math.sin(a.inclination),z*Math.cos(a.inclination));
            // Spin is slowed independently for close observation; obliquity supplies retrograde sense.
            a.surface.rotation.y+=dt*Math.min(.16,.075/a.rotation);
            if(a.clouds) a.clouds.rotation.y=a.surface.rotation.y+displayTime*.007;
        }
        const phase=days/27.32*Math.PI*2;
        earth.moon.position.set(Math.cos(phase)*2.4,Math.sin(phase)*.18,Math.sin(phase)*2.4);earth.moon.rotation.y=-phase;
        belt.rotation.y=days/1700*Math.PI*2;
    }
    update(0,0);
    function dispose() {
        root.removeFromParent();const geometries=new Set(),materials=new Set();
        root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
        geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());Object.values(textures).forEach(t=>t.dispose());
    }
    return {bodies,update,dispose};
}
