import React, { Component } from 'react';
import { createPortal } from 'react-dom';
import Content from './Content';
import { FrameContextProvider } from './Context';

export interface FrameProps
  extends React.IframeHTMLAttributes<HTMLIFrameElement> {
  head?: React.ReactNode;
  mountTarget?: string;
  contentDidMount?: () => void;
  contentDidUpdate?: () => void;
}

interface FrameState {
  iframeLoaded: boolean;
}

export class Frame extends Component<FrameProps, FrameState> {
  static defaultProps: Partial<FrameProps> = {
    style: {},
    head: null,
    children: undefined,
    mountTarget: undefined,
    contentDidMount: () => {},
    contentDidUpdate: () => {},
  };

  private frameNode: HTMLIFrameElement | null = null;
  private frameMounted = false;

  constructor(props: FrameProps) {
    super(props);
    this.state = { iframeLoaded: false };
  }

  componentDidMount() {
    this.frameMounted = true;
    const doc = this.getDoc();
    if (doc?.readyState === 'complete') {
      this.forceUpdate();
    } else {
      this.frameNode?.addEventListener('load', this.handleLoad);
    }
  }

  componentWillUnmount() {
    this.frameMounted = false;
    this.frameNode?.removeEventListener('load', this.handleLoad);
  }

  private getDoc(): Document | null {
    return this.frameNode?.contentDocument ?? null;
  }

  private getMountTarget(doc: Document): Element | null {
    return this.props.mountTarget
      ? doc.querySelector(this.props.mountTarget)
      : doc.body;
  }

  private setRef = (node: HTMLIFrameElement | null) => {
    this.frameNode = node;
  };

  private handleLoad = () => {
    this.setState({ iframeLoaded: true });
  };

  private renderFrameContents(): React.ReactNode {
    if (!this.frameMounted) {
      return null;
    }
    const doc = this.getDoc();
    if (!doc) {
      return null;
    }
    const mountTarget = this.getMountTarget(doc);
    if (!mountTarget) {
      return null;
    }

    const contents = (
      <Content
        contentDidMount={this.props.contentDidMount ?? (() => {})}
        contentDidUpdate={this.props.contentDidUpdate ?? (() => {})}
      >
        <FrameContextProvider
          value={{ document: doc, window: doc.defaultView ?? undefined }}
        >
          <div className="frame-content">{this.props.children}</div>
        </FrameContextProvider>
      </Content>
    );

    return [
      createPortal(this.props.head, doc.head),
      createPortal(contents, mountTarget),
    ];
  }

  render() {
    // Custom Frame props must not be forwarded to the native iframe.
    const props = {
      ...this.props,
      children: undefined,
    };
    delete props.head;
    // Avoid srcDoc on iOS WeChat and the document.write performance path.
    delete props.srcDoc;
    delete props.mountTarget;
    delete props.contentDidMount;
    delete props.contentDidUpdate;

    return (
      <iframe
        title={props.id}
        {...props}
        ref={this.setRef}
        onLoad={this.handleLoad}
      >
        {this.renderFrameContents()}
      </iframe>
    );
  }
}
