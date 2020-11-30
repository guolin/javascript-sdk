import 'should';
import { adapters } from '../../test-adapters';
import { App } from '../../../src/app';
import { UserObject, UserObjectRef, CurrentUserManager, AuthedUser } from '../../../src/user';
import { KEY_CURRENT_USER } from '../../../src/const';
import { LCEncode } from '../../../src/object';

const app = new App({
  appId: 'test-app-id',
  appKey: 'test-app-key',
  serverURL: 'test-server-url',
});

describe('CurrentUser', () => {
  describe('.set', function () {
    it("should set current user's data into localStorage", () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { key: 'value' };
      CurrentUserManager.set(user);
      const userKV = app.storage.get(KEY_CURRENT_USER);
      JSON.parse(userKV).should.containEql({
        objectId: user.objectId,
        key: 'value',
      });
    });
  });

  describe('.get', function () {
    it('should get user data from localStorage', function () {
      app.storage.delete(KEY_CURRENT_USER);
      app.currentUser = null;
      const user = new AuthedUser(app, 'test-user-id');
      user.data = {
        key: 'value',
        sessionToken: 'test-session-token',
      };
      app.storage.set(KEY_CURRENT_USER, JSON.stringify(LCEncode(user, { full: true })));
      CurrentUserManager.get(app).data.should.containEql(user.data);
    });

    it('should get user data into app#currentUser', function () {
      app.storage.delete(KEY_CURRENT_USER);
      app.currentUser = null;
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { key: 'value' };
      app.currentUser = user;
      CurrentUserManager.get(app).should.eql(user);
    });
  });

  describe('.remove', function () {
    it('should remove user data from localStorage', function () {
      app.storage.set(KEY_CURRENT_USER, 'data');
      CurrentUserManager.remove(app);
      (!app.storage.get(KEY_CURRENT_USER)).should.true();
    });

    it('should set app#currentUser null', function () {
      const user = new AuthedUser(app, 'test-user-id');
      app.currentUser = user;
      CurrentUserManager.remove(app);
      (app.currentUser === null).should.true();
    });
  });

  describe('.persist', function () {
    it('should flush user data into localStorage', function () {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { key: 'value' };
      CurrentUserManager.persist(user);
      app.storage.get(KEY_CURRENT_USER).should.eql(JSON.stringify(LCEncode(user, { full: true })));
    });
  });
});

describe('UserReference', function () {
  const ref = new UserObjectRef(app, 'test-user-id');
  describe('#ACLKey', function () {
    it("should return user's objectId", function () {
      ref.aclKey.should.eql(ref.objectId);
    });
  });

  describe('#get', function () {
    it('should return a User', async function () {
      adapters.responses.push({ body: { objectId: 'test-user-id' } });
      (await ref.get()).should.instanceOf(UserObject);
    });
  });

  describe('#update', function () {
    it('should return a User', async function () {
      adapters.responses.push({ body: { objectId: 'test-user-id' } });
      (await ref.update({})).should.instanceOf(UserObject);
    });
  });
});

describe('AuthedUser', () => {
  describe('#isAuthenticated', () => {
    it('should send GET request to /users/me', async () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      await user.isAuthenticated();
      const req = adapters.requests.pop();
      req.method.should.eql('GET');
      req.url.should.endWith('/users/me');
    });

    it("should send user's sessionToken", async () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      await user.isAuthenticated();
      const req = adapters.requests.pop();
      req.header['X-LC-Session'].should.eql(user.sessionToken);
    });

    it('should return false when error code is 211', async function () {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      adapters.responses.push({ status: 400, body: { code: 211, error: '' } });
      (await user.isAuthenticated()).should.false();
    });

    it('should throw error when error code is not 211', () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      adapters.responses.push({ status: 400, body: { code: 123, error: '' } });
      return user.isAuthenticated().should.rejected();
    });
  });

  describe('#updatePassword', () => {
    it('should send PUT request to /users/${objectId}/updatePassword', async () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      await user.updatePassword('old-password', 'new-password');
      const req = adapters.requests.pop();
      req.method.should.eql('PUT');
      req.url.should.endWith('/users/test-user-id/updatePassword');
    });

    it('check password and sessionToken', async () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      await user.updatePassword('old-password', 'new-password');
      const req = adapters.requests.pop();
      req.header['X-LC-Session'].should.eql('test-session-token');
      req.body.should.eql({
        old_password: 'old-password',
        new_password: 'new-password',
      });
    });

    it('should update sessionToken', async () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      adapters.responses.push({ body: { sessionToken: 'new-session-token' } });
      await user.updatePassword('old-password', 'new-password');
      user.sessionToken.should.eql('new-session-token');
    });
  });

  describe('#associateWithAuthData', function () {
    it('should update authData[platform]', async function () {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      adapters.responses.push({ body: { objectId: 'test-user-id' } });
      await user.associateWithAuthData('platform', { key: 'value' });
      const req = adapters.requests.pop();
      req.body.should.eql({ authData: { platform: { key: 'value' } } });
    });
  });

  describe('#dissociateAuthData', function () {
    it('should send delete operation with authData[platform]', async function () {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      adapters.responses.push({ body: { objectId: 'test-user-id' } });
      await user.dissociateAuthData('platform');
      const req = adapters.requests.pop();
      req.body.should.eql({
        'authData.platform': { __op: 'Delete' },
      });
    });
  });

  describe('#signUp', function () {
    it('should throw error when user is not anonymous', function () {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      return user.signUp({} as any).should.rejected();
    });

    it('should remove anonymous id when user is current', async function () {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { authData: { anonymous: { id: 'anonymous-id' } } };
      CurrentUserManager.set(user);
      adapters.responses.push({ body: { objectId: 'test-user-id' } });
      await user.signUp({ username: 'name', password: 'secret' });
      CurrentUserManager.get(app).isAnonymous().should.false();
    });
  });

  describe('#refreshSessionToken', () => {
    it('should send PUT request to /users/${objectId}/refreshSessionToken', async () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      await user.refreshSessionToken();
      const req = adapters.requests.pop();
      req.method.should.eql('PUT');
      req.url.should.endWith('/users/test-user-id/refreshSessionToken');
    });

    it('should update sessionToken', async () => {
      const user = new AuthedUser(app, 'test-user-id');
      user.data = { sessionToken: 'test-session-token' };
      app.currentUser = user;
      adapters.responses.push({ body: { sessionToken: 'new-session-token' } });
      await user.refreshSessionToken();
      user.sessionToken.should.eql('new-session-token');
      app.currentUser = null;
      app.getSessionToken().should.eql('new-session-token');
    });
  });
});