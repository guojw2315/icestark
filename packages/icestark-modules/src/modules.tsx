import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Sandbox from '@ice/sandbox';
import ModuleLoader, { StarkModule } from './loader';

let globalModules = [];
let importModules = {};

if (!(window as any)?.proxyWindow) {
  window.proxyWindow = new Sandbox();
}

export const moduleLoader = new ModuleLoader();

declare global {
  interface Window {
    proxyWindow?: Sandbox;
  }
}

/**
 * support react module render
 */
const defaultMount = (Component: any, targetNode: HTMLElement, props?: any) => {
  console.warn('Please set mount, try run react mount function');
  try {
    ReactDOM.render(renderComponent(Component, props), targetNode);
  } catch(err) {}
};

/**
 * default unmount function
 */
const defaultUnmount = (targetNode: HTMLElement) => {
  console.warn('Please set unmount, try run react unmount function');
  try {
    ReactDOM.unmountComponentAtNode(targetNode);
  } catch(err) {}
};

/**
 * Render Component, compatible with Component and <Component>
 */
export function renderComponent(Component: any, props = {}): React.ReactElement {
  return React.isValidElement(Component) ? (
    React.cloneElement(Component, props)
  ) : (
    <Component {...props} />
  );
}

/**
 * default render compoent, mount all modules
 */
export class MicroModule extends React.Component<any, {}> {
  mountModule = null;
  mountNode = null;

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.mountModules();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.modules !== this.props.modules || prevProps.name !== this.props.name) {
      this.mountModules();
    }
  }

  componentWillUnmount() {
    unmoutModule(this.mountModule, this.mountNode);
  }

  mountModules() {
    this.mountModule = getModules().filter(module => module.name === this.props.name)[0];
    if (!this.mountModule) {
      console.error(`Can't find ${this.props.name} module in modules config`);
      return;
    }

    mountModule(this.mountModule, this.mountNode, this.props);
  }

  render() {
    return (<div ref={ref => this.mountNode = ref} />);
  }
};

/**
 * return globalModules
*/
export const getModules = function () {
  return globalModules || [];
};

/**
 * mount module function
 */
export const mountModule = async (targetModule: StarkModule, targetNode: HTMLElement, props: any = {}) => {
  const { name } = targetModule;

  if (!importModules[name]) {
    importModules[name] = await moduleLoader.execModule(targetModule);
  }

  const module = importModules[name];

  if (!module) {
    console.error('load or exec module faild');
    return;
  }

  const mount = targetModule.mount || module.mount || defaultMount;
  const component = module.default || module;

  // clear proxyWindow
  if (window?.proxyWindow?.clear) {
    window.proxyWindow.clear();
  }

  return mount(component, targetNode, props);
};

/**
 * unmount module function
 */
export const unmoutModule = (targetModule: StarkModule, targetNode: HTMLElement) => {
  const { name } = targetModule;
  const module = importModules[name];
  const unmount = targetModule.unmount || module.unmount || defaultUnmount;
  return unmount(targetNode);
};

/**
 * Render Modules, compatible with Render and <Render>
 */
export default function renderModules(modules: StarkModule[], render: any, componentProps?: any): React.ReactElement {
  // save match app modules in global
  globalModules = modules;

  if (render) {
    return renderComponent(render, {
      modules,
      ...componentProps,
    });
  }

  console.warn('Please set render Component, try use MicroModule and mount first module');
  return <MicroModule name={modules[0]?.name} modules={modules} {...componentProps} />;
};
