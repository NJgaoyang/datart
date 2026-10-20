import { loadScript } from 'app/utils/resource';

/** Cache in-flight chart dependencies across mount/unmount cycles.
 * Failed scripts are evicted so that a later chart mount can retry.
 */
export default class ChartIFrameResourceLoader {
  private resources = new Map<string, Promise<unknown>>();

  loadResource(doc: Document, deps?: string[]): Promise<unknown[]> {
    return Promise.all(
      (deps || []).map(dep => {
        const cached = this.resources.get(dep);
        if (cached) return cached;
        const request = Promise.resolve()
          .then(() => loadScript(dep, doc))
          .catch(error => {
            this.resources.delete(dep);
            throw error;
          });
        this.resources.set(dep, request);
        return request;
      }),
    );
  }

  public dispose(): void {
    this.resources.clear();
  }
}
