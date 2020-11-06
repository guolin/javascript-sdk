import * as should from 'should';
import { adapters } from '../test-adapters';
import { App } from '../../src/app';
import { StatusQuery, StatusClass } from '../../src/status';
import { AuthedUser, CurrentUserManager, UserObject, UserObjectRef } from '../../src/user';

const app = new App({
  appId: 'test-app-id',
  appKey: 'test-app-key',
  serverURL: 'test-server-url',
});

describe('StatusQuery', () => {
  const query = new StatusQuery(app);

  describe('#whereStatusOwner', () => {
    it('should accept string id param', async () => {
      await query.whereStatusOwner('test-user-id').find();
      const req = adapters.requests.pop();
      JSON.parse(req.query.where as string).should.eql({
        source: { __type: 'Pointer', className: '_User', objectId: 'test-user-id' },
      });
    });

    it('should accept UserObject', async function () {
      await query.whereStatusOwner(new UserObject(null, 'test-user-id')).find();
      const req = adapters.requests.pop();
      JSON.parse(req.query.where as string).should.eql({
        source: { __type: 'Pointer', className: '_User', objectId: 'test-user-id' },
      });
    });

    it('should accept UserObjectRef', async function () {
      await query.whereStatusOwner(new UserObjectRef(null, 'test-user-id')).find();
      const req = adapters.requests.pop();
      JSON.parse(req.query.where as string).should.eql({
        source: { __type: 'Pointer', className: '_User', objectId: 'test-user-id' },
      });
    });
  });

  describe('#whereInboxOwner', () => {
    it('should throw an error when the owner has no sessionToken', () => {
      const owner = new AuthedUser(null, '');
      owner.data = {};
      should.throws(
        () => query.whereInboxOwner(owner),
        'Cannot query both inboxOwner and statusOwner'
      );
    });

    it('check query condition', async () => {
      const owner = new AuthedUser(null, 'test-user-id');
      owner.data = { sessionToken: 'test-session-token' };
      await query.whereInboxOwner(owner).find();
      const req = adapters.requests.pop();
      JSON.parse(req.query.owner as string).should.eql({
        __type: 'Pointer',
        className: '_User',
        objectId: 'test-user-id',
      });
    });

    it("should use owner's sessionToken", async () => {
      const currentUser = new UserObject(app, '');
      currentUser.data = { sessionToken: 'current-user-session' };
      const owner = new AuthedUser(null, '');
      owner.data = { sessionToken: 'owner-session' };
      await query.whereInboxOwner(owner).find();
      const req = adapters.requests.pop();
      req.header['X-LC-Session'].should.eql(owner.sessionToken);
    });
  });

  it('#whereInboxType', async () => {
    const user = new AuthedUser(null, '');
    user.data = { sessionToken: 'test-session-token' };
    await query.whereInboxOwner(user).whereInboxType('test-inbox-type').find();
    const req = adapters.requests.pop();
    req.query.inboxType.should.eql('test-inbox-type');
  });

  it('#whereSinceId', async () => {
    const user = new AuthedUser(null, '');
    user.data = { sessionToken: 'test-session-token' };
    await query.whereInboxOwner(user).whereSinceId(123).find();
    const req = adapters.requests.pop();
    req.query.sinceId.should.eql('123');
  });

  it('#whereMaxId', async () => {
    const user = new AuthedUser(null, '');
    user.data = { sessionToken: 'test-session-token' };
    await query.whereInboxOwner(user).whereMaxId(321).find();
    const req = adapters.requests.pop();
    req.query.maxId.should.eql('321');
  });

  describe('#find', () => {
    it('should send GET request to /subscribe/statuses when inboxOwner is set', async () => {
      const user = new AuthedUser(null, '');
      user.data = { sessionToken: 'test-session-token' };
      await query.whereInboxOwner(user).find();
      const req = adapters.requests.pop();
      req.method.should.eql('GET');
      req.url.should.endWith('/subscribe/statuses');
    });

    it('should throw an error when set both statusOwner and inboxOwner', () => {
      const user = new AuthedUser(null, '');
      user.data = { sessionToken: 'test-session-token' };
      should.throws(() => query.whereInboxOwner(user).whereStatusOwner(user).find());
    });
  });
});

