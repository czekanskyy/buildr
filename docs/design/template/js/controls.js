/* Control library: every control in every state.
 * Mocked state only: values live in this component's state and reset on reload. */
(function () {
  'use strict';
  const DCLogic = window.Buildr.Component;

class Component extends DCLogic {
  renderVals() { return { theme: this.props.theme ?? 'light', yes: true }; }
}

  window.Buildr.register('controls', Component, {"theme": "light"});
})();
