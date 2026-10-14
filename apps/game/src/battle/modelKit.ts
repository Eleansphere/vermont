import type { ModelKit } from '@vermont/render';
import { loadModelKit } from '@vermont/render';

let loading: Promise<ModelKit | null> | null = null;

/**
 * The terrain tiles and unit figures, loaded once for every battle. Resolves to `null` when the
 * files cannot be loaded; the battle is then drawn with plain shapes.
 */
export function modelKit(): Promise<ModelKit | null> {
  // The glTF loader comes in a chunk of its own, so the menu does not wait for it.
  loading ??= import('@vermont/render/gltf')
    .then(({ gltfModelLoader }) =>
      loadModelKit(`${import.meta.env.BASE_URL}models/`, gltfModelLoader())
    )
    .catch((error: unknown) => {
      console.warn('The models could not be loaded; drawing plain shapes instead.', error);
      return null;
    });
  return loading;
}
