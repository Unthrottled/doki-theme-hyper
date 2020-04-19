import React from 'react';
import { Component } from 'react';
import { THEME_STATE, ThemeState } from './reducer';
import { SET_THEME, TOGGLE_STICKER, STICKER_UPDATED } from './settings';
import path from 'path';
import { resolveLocalStickerPath } from './StickerUpdateService';
import {ipcRenderer, App} from 'electron';

const passProps = (uid: any, parentProps: any, props: any) => Object.assign(props, {
  [THEME_STATE]: parentProps[THEME_STATE],
});

export const mapTermsState = (state: any, map: any) => {
  return Object.assign(map, {
    [THEME_STATE]: state.ui[THEME_STATE],
  })
};

export const mapHyperState = mapTermsState;
export const getTermGroupProps = passProps;
export const getTermProps = passProps;

export const decorateHyper = (Hyper: any) =>
  class HyperDecorator extends Component<any> {
    render() {
      return <Hyper {...this.props} />;
    }
  };

declare global {
  interface Window {
    config: any,
    rpc: any,
    store: any,
  }
  module Electron {
    interface App {
      getWindows: () => BrowserWindow[];
      getLastFocusedWindow: () => BrowserWindow;
    }
    interface BrowserWindow {
      rpc: any;
    }
  }
}

export const CONFIG_RELOAD = 'CONFIG_RELOAD';
export function reloadConfig(config: any) {
  const now = Date.now();
  return {
    type: CONFIG_RELOAD,
    config,
    now
  };
}

export const decorateTerm = (Term: any) =>
  class TerminalDecorator extends Component {
    componentDidMount() {
      window.rpc.on(SET_THEME, (theme: any) => {
        window.store.dispatch({
          type: SET_THEME,
          payload: theme,
        });
        window.store.dispatch(reloadConfig(
          window.config.getConfig()
        ));
        ipcRenderer.send(SET_THEME, theme);
      });
      ipcRenderer.on(STICKER_UPDATED, ()=>{
        console.log('new sticker!!');
        this.forceUpdate();
        window.store.dispatch({
          type: 'RE_RENDER_PLZ',
        });
      })
      window.rpc.on(TOGGLE_STICKER, ()=>{
        window.store.dispatch({
          type: TOGGLE_STICKER,
        });
      })
    }

    render() {
      // @ts-ignore
      const themeState: ThemeState = this.props[THEME_STATE];

      const imageStyle = window.screen.width <= 1920 ?
      {maxHeight: '200px'} : {}
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {React.createElement(Term, Object.assign({}, this.props))}
          <div style={{
            position: 'absolute',
            bottom: '0.5rem',
            right: '0.5rem',
            color: 'black'
          }}>
            {
              themeState.showSticker ? 
              <img src={this.constructStickerUrl(themeState)}  
                   style={imageStyle}
                   alt={'Sticker!'}/> : <></>
            }
          </div>
        </div>
      )
    }

    private constructStickerUrl(themeState: ThemeState): string | undefined {
      const localStickerPath = resolveLocalStickerPath(themeState.activeTheme.sticker).replace(path.sep, '/');
      return `${localStickerPath}?time=${new Date().valueOf().toString(32)}`;
    }
  };
