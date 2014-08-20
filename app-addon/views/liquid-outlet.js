import Ember from "ember";
import { Promise, animate, stop } from "vendor/liquid-fire";

export default Ember.ContainerView.extend({
  classNames: ['liquid-outlet'],
  attributeBindings: ['style'],

  init: function(){
    // The ContainerView constructor normally sticks our "currentView"
    // directly into _childViews, but we want to leave that up to
    // _currentViewDidChange so we have the opportunity to launch a
    // transition.
    this._super();
    Ember.A(this._childViews).clear();
  },

  // Deliberately overriding a private method from
  // Ember.ContainerView!
  //
  // We need to stop it from destroying our outgoing child view
  // prematurely.
  _currentViewWillChange: Ember.beforeObserver('currentView', function() {}),

  // Deliberately overriding a private method from
  // Ember.ContainerView!
  _currentViewDidChange: Ember.on('init', Ember.observer('currentView', function() {
    // Normally there is only one child (the view we're
    // replacing). But sometimes there may be two children (because a
    // transition is already in progress). In any case, we tell all of
    // them to start heading for the exits now.

    var oldView = this.get('childViews.lastObject'),
        newView = this.get('currentView');

    // Idempotence
    if ((!oldView && !newView) ||
        (oldView && oldView.get('currentView') === newView) ||
        (this._runningTransition &&
         this._runningTransition.oldView === oldView &&
         this._runningTransition.newContent === newView
        )) {
      return;
    }

    // `transitions` comes from dependency injection, see the
    // liquid-fire app initializer.
    var transition = this.get('transitions').transitionFor(this, oldView, newView, this.get('use'));

    if (this._runningTransition) {
      this._runningTransition.interrupt();
    }

    this._runningTransition = transition;
    transition.run().catch(function(err){
      // Force any errors through to the RSVP error handler, because
      // of https://github.com/tildeio/rsvp.js/pull/278.  The fix got
      // into Ember 1.7, so we can drop this once we decide 1.6 is
      // EOL.
      Ember.RSVP.Promise.cast()._onerror(err);
    });
  })),

  _liquidChildFor: function(content) {
    if (content && !content.get('hasLiquidContext')){
      content.set('liquidContext', content.get('context'));
    }
    var LiquidChild = this.container.lookupFactory('view:liquid-child');
    return LiquidChild.create({
      currentView: content
    });
  },

  _pushNewView: function(newView) {
    var child = this._liquidChildFor(newView),
        promise = new Promise(function(resolve) {
          child._resolveInsertion = resolve;
        });
    this.pushObject(child);
    return promise;
  },

  style: Ember.computed('preserveWidth', 'preserveHeight', function() {
    var w = this.get('preserveWidth'),
        h = this.get('preserveHeight'),
        out = [];
    if (typeof(w) !== 'undefined') {
      out.push('width:' + w + 'px');
    }
    if (typeof(h) !== 'undefined') {
      out.push('height:' + h + 'px');
    }
    return out.join(';');
  }),

  lockSize: function() {
    var elt = this.$();
    if (elt) {
      this._lastLockWidth = elt.width();
      this._lastLockHeight = elt.height();
      elt.width(this._lastLockWidth);
      elt.height(this._lastLockHeight);
    }
  },

  unlockSize: function() {
    var self = this;
    function doUnlock(){
      var elt = self.$();
      if (elt) {
        elt.css({width: '', height: ''});
      }
    }
    if (this._scaling) {
      this._scaling.then(doUnlock);
    } else {
      doUnlock();
    }
  },

  adaptSize: function(width, height) {
    stop(this);
    var target = {};
    if (typeof(this._lastLockWidth) === 'undefined') {
      return;
    }
    if (width !== this._lastLockWidth) {
      target.width = [width, this._lastLockWidth];
    }
    if (height !== this._lastLockHeight) {
      target.height = [height, this._lastLockHeight];
    }

    for (var unused in target) { // jshint ignore:line
      this._scaling = animate(this, target, { duration: 1500 });
      break;
    }
  }

});
