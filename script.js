// --- UTILITY FUNCTIONS ---
const showMessage = (text, title = 'Notification') => {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').textContent = text;
    document.getElementById('message-modal').classList.remove('hidden');
};

const showLoader = () => document.getElementById('loading-overlay').classList.remove('hidden');
const hideLoader = () => document.getElementById('loading-overlay').classList.add('hidden');

document.getElementById('message-close-btn').addEventListener('click', () => {
    document.getElementById('message-modal').classList.add('hidden');
});

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// --- GLOBAL STATE ---
let scene, camera, renderer, controls, mesh, pointLight, pbrMaterial;
let fbxLoader;

// Source & Normal Map state
let sourceImage, sourceTexture, normalTexture;
const sourceCanvas = document.createElement('canvas');
const sourceCtx = sourceCanvas.getContext('2d');
const normalCanvas = document.createElement('canvas');
const normalCtx = normalCanvas.getContext('2d', { willReadFrequently: true });

// Material Map state
let metallicMap, roughnessMap, aoMap;
let metallicTexture, roughnessTexture, aoTexture;
const materialCanvas = document.createElement('canvas');
const materialCtx = materialCanvas.getContext('2d', { willReadFrequently: true });

// --- UI ELEMENT REFERENCES ---
const fileInput = document.getElementById('file-input');
const fileLabel = document.getElementById('file-label');
const fileNameEl = document.getElementById('file-name');
const normalMapControls = document.getElementById('normal-map-controls');
const previewExportControls = document.getElementById('preview-export-controls');
const exportNormalBtn = document.getElementById('export-normal-btn');
const exportMaterialBtn = document.getElementById('export-material-btn');
const viewer = document.getElementById('viewer');
const strengthSlider = document.getElementById('strength');
const invertRCheck = document.getElementById('invert-r');
const invertGCheck = document.getElementById('invert-g');
const strengthValue = document.getElementById('strength-value');

const materialMapModule = document.getElementById('material-map-module');
const metallicFileInput = document.getElementById('metallic-file');
const roughnessFileInput = document.getElementById('roughness-file');
const aoFileInput = document.getElementById('ao-file');
const metallicSlider = document.getElementById('metallic-slider');
const roughnessSlider = document.getElementById('roughness-slider');
const aoSlider = document.getElementById('ao-slider');
const metallicValue = document.getElementById('metallic-value');
const roughnessValue = document.getElementById('roughness-value');
const aoValue = document.getElementById('ao-value');

const materialPreviewContainer = document.getElementById('material-preview-container');

// Utility Menu UI
const utilityToggleBtn = document.getElementById('utility-toggle-btn');
const utilityPanel = document.getElementById('utility-panel');
const lightColorInput = document.getElementById('light-color');
const lightIntensitySlider = document.getElementById('light-intensity');
const lightIntensityValue = document.getElementById('light-intensity-value');


