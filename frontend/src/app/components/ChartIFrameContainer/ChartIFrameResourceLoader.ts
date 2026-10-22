import { loadScript } from 'app/utils/resource';

/** Cache in-flight chart dependencies across mount/unmount cycles.
 * Failed scripts are evicted so that a later chart mount can retry.
 */
export default class ChartIFrameResourceLoader {
  private resources = new WeakMap<Document, Map<string, Promise<unknown>>>();

  loadResource(doc: Document, deps?: string[]): Promise<unknown[]> {
    let documentResources = this.resources.get(doc);
    if (!documentResources) {
      documentResources = new Map();
      this.resources.set(doc, documentResources);
    }
    const cache = documentResources;
    return Promise.all(
      (deps || []).map(dep => {
        const cached = cache.get(dep);
        if (cached) return cached;
        const request = Promise.resolve()
          .then(() => loadScript(dep, doc))
          .catch(error => {
            cache.delete(dep);
            throw error;
          });
        cache.set(dep, request);
        return request;
      }),
    );
  }

  public dispose(): void {
    this.resources = new WeakMap<Document, Map<string, Promise<unknown>>>();
  }
}
