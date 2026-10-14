import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModelLoader } from './load';

/** Loads models with three's glTF loader; for the browser. */
export function gltfModelLoader(): ModelLoader {
  const loader = new GLTFLoader();
  return async (url) => {
    const gltf = await loader.loadAsync(url);
    return { scene: gltf.scene, animations: gltf.animations };
  };
}
