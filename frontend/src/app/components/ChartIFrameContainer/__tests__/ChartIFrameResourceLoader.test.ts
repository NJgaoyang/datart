import { vi } from 'vitest';
import ChartIFrameResourceLoader from '../ChartIFrameResourceLoader';
import { loadScript } from 'app/utils/resource';

vi.mock('app/utils/resource', () => ({ loadScript: vi.fn() }));

describe('Chart iframe plugin loading', () => {
  afterEach(() => vi.mocked(loadScript).mockReset());

  it('waits for one pending script across repeated chart mounts', async () => {
    let complete!: () => void;
    const pending = new Promise<void>(resolve => {
      complete = resolve;
    });
    vi.mocked(loadScript).mockReturnValue(pending as any);
    const loader = new ChartIFrameResourceLoader();
    const first = loader.loadResource(document, ['/plugin.js']);
    const second = loader.loadResource(document, ['/plugin.js']);
    await Promise.resolve();
    expect(loadScript).toHaveBeenCalledTimes(1);
    complete();
    await Promise.all([first, second]);
  });

  it('retries a failed plugin load rather than caching a rejection', async () => {
    vi.mocked(loadScript).mockRejectedValueOnce(new Error('network'));
    vi.mocked(loadScript).mockResolvedValueOnce(undefined as any);
    const loader = new ChartIFrameResourceLoader();
    await expect(loader.loadResource(document, ['/plugin.js'])).rejects.toThrow('network');
    await expect(loader.loadResource(document, ['/plugin.js'])).resolves.toEqual([undefined]);
    expect(loadScript).toHaveBeenCalledTimes(2);
  });

  it('loads dependencies again for a new iframe document', async () => {
    vi.mocked(loadScript).mockResolvedValue(undefined as any);
    const loader = new ChartIFrameResourceLoader();
    const otherDocument = document.implementation.createHTMLDocument('new chart frame');
    await loader.loadResource(document, ['/plugin.js']);
    await loader.loadResource(otherDocument, ['/plugin.js']);
    expect(loadScript).toHaveBeenCalledTimes(2);
    expect(vi.mocked(loadScript).mock.calls[1][1]).toBe(otherDocument);
  });
});
