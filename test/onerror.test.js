import assert from 'assert';
import feathers from 'feathers';

import hooks from '../src/hooks';

describe('.onError hooks', () => {
  describe('on direct service method errors', () => {
    const errorMessage = 'Something else went wrong';
    const app = feathers().configure(hooks()).use('/dummy', {
      get() {
        return Promise.reject(new Error('Something went wrong'));
      }
    });
    const service = app.service('dummy');

    afterEach(() => service.__hooks.onError.get.pop());

    it('basic onError hook', done => {
      service.onError({
        get(hook) {
          assert.equal(hook.type, 'onError');
          assert.equal(hook.id, 'test');
          assert.equal(hook.method, 'get');
          assert.equal(hook.app, app);
          assert.equal(hook.error.message, 'Something went wrong');
        }
      });

      service.get('test').then(() => {
        done(new Error('Should never get here'));
      }).catch(() => done());
    });

    it('can change the error', () => {
      service.onError({
        get(hook) {
          hook.error = new Error(errorMessage);
        }
      });

      return service.get('test').catch(error => {
        assert.equal(error.message, errorMessage);
      });
    });

    it('throwing an error', () => {
      service.onError({
        get() {
          throw new Error(errorMessage);
        }
      });

      return service.get('test').catch(error => {
        assert.equal(error.message, errorMessage);
      });
    });

    it('rejecting a promise', () => {
      service.onError({
        get() {
          return Promise.reject(new Error(errorMessage));
        }
      });

      return service.get('test').catch(error => {
        assert.equal(error.message, errorMessage);
      });
    });

    it('calling `next` with error', () => {
      service.onError({
        get(hook, next) {
          next(new Error(errorMessage));
        }
      });

      return service.get('test').catch(error => {
        assert.equal(error.message, errorMessage);
      });
    });
  });

  describe('error in hooks', () => {
    const errorMessage = 'before hook broke';

    let app, service;

    beforeEach(() => {
      app = feathers().configure(hooks()).use('/dummy', {
        get(id) {
          return Promise.resolve({
            id, text: `You have to do ${id}`
          });
        }
      });

      service = app.service('dummy');
    });

    it('error in before hook', done => {
      service.before(function() {
        throw new Error(errorMessage);
      }).onError(function(hook) {
        assert.equal(hook.error.hook.type, 'before',
          'Original hook still set'
        );
        assert.equal(hook.id, 'dishes');
        assert.equal(hook.error.message, errorMessage);
        done();
      });

      service.get('dishes').then(done);
    });

    it('error in after hook', done => {
      service.after(function() {
        throw new Error(errorMessage);
      }).onError(function(hook) {
        assert.equal(hook.error.hook.type, 'after',
          'Original hook still set'
        );
        assert.equal(hook.id, 'dishes');
        assert.deepEqual(hook.result, {
          id: 'dishes',
          text: 'You have to do dishes'
        });
        assert.equal(hook.error.message, errorMessage);
        done();
      });

      service.get('dishes').then(done);
    });
  });
});