describe('StatusClass', () => {
  const Status = new StatusClass(app);

  describe('#sendToFollowers', () => {
    it('should throw an error when the no user is logged in', () => {
      return Status.sendToFollowers({}).should.rejected();
    });

    it('should send POST requests to /statuses', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      adapters.responses.push({ body: { objectId: 'test-status-id' } });
      await Status.sendToFollowers(owner, {});
      const req = adapters.requests.pop();
      req.method.should.eql('POST');
      req.url.should.endWith('/statuses');
    });

    it('should add "source" to the status data', async () => {
      const owner = new AuthedUser(app, 'owner-id');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      adapters.responses.push({ body: { objectId: 'test-status-id' } });
      await Status.sendToFollowers({});
      const req = adapters.requests.pop();
      req.body.data.source.should.eql(owner.toPointer());
    });

    it('should send to all followers', async () => {
      const owner = new AuthedUser(null, 'owner-id');
      owner.data = { sessionToken: 'test-session-token' };
      adapters.responses.push({ body: { objectId: 'test-status-id' } });
      await Status.sendToFollowers(owner, {});
      const req = adapters.requests.pop();
      req.body.query.should.containEql({
        className: '_Follower',
        keys: 'follower',
        where: { user: owner.toPointer() },
      });
    });

    it('check options', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      adapters.responses.push({ body: { objectId: 'test-status-id' } });
      await Status.sendToFollowers({}, { inboxType: 'test-inbox-type' });
      const req = adapters.requests.pop();
      req.body.inboxType.should.eql('test-inbox-type');
    });
  });

  describe('#sendToUser', async () => {
    it('should throw an error when no user is logged in', () => {
      CurrentUserManager.remove(app);
      const target = new UserObject(null, '');
      return Status.sendToUser(target, {}).should.rejected();
    });

    it('should send POST requests to /statuses', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      const target = new UserObject(null, '');
      adapters.responses.push({ body: { objectId: 'test-status-id' } });
      await Status.sendToUser(owner, target, {});
      const req = adapters.requests.pop();
      req.method.should.eql('POST');
      req.url.should.endWith('/statuses');
    });

    it('should add "source" to the status data', async () => {
      const owner = new AuthedUser(app, 'owner-id');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      const target = new UserObject(null, '');
      adapters.responses.push({ body: { objectId: 'test-status-id' } });
      await Status.sendToUser(owner, target, {});
      const req = adapters.requests.pop();
      req.body.data.source.should.eql(owner.toPointer());
    });

    it('should send to specified user', async () => {
      const owner = new AuthedUser(app, 'owner-id');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      const target = new UserObject(null, 'target-id');
      adapters.responses.push({ body: { objectId: 'test-status-id' } });
      await Status.sendToUser(target, {});
      const req = adapters.requests.pop();
      req.body.query.should.containEql({
        className: '_User',
        where: { objectId: target.objectId },
      });
    });

    it('check options', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      const target = new UserObject(null, 'test-user-2');
      CurrentUserManager.set(owner);
      adapters.responses.push({ body: { objectId: 'test-status-id' } });
      await Status.sendToUser(target, {}, { inboxType: 'test-inbox-type' });
      const req = adapters.requests.pop();
      req.body.inboxType.should.eql('test-inbox-type');
    });
  });

  describe('#deleteInboxStatus', () => {
    it('should throw an error when no user is loggin in', () => {
      CurrentUserManager.remove(app);
      return Status.deleteInboxStatus(123).should.rejected();
    });

    it('should send DELETE request to /subscribe/statuses/inbox', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.deleteInboxStatus(123);
      const req = adapters.requests.pop();
      req.method.should.eql('DELETE');
      req.url.should.endWith('/subscribe/statuses/inbox');
    });

    it('check owner and messageId', async () => {
      const owner = new AuthedUser(app, 'owner-id');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.deleteInboxStatus(123);
      const req = adapters.requests.pop();
      req.query.should.containEql({
        owner: JSON.stringify(owner.toPointer()),
        messageId: '123',
      });
    });

    it('check options', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.deleteInboxStatus(123, { inboxType: 'test-inbox-type' });
      const req = adapters.requests.pop();
      req.query.should.containEql({
        inboxType: 'test-inbox-type',
      });
    });
  });

  describe('#getUnreadCount', () => {
    it('should throw an error when no user is logged in', () => {
      CurrentUserManager.remove(app);
      return Status.getUnreadCount().should.rejected();
    });

    it('should send GET request to /subscribe/statuses/count', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.getUnreadCount();
      const req = adapters.requests.pop();
      req.method.should.eql('GET');
      req.url.should.endWith('/subscribe/statuses/count');
    });

    it('check owner and messageId', async () => {
      const owner = new AuthedUser(app, 'owner-id');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.deleteInboxStatus(123);
      const req = adapters.requests.pop();
      req.query.should.containEql({
        owner: JSON.stringify(owner.toPointer()),
        messageId: '123',
      });
    });

    it('check options', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.deleteInboxStatus(123, { inboxType: 'test-inbox-type' });
      const req = adapters.requests.pop();
      req.query.should.containEql({ inboxType: 'test-inbox-type' });
    });
  });

  describe('#resetUnreadCount', () => {
    it('should throw an error when no user is logged in', () => {
      CurrentUserManager.remove(app);
      return Status.resetUnreadCount().should.rejected();
    });

    it('should send POST request to /subscribe/statuses/resetUnreadCount', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.resetUnreadCount();
      const req = adapters.requests.pop();
      req.method.should.eql('POST');
      req.url.should.endWith('/subscribe/statuses/resetUnreadCount');
    });

    it('check owner', async () => {
      const owner = new AuthedUser(app, 'owner-id');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.resetUnreadCount();
      const req = adapters.requests.pop();
      req.query.owner.should.eql(JSON.stringify(owner.toPointer()));
      req.header['X-LC-Session'].should.eql(owner.sessionToken);
    });

    it('check options', async () => {
      const owner = new AuthedUser(app, '');
      owner.data = { sessionToken: 'test-session-token' };
      CurrentUserManager.set(owner);
      await Status.resetUnreadCount({ inboxType: 'test-inbox-type' });
      const req = adapters.requests.pop();
      req.query.should.containEql({ inboxType: 'test-inbox-type' });
    });
  });
});