// --- THREE.JS INITIALIZATION ---
function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
    camera.position.z = 2.5;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.premultipliedAlpha = false;
    viewer.appendChild(renderer.domElement);
    
    showLoader();
    // Use an HDRI for background and reflections
    new THREE.RGBELoader()
        .setDataType(THREE.UnsignedByteType)
        .load('hdr/desert.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
            hideLoader();
        }, undefined, (error) => {
             console.error('An error occurred loading the HDRI.', error);
             showMessage('Failed to load hdr/desert.hdr. Make sure the file exists and the path is correct.', 'Error');
             hideLoader();
        });

    // Add a controllable key light
    pointLight = new THREE.PointLight(0xffffff, 1.5);
    pointLight.position.set(4, 5, 6);
    scene.add(pointLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Create a single, reusable PBR material
    pbrMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.5,
        metalness: 0.1,
    });

    // Instantiate loaders
    fbxLoader = new THREE.FBXLoader();

    // Load the default model
    loadModel('cowboy');

    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function onWindowResize() {
    camera.aspect = viewer.clientWidth / viewer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- MODEL LOADING ---
function loadModel(type) {
    if (mesh) {
        scene.remove(mesh);
        if(mesh.geometry) mesh.geometry.dispose();
    }

    showLoader();

    if (type === 'cowboy') {
        fbxLoader.load('fbx/cowboy.fbx', (loadedModel) => {
            mesh = loadedModel;
            mesh.traverse((child) => {
                if (child.isMesh) {
                    child.material = pbrMaterial;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3()).length();
            const center = box.getCenter(new THREE.Vector3());
            mesh.position.sub(center);
            const scaleFactor = 2.0 / size;
            mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
            mesh.position.y = -1;

            scene.add(mesh);
            hideLoader();
        }, undefined, (error) => {
            console.error(error);
            showMessage("Failed to load fbx/cowboy.fbx. Make sure the file exists and you're running a local server.", "Error");
            hideLoader();
        });
    } else {
        let geometry;
        switch(type) {
            case 'cube': geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5); break;
            case 'plane': geometry = new THREE.PlaneGeometry(2, 2, 32, 32); break;
            default: geometry = new THREE.SphereGeometry(1, 64, 64); break; // Sphere
        }
        mesh = new THREE.Mesh(geometry, pbrMaterial);
        scene.add(mesh);
        hideLoader();
    }

    // Update button styles
    document.querySelectorAll('.p-2 button').forEach(btn => {
        btn.classList.replace('bg-blue-600', 'bg-gray-600');
        btn.classList.add('hover:bg-gray-500');
    });
    const activeBtn = document.getElementById(`${type}-btn`);
    if(activeBtn) {
        activeBtn.classList.replace('bg-gray-600', 'bg-blue-600');
        activeBtn.classList.remove('hover:bg-gray-500');
    }
}


// --- MAIN FILE & TEXTURE HANDLING ---
function handleMainFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    fileNameEl.textContent = file.name;
    fileLabel.textContent = 'Replace Image';
    fileLabel.classList.replace('bg-blue-600', 'bg-green-600');
    fileLabel.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');

    const reader = new FileReader();
    reader.onload = (e) => {
        showLoader();
        sourceImage = new Image();
        sourceImage.onload = () => {
            const { width, height } = sourceImage;
            sourceCanvas.width = width;
            sourceCanvas.height = height;
            normalCanvas.width = width;
            normalCanvas.height = height;
            materialCanvas.width = width;
            materialCanvas.height = height;
            sourceCtx.drawImage(sourceImage, 0, 0);

            if (sourceTexture) sourceTexture.dispose();
            sourceTexture = new THREE.CanvasTexture(sourceCanvas);
            sourceTexture.wrapS = THREE.RepeatWrapping;
            sourceTexture.wrapT = THREE.RepeatWrapping;
            sourceTexture.encoding = THREE.sRGBEncoding;
            sourceTexture.flipY = false;

            if (normalTexture) normalTexture.dispose();
            normalTexture = new THREE.CanvasTexture(normalCanvas);
            normalTexture.wrapS = THREE.RepeatWrapping;
            normalTexture.wrapT = THREE.RepeatWrapping;
            normalTexture.flipY = false;
            
            pbrMaterial.map = sourceTexture;
            pbrMaterial.normalMap = normalTexture;

            normalMapControls.classList.remove('hidden');
            materialMapModule.classList.remove('hidden');
            previewExportControls.classList.remove('hidden');
            materialPreviewContainer.classList.remove('hidden-strict');
            exportMaterialBtn.classList.remove('hidden-strict');

            updateNormalMap();
            updateMaterialMap();
            hideLoader();
        };
        sourceImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function handleMaterialFileLoad(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            switch(type) {
                case 'metallic':
                    metallicMap = img;
                    if (metallicTexture) metallicTexture.dispose();
                    metallicTexture = new THREE.Texture(metallicMap);
                    metallicTexture.wrapS = THREE.RepeatWrapping;
                    metallicTexture.wrapT = THREE.RepeatWrapping;
                    metallicTexture.needsUpdate = true;
                    metallicTexture.flipY = false;
                    pbrMaterial.metalnessMap = metallicTexture;
                    metallicSlider.disabled = true;
                    break;
                case 'roughness':
                    roughnessMap = img;
                    if (roughnessTexture) roughnessTexture.dispose();
                    roughnessTexture = new THREE.Texture(roughnessMap);
                    roughnessTexture.wrapS = THREE.RepeatWrapping;
                    roughnessTexture.wrapT = THREE.RepeatWrapping;
                    roughnessTexture.needsUpdate = true;
                    roughnessTexture.flipY = false;
                    pbrMaterial.roughnessMap = roughnessTexture;
                    roughnessSlider.disabled = true;
                    break;
                case 'ao':
                    aoMap = img;
                    if (aoTexture) aoTexture.dispose();
                    aoTexture = new THREE.Texture(aoMap);
                    aoTexture.wrapS = THREE.RepeatWrapping;
                    aoTexture.wrapT = THREE.RepeatWrapping;
                    aoTexture.needsUpdate = true;
                    aoTexture.flipY = false;
                    pbrMaterial.aoMap = aoTexture;
                    aoSlider.disabled = true;
                    break;
            }
            pbrMaterial.needsUpdate = true;
            updateMaterialMap();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// --- MAP GENERATION & UPDATING ---
function updateNormalMap() {
    if (!sourceImage) return;

    const strength = parseFloat(strengthSlider.value);
    const invertR = invertRCheck.checked;
    const invertG = invertGCheck.checked;
    const { width, height } = sourceImage;
    const sourceImageData = sourceCtx.getImageData(0, 0, width, height);
    const normalImageData = normalCtx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const n = sample(sourceImageData.data, x, y - 1, width, height);
            const s = sample(sourceImageData.data, x, y + 1, width, height);
            const e = sample(sourceImageData.data, x + 1, y, width, height);
            const w = sample(sourceImageData.data, x - 1, y, width, height);
            const ne = sample(sourceImageData.data, x + 1, y - 1, width, height);
            const nw = sample(sourceImageData.data, x - 1, y - 1, width, height);
            const se = sample(sourceImageData.data, x + 1, y + 1, width, height);
            const sw = sample(sourceImageData.data, x - 1, y + 1, width, height);

            let dx = (ne + 2 * e + se) - (nw + 2 * w + sw);
            let dy = (sw + 2 * s + se) - (nw + 2 * n + ne);
            let v = new THREE.Vector3(dx, dy, 255 / strength).normalize();
            
            const i = (y * width + x) * 4;
            normalImageData.data[i] = (v.x * 0.5 + 0.5) * 255;
            normalImageData.data[i + 1] = (v.y * 0.5 + 0.5) * 255;
            normalImageData.data[i + 2] = (v.z * 0.5 + 0.5) * 255;
            normalImageData.data[i + 3] = 255;

            if (invertR) normalImageData.data[i] = 255 - normalImageData.data[i];
            if (invertG) normalImageData.data[i+1] = 255 - normalImageData.data[i+1];
        }
    }
    
    normalCtx.putImageData(normalImageData, 0, 0);
    if (normalTexture) normalTexture.needsUpdate = true;
    updatePreviews();
}

function updateMaterialMap() {
    if (!sourceImage) return;

    if (!metallicMap) pbrMaterial.metalness = parseFloat(metallicSlider.value);
    if (!roughnessMap) pbrMaterial.roughness = parseFloat(roughnessSlider.value);
    if (!aoMap) {
         pbrMaterial.aoMap = sourceTexture;
         pbrMaterial.aoMapIntensity = parseFloat(aoSlider.value);
    }
    pbrMaterial.needsUpdate = true;

    const { width, height } = sourceImage;
    const tempMetallic = document.createElement('canvas');
    const tempRoughness = document.createElement('canvas');
    const tempAo = document.createElement('canvas');
    
    [tempMetallic, tempRoughness, tempAo].forEach(c => { c.width = width; c.height = height; });
    const mCtx = tempMetallic.getContext('2d');
    const rCtx = tempRoughness.getContext('2d');
    const aCtx = tempAo.getContext('2d');

    if (metallicMap) mCtx.drawImage(metallicMap, 0, 0, width, height);
    else { mCtx.fillStyle = `rgb(${metallicSlider.value*255}, ${metallicSlider.value*255}, ${metallicSlider.value*255})`; mCtx.fillRect(0,0,width,height); }
    
    if (roughnessMap) rCtx.drawImage(roughnessMap, 0, 0, width, height);
    else { rCtx.fillStyle = `rgb(${roughnessSlider.value*255}, ${roughnessSlider.value*255}, ${roughnessSlider.value*255})`; rCtx.fillRect(0,0,width,height); }

    if (aoMap) aCtx.drawImage(aoMap, 0, 0, width, height);
    else { aCtx.fillStyle = `rgb(${aoSlider.value*255}, ${aoSlider.value*255}, ${aoSlider.value*255})`; aCtx.fillRect(0,0,width,height); }

    const mData = mCtx.getImageData(0,0,width,height).data;
    const rData = rCtx.getImageData(0,0,width,height).data;
    const aData = aCtx.getImageData(0,0,width,height).data;

    const packedImageData = materialCtx.createImageData(width, height);
    for(let i = 0; i < packedImageData.data.length; i+=4) {
        packedImageData.data[i] = mData[i];
        packedImageData.data[i+1] = rData[i];
        packedImageData.data[i+2] = aData[i];
        packedImageData.data[i+3] = 255;
    }
    materialCtx.putImageData(packedImageData, 0, 0);
    updatePreviews();
}

function sample(data, x, y, width, height) {
    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));
    const i = (y * width + x) * 4;
    return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

function updatePreviews() {
    if (!sourceImage) return;

    const canvases = {
        'source-preview': sourceCanvas,
        'normal-preview': normalCanvas,
        'material-preview': materialCanvas
    };

    for (const [id, source] of Object.entries(canvases)) {
        const previewCanvas = document.getElementById(id);
        if (previewCanvas) {
            const aspect = sourceImage.width / sourceImage.height;
            previewCanvas.height = previewCanvas.clientWidth / aspect;
            previewCanvas.getContext('2d').drawImage(source, 0, 0, previewCanvas.width, previewCanvas.height);
        }
    }
}

function exportImage(type) {
    if (!sourceImage) {
        showMessage("Please load a source image before exporting.");
        return;
    }
    const link = document.createElement('a');
    if (type === 'normal') {
        link.download = 'normal_map.png';
        link.href = normalCanvas.toDataURL('image/png');
    } else {
        link.download = 'material_map_mra.png';
        link.href = materialCanvas.toDataURL('image/png');
    }
    link.click();
}


// --- EVENT LISTENERS ---
fileInput.addEventListener('change', handleMainFileLoad);
exportNormalBtn.addEventListener('click', () => exportImage('normal'));
exportMaterialBtn.addEventListener('click', () => exportImage('material'));

const debouncedUpdateNormal = debounce(updateNormalMap, 150);
[strengthSlider, invertRCheck, invertGCheck].forEach(control => {
    control.addEventListener('input', () => {
        if (control.id === 'strength') strengthValue.textContent = parseFloat(strengthSlider.value).toFixed(1);
        debouncedUpdateNormal();
    });
});

const debouncedUpdateMaterial = debounce(updateMaterialMap, 150);
metallicFileInput.addEventListener('change', (e) => handleMaterialFileLoad(e, 'metallic'));
roughnessFileInput.addEventListener('change', (e) => handleMaterialFileLoad(e, 'roughness'));
aoFileInput.addEventListener('change', (e) => handleMaterialFileLoad(e, 'ao'));

[metallicSlider, roughnessSlider, aoSlider].forEach(slider => {
    slider.addEventListener('input', () => {
        metallicValue.textContent = parseFloat(metallicSlider.value).toFixed(2);
        roughnessValue.textContent = parseFloat(roughnessSlider.value).toFixed(2);
        aoValue.textContent = parseFloat(aoSlider.value).toFixed(2);
        debouncedUpdateMaterial();
    });
});

// Model switching buttons
document.getElementById('cowboy-btn').addEventListener('click', () => loadModel('cowboy'));
document.getElementById('sphere-btn').addEventListener('click', () => loadModel('sphere'));
document.getElementById('cube-btn').addEventListener('click', () => loadModel('cube'));
document.getElementById('plane-btn').addEventListener('click', () => loadModel('plane'));

// Utility Menu Listeners
utilityToggleBtn.addEventListener('click', () => {
    utilityPanel.classList.toggle('hidden');
});

lightColorInput.addEventListener('input', (event) => {
    if (pointLight) {
        pointLight.color.set(event.target.value);
    }
});

lightIntensitySlider.addEventListener('input', (event) => {
    const intensity = parseFloat(event.target.value);
    if (pointLight) {
        pointLight.intensity = intensity;
    }
    lightIntensityValue.textContent = intensity.toFixed(1);
});

// --- INITIALIZATION CALL ---
initThree();