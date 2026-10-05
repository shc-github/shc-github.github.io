// Slow-motion impact visualization, not a hydrodynamic solver. Length/time scales are enlarged.
export function createImpact({THREE,body,normal,sizeKm,speedKms,onPhase}) {
    const group=new THREE.Group();
    const rocky=body.kind==='rock', air=body.atmosphere, r=body.radius;
    const energyScale=Math.pow(sizeKm/10,.3)*Math.pow(speedKms/25,.4);
    const spread=r*Math.min(.34,Math.max(.065,.19*energyScale));
    const outward=normal.clone().normalize();
    const tangent=new THREE.Vector3().crossVectors(outward,new THREE.Vector3(0,1,0));
    if(tangent.lengthSq()<.001) tangent.set(1,0,0); tangent.normalize();
    const bitangent=new THREE.Vector3().crossVectors(outward,tangent).normalize();
    const contact=outward.clone().multiplyScalar(r*1.003);
    const start=contact.clone().addScaledVector(outward,r*2.1).addScaledVector(tangent,-r*1.8);
    const flightVector=start.clone().sub(contact);
    const dummy=new THREE.Object3D(),temp=new THREE.Vector3();
    let seed=2107;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const rockGeometry=new THREE.IcosahedronGeometry(1,2);
    const attr=rockGeometry.attributes.position;
    for(let i=0;i<attr.count;i++) {
        const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);
        const f=.85+.12*Math.sin(x*7+y*3)*Math.cos(z*8-x*2);
        attr.setXYZ(i,x*f,y*f*.8,z*f);
    }
    rockGeometry.computeVertexNormals();
    const rockMaterial=new THREE.MeshStandardMaterial({color:0x66584b,roughness:1,emissive:0xff5e12,emissiveIntensity:0});
    const meteor=new THREE.Mesh(rockGeometry,rockMaterial);
    meteor.scale.setScalar(spread*.15); group.add(meteor);
    const softCanvas=document.createElement('canvas');softCanvas.width=128;softCanvas.height=128;
    const context=softCanvas.getContext('2d');
    const gradient=context.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.15,'rgba(255,255,255,.85)');gradient.addColorStop(.5,'rgba(255,255,255,.18)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    context.fillStyle=gradient;context.fillRect(0,0,128,128);
    const softTexture=new THREE.CanvasTexture(softCanvas);
    const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:softTexture,color:0xffe2ac,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    flash.position.copy(contact).addScaledVector(outward,spread*.12);group.add(flash);
    const impactLight=new THREE.PointLight(0xffab62,0,r*5,2);impactLight.position.copy(flash.position);group.add(impactLight);
    const fireMaterial=new THREE.ShaderMaterial({
        uniforms:{time:{value:0},alpha:{value:0}},
        vertexShader:`varying vec3 vLocal;varying vec3 vNormalView;varying vec3 vView;void main(){vLocal=position;vec4 mv=modelViewMatrix*vec4(position,1.);vNormalView=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
        fragmentShader:`uniform float time,alpha;varying vec3 vLocal;varying vec3 vNormalView;varying vec3 vView;
            float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
            float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
            void main(){vec3 p=vLocal*5.+vec3(0.,-time*.9,time*.2);float n=noise(p)*.6+noise(p*2.2)*.28+noise(p*4.5)*.12;float facing=max(dot(normalize(vNormalView),normalize(vView)),0.);
                vec3 color=mix(vec3(.8,.06,.005),vec3(4.5,2.9,1.3),smoothstep(.2,.8,n));color*=exp(-time*.33);
                gl_FragColor=vec4(color,alpha*smoothstep(0.,.4,facing)*(.4+n*.6));}`,
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    const fireball=new THREE.Mesh(new THREE.SphereGeometry(1,40,28),fireMaterial);fireball.position.copy(contact);fireball.visible=false;group.add(fireball);
    const trailCount=100,trailArray=new Float32Array(trailCount*3);
    const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailArray,3));
    const trailMaterial=new THREE.PointsMaterial({map:softTexture,color:0xffb76c,size:spread*.32,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    const trail=new THREE.Points(trailGeometry,trailMaterial);trail.frustumCulled=false;group.add(trail);
    const fragmentCount=rocky?220:0;
    const fragmentMaterial=new THREE.MeshStandardMaterial({color:0x655343,roughness:1,emissive:0xff6b18,emissiveIntensity:3});
    const fragments=new THREE.InstancedMesh(rockGeometry,fragmentMaterial,fragmentCount);
    fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fragments.frustumCulled=false;fragments.visible=false;group.add(fragments);
    const velocities=new Float32Array(fragmentCount*3),scales=new Float32Array(fragmentCount),rotations=new Float32Array(fragmentCount*3);
    for(let i=0;i<fragmentCount;i++) {
        const angle=random()*Math.PI*2, speed=spread*(.45+random()*1.7), rise=.35+random()*.9;
        temp.copy(outward).multiplyScalar(speed*rise).addScaledVector(tangent,Math.cos(angle)*speed).addScaledVector(bitangent,Math.sin(angle)*speed);
        velocities.set([temp.x,temp.y,temp.z],i*3); scales[i]=spread*(.008+Math.pow(random(),3)*.04);
        rotations.set([random()*6,random()*6,random()*6],i*3);
    }
    const dustCount=air?360:160,dustPositions=new Float32Array(dustCount*3),dustVelocities=new Float32Array(dustCount*3);
    for(let i=0;i<dustCount;i++) {
        const angle=random()*Math.PI*2,v=spread*(.22+random()*.8);
        temp.copy(outward).multiplyScalar(v*(air?1.8:.5)).addScaledVector(tangent,Math.cos(angle)*v).addScaledVector(bitangent,Math.sin(angle)*v);
        dustVelocities.set([temp.x,temp.y,temp.z],i*3);
    }
    const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
    const dustMaterial=new THREE.PointsMaterial({map:softTexture,color:rocky?0x84766b:0xbfa897,size:spread*.65,transparent:true,opacity:0,depthWrite:false});
    const dust=new THREE.Points(dustGeometry,dustMaterial);dust.frustumCulled=false;group.add(dust);
    // The residual patch follows spherical curvature; a dark bowl and raised rim imply excavation.
    const craterGeometry=new THREE.PlaneGeometry(spread*3,spread*3,48,48);
    const craterPositions=craterGeometry.attributes.position;
    for(let i=0;i<craterPositions.count;i++) {
        const x=craterPositions.getX(i),y=craterPositions.getY(i);
        craterPositions.setZ(i,Math.sqrt(Math.max(r*r-x*x-y*y,.01))-r+r*.003);
    }
    craterGeometry.computeVertexNormals();
    const craterMaterial=new THREE.ShaderMaterial({
        uniforms:{heat:{value:0},alpha:{value:0},rocky:{value:rocky?1:0}},
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec2 vUv;uniform float heat,alpha,rocky;void main(){vec2 p=(vUv-.5)*2.;float d=length(p);float a=atan(p.y,p.x);float edge=d+sin(a*23.)*.02+sin(a*51.)*.012;
            float mask=1.-smoothstep(.52,1.,edge);float rim=exp(-pow((d-.42)*29.,2.));float bowl=1.-smoothstep(.27,.42,d);
            vec3 cold=mix(vec3(.055,.042,.035),vec3(.22,.18,.13),rim*.7);cold*=1.-bowl*.65;
            vec3 hot=vec3(3.4,.6,.05)*heat*(bowl*.4+rim*.8+pow(max(0.,sin(a*37.+d*70.)),18.)*.2);
            gl_FragColor=vec4(cold+hot,mask*alpha*(rocky>.5?.93:.55));}`,
        transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
    });
    const crater=new THREE.Mesh(craterGeometry,craterMaterial);crater.position.copy(outward).multiplyScalar(r);crater.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),outward);group.add(crater);
    let shock=null;
    if(air) {
        const shockMaterial=new THREE.MeshBasicMaterial({color:0xf4cf9e,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
        shock=new THREE.Mesh(new THREE.RingGeometry(.92,1,128),shockMaterial);shock.position.copy(contact).addScaledVector(outward,r*.012);shock.quaternion.copy(crater.quaternion);group.add(shock);
    }
    let time=0,phase=-1,disposed=false;
    const phaseNames=air?['进入大气 · 压缩加热','接触 · 瞬时高温闪光','喷射物扩张 · 冲击羽流','辐射冷却 · 残留逐渐消散']:['真空入射 · 惯性飞行','接触 · 瞬时高温闪光','弹道喷射 · 无空气冲击波','喷射物回落 · 熔融区冷却'];
    function update(dt) {
        if(disposed) return false;
        time+=dt;
        const stage=time<3?0:time<3.35?1:time<8?2:3;
        if(stage!==phase) {phase=stage;onPhase?.(phaseNames[stage]);}
        if(time<3) {
            const progress=time/3, remaining=1-progress;
            meteor.position.copy(contact).addScaledVector(flightVector,remaining);meteor.rotation.set(time*2,time*3,.2);
            const heating=air?Math.pow(Math.max(0,(progress-.6)/.4),2):0;
            rockMaterial.emissiveIntensity=heating*5;
            for(let i=0;i<trailCount;i++) {
                const f=i/trailCount,trailLength=f*r*.7;
                temp.copy(meteor.position).addScaledVector(flightVector,trailLength/flightVector.length());
                temp.addScaledVector(tangent,Math.sin(i*18.1)*spread*f*.17).addScaledVector(bitangent,Math.cos(i*13.7)*spread*f*.17);
                trailArray[i*3]=temp.x;trailArray[i*3+1]=temp.y;trailArray[i*3+2]=temp.z;
            }
            trailGeometry.attributes.position.needsUpdate=true;trailMaterial.opacity=heating*.8;
            return true;
        }
        const t=time-3;
        meteor.visible=false;trail.visible=false;fireball.visible=t<7;
        flash.material.opacity=Math.exp(-t*6)*.95;flash.scale.setScalar(spread*(8+t*6));
        impactLight.intensity=spread*spread*90*Math.exp(-t*3);
        fireMaterial.uniforms.time.value=t;fireMaterial.uniforms.alpha.value=Math.max(0,1-t/7)*.85;
        fireball.scale.setScalar(spread*(.2+Math.pow(t+.03,.45)*1.6));
        fireball.position.copy(contact).addScaledVector(outward,spread*Math.min(t*.32,1));
        craterMaterial.uniforms.alpha.value=Math.min(t*4,1)*(rocky?1:Math.max(0,1-t/15));
        craterMaterial.uniforms.heat.value=Math.exp(-t*.65);
        if(shock) {shock.scale.setScalar(spread*(.3+t*2.8));shock.material.opacity=Math.max(0,.28-t*.19);}
        fragments.visible=rocky&&t<9;
        const gravity=spread*.37;
        if(fragments.visible) {
            for(let i=0;i<fragmentCount;i++) {
                temp.copy(contact).addScaledVector(outward,-.5*gravity*t*t);
                temp.x+=velocities[i*3]*t;temp.y+=velocities[i*3+1]*t;temp.z+=velocities[i*3+2]*t;
                const above=temp.length()>r;
                dummy.position.copy(temp);dummy.rotation.set(rotations[i*3]+t,rotations[i*3+1]+t*.7,rotations[i*3+2]+t*.3);
                dummy.scale.setScalar(above?scales[i]:0);dummy.updateMatrix();fragments.setMatrixAt(i,dummy.matrix);
            }
            fragments.instanceMatrix.needsUpdate=true;fragmentMaterial.emissiveIntensity=3*Math.exp(-t*.9);
        }
        dustMaterial.opacity=Math.min(t*2,.32)*Math.max(0,1-t/12);dustMaterial.size=spread*(.4+Math.min(t,8)*.12);
        const age=air?Math.log(1+t)*2:t;
        for(let i=0;i<dustCount;i++) {
            temp.copy(contact);
            temp.x+=dustVelocities[i*3]*age;temp.y+=dustVelocities[i*3+1]*age;temp.z+=dustVelocities[i*3+2]*age;
            if(!air) temp.addScaledVector(outward,-.5*gravity*t*t);
            if(temp.length()<r) temp.set(0,0,0);
            dustPositions[i*3]=temp.x;dustPositions[i*3+1]=temp.y;dustPositions[i*3+2]=temp.z;
        }
        dustGeometry.attributes.position.needsUpdate=true;
        if(time>=15) {fireball.visible=false;dust.visible=false;flash.visible=false;fragments.visible=false;impactLight.intensity=0;if(shock)shock.visible=false;return false;}
        return true;
    }
    function dispose() {
        if(disposed) return;disposed=true;group.removeFromParent();
        const geometries=new Set(),materials=new Set();
        group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
        geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());softTexture.dispose();
    }
    update(0);
    return {group,update,dispose};
}
