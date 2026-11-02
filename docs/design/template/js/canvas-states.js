/* Canvas block states.
 * Mocked state only: values live in this component's state and reset on reload. */
(function () {
  'use strict';
  const DCLogic = window.Buildr.Component;

class Component extends DCLogic {
  renderVals() {
    return { theme: this.props.theme ?? 'light' };
  }
}

  window.Buildr.register('canvas-states', Component, {"theme": "light"});
})();
