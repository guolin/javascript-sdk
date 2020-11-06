import type { AuthOptions, App, AppRequest } from './app';
import { AuthedUser, CurrentUserManager, UserObject, UserObjectRef } from './user';
import { Query } from './query';
import { assert } from './utils';
import { LCObject } from './object';

type InboxType = 'default' | 'private' | string;

interface StatusOptions extends Omit<AuthOptions, 'sessionToken'> {
  inboxType?: InboxType;
}

export class StatusQuery extends Query {
  private _statusOwner: UserObject | UserObjectRef;
  private _inboxOwner: AuthedUser;
  private _inboxType: InboxType;
  private _sinceId: number;
  private _maxId: number;

  constructor(app: App) {
    super(app, '_Status');
  }

  whereStatusOwner(owner: UserObject | UserObjectRef | string): StatusQuery {
    assert(this._inboxOwner === undefined, 'Cannot query both inboxOwner and statusOwner');
    if (typeof owner === 'string') {
      owner = new UserObjectRef(this.app, owner);
    }
    const query = this._clone();
    query._statusOwner = owner;
    query._condBuilder.whereEqualTo('source', owner);
    return query;
  }

  whereInboxOwner(owner: AuthedUser): StatusQuery {
    assert(this._statusOwner === undefined, 'Cannot query both inboxOwner and statusOwner');
    assert(owner.sessionToken, 'The owner cannot be an unauthorized user');
    const query = this._clone();
    query._inboxOwner = owner;
    return query;
  }

  whereInboxType(type: InboxType): StatusQuery {
    const query = this._clone();
    query._inboxType = type;
    return query;
  }

  whereSinceId(id: number): StatusQuery {
    const query = this._clone();
    query._sinceId = id;
    return query;
  }

  whereMaxId(id: number): StatusQuery {
    const query = this._clone();
    query._maxId = id;
    return query;
  }

  protected _clone(): StatusQuery {
    const query = new StatusQuery(this.app);
    this._fill(query);
    return query;
  }

  protected _fill(query: StatusQuery): void {
    super._fill(query);
    query._statusOwner = this._statusOwner;
    query._inboxOwner = this._inboxOwner;
    query._inboxType = this._inboxType;
    query._sinceId = this._sinceId;
    query._maxId = this._maxId;
  }

  protected _makeRequest(options?: AuthOptions): AppRequest {
    const req = super._makeRequest(options);
    if (this._inboxOwner) {
      assert(this._statusOwner === undefined, 'Cannot query both inboxOwner and statusOwner');
      req.path = '/subscribe/statuses';

      req.options = {
        ...req.options,
        sessionToken: this._inboxOwner.sessionToken,
      };

      req.query.owner = JSON.stringify(this._inboxOwner.toPointer());
      req.query.inboxType = this._inboxType;
      req.query.sinceId = this._sinceId;
      req.query.maxId = this._maxId;
    }
    return req;
  }
}

/**
 * @alias Status
 */
export class StatusClass extends StatusQuery {
  async sendToFollowers(data: Record<string, any>, options?: StatusOptions): Promise<LCObject> {
    const user = await CurrentUserManager.mustGetAsync(this.app);
    const json = await this.app.request({
      method: 'POST',
      path: '/statuses',
      query: { fetchWhenSave: true },
      body: {
        query: {
          className: '_Follower',
          keys: 'follower',
          where: { user: user.toPointer() },
        },
        // The 'source' field is necessary, it used to query send box. The backend will not generate
        // 'source' automatically, so it is your responsibility.
        data: { ...data, source: user.toPointer() },
        inboxType: options?.inboxType,
      },
      options,
    });
    return LCObject.fromJSON(this.app, json, '_Status');
  }

  async sendToUser(
    target: UserObjectRef | string,
    data: Record<string, any>,
    options?: StatusOptions
  ): Promise<LCObject> {
    const user = await CurrentUserManager.mustGetAsync(this.app);
    const targetId = typeof target === 'string' ? target : target.objectId;
    const json = await this.app.request({
      method: 'POST',
      path: '/statuses',
      body: {
        query: {
          className: '_User',
          where: { objectId: targetId },
        },
        // The 'source' field is necessary, it used to query send box. The backend will not generate
        // 'source' automatically, so it is your responsibility.
        data: { ...data, source: user.toPointer() },
        inboxType: options?.inboxType || 'private',
      },
      options,
    });
    return LCObject.fromJSON(this.app, json, '_Status');
  }

  async deleteInboxStatus(messageId: number, options?: StatusOptions): Promise<void> {
    const user = await CurrentUserManager.mustGetAsync(this.app);
    await this.app.request({
      method: 'DELETE',
      path: '/subscribe/statuses/inbox',
      query: {
        owner: JSON.stringify(user.toPointer()),
        inboxType: options?.inboxType,
        messageId,
      },
      options,
    });
  }

  async getUnreadCount(options?: StatusOptions): Promise<{ total: number; unread: number }> {
    const user = await CurrentUserManager.mustGetAsync(this.app);
    return await this.app.request({
      method: 'GET',
      path: '/subscribe/statuses/count',
      query: {
        owner: JSON.stringify(user.toPointer()),
        inboxType: options?.inboxType,
      },
      options,
    });
  }

  async resetUnreadCount(options?: StatusOptions): Promise<void> {
    const user = await CurrentUserManager.mustGetAsync(this.app);
    await this.app.request({
      method: 'POST',
      path: '/subscribe/statuses/resetUnreadCount',
      query: {
        owner: JSON.stringify(user.toPointer()),
        inboxType: options?.inboxType,
      },
      options,
    });
  }
}
