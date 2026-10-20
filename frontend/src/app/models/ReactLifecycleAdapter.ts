/**
 * React 19 uses createRoot instead of the removed ReactDOM.render API.
 * Preserve a single root for each chart container over its mount/update/resize lifecycle.
 */
import React from 'react';
import * as ReactDom from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

export default class ReactLifecycleAdapter {
  private root: Root | null = null;
  private domContainer: Element | null = null;
  private reactComponent: any;
  private externalLibs: Record<string, unknown> = {};

  constructor(componentWrapper: any) {
    this.reactComponent = componentWrapper;
  }

  public registerImportDependencies(dependencies: Record<string, unknown> | string[]) {
    this.externalLibs = dependencies;
  }

  public mounted(container: Element | null, options?: any, context?: any) {
    if (!container) return;
    // A chart instance may be remounted into a fresh frame container.
    if (this.domContainer !== container) {
      this.root?.unmount();
      this.root = null;
    }
    this.domContainer = container;
    this.root ??= createRoot(container);
    this.render(options, context);
  }

  public updated(options: any, context?: any) {
    this.render(options, context);
  }

  public resize(options: any, context?: any) {
    this.render(options, context);
  }

  public unmount() {
    this.root?.unmount();
    this.root = null;
    this.domContainer = null;
  }

  private render(options?: any, context?: any) {
    if (!this.root) return;
    this.root.render(React.createElement(this.getComponent(), options, context));
  }

  private getComponent(): React.ComponentType<any> {
    if (typeof this.reactComponent === 'function') {
      return this.reactComponent({
        React,
        ReactDom,
        ...this.externalLibs,
      });
    }
    return this.reactComponent;
  }
}
