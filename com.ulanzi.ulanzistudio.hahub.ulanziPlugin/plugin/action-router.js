// Action router — extracts action UUID from context and dispatches lifecycle
// events to the correct action handler instance.

class ActionRouter {
  constructor(deps) {
    this.deps = deps;
    this.actions = new Map();
    this.handlerClasses = new Map();
  }

  register(klass) {
    this.handlerClasses.set(klass.type(), klass);
  }

  // Context format from SDK: uuid + '___' + key + '___' + actionid
  extractUuid(context) {
    return context.split('___')[0];
  }

  ensure(context) {
    let action = this.actions.get(context);
    if (action) return action;
    const uuid = this.extractUuid(context);
    const Klass = this.handlerClasses.get(uuid);
    if (!Klass) return null;
    action = new Klass(context);
    action.attach(this.deps);
    this.actions.set(context, action);
    return action;
  }

  remove(context) {
    const action = this.actions.get(context);
    if (action) {
      action.detach();
      this.actions.delete(context);
      this.deps.settings.removeKey(context);
    }
  }

  forEach(fn) {
    this.actions.forEach(fn);
  }

  get(context) { return this.actions.get(context); }
}

window.ActionRouter = ActionRouter;
