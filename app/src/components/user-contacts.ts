/*
 * The MIT License (MIT)
 * Copyright (c) 2017 Heat Ledger Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * */
@Component({
  selector: 'userContacts',
  styles: [`
    .unread-symbol {
      font-size: 22px;
      color: #ff3301;
      margin: 0 6px -6px 0;
    }
    .p2p-unread-symbol {
      font-size: 22px;
      color: green;
      margin: 0 6px -6px 0;
    }
    @keyframes blinker {
      80% {opacity: 0.5;}
    }
    .channelopened-status-symbol {
      font-size: 22px; 
      color: green; 
      margin: 0 6px 4px 0;
    }
    .roomregistered-status-symbol {
      font-size: 22px; 
      color: grey; 
      margin: 0 6px 4px 0;
    }
  `],
  template: `
    <div layout="column" flex layout-fill>
      <md-list flex layout="column">
        <md-list-item ng-repeat="contact in vm.contacts" aria-label="Entry">
          <!--<div class="truncate-col unread-col left">
            <md-icon md-font-library="material-icons" ng-class="{'has-unread-message': contact.hasUnreadMessage}">fiber_manual_record</md-icon>
          </div>-->
          <span ng-if="contact.hasUnreadMessage" class="unread-symbol">*</span>
          <span ng-if="contact.hasUnreadP2PMessage" class="p2p-unread-symbol">*</span>
          <span ng-if="vm.p2pStatus(contact)=='channelOpened'" class="channelopened-status-symbol">●</span>
          <span ng-if="vm.p2pStatus(contact)=='roomRegistered'" class="roomregistered-status-symbol">●</span>
          <div class="truncate-col account-col left">
            <a href="#/messenger/{{contact.publicKey}}" ng-class="{'active':contact.publicKey==vm.activePublicKey}">{{contact.publicName || contact.account}}</a>
          </div>
        </md-list-item>
      </md-list>
    </div>
  `
})
@Inject('$scope','user','heat','$q','$interval','$timeout','$location','$rootScope','storage', 'P2PMessaging')
class UserContactsComponent {

  public contacts : Array<IHeatMessageContact> = [];
  private refresh: IEventListenerFunction;
  private activePublicKey: string;
  private store: Store;
  private seenP2PMessageTimestampStore: Store;
  private onlineStatuses: Map<string, string> = new Map<string, string>();

  constructor(private $scope: angular.IScope,
              public user: UserService,
              private heat: HeatService,
              private $q: angular.IQService,
              private $timeout: angular.ITimeoutService,
              private $interval: angular.IIntervalService,
              private $location: angular.ILocationService,
              private $rootScope: angular.IRootScopeService,
              storage: StorageService,
              private p2pMessaging: P2PMessaging) {

    this.refresh = utils.debounce(
      () => {
        this.refreshContacts()
      },
    500, true);
    heat.subscriber.unconfirmedTransaction({recipient:user.account}, ()=>{ this.refresh() });

    this.store = storage.namespace('contacts.latestTimestamp', $scope);
    this.store.on(Store.EVENT_PUT, this.refresh);
    this.seenP2PMessageTimestampStore = storage.namespace('contacts.seenP2PMessageTimestamp');
    this.seenP2PMessageTimestampStore.on(Store.EVENT_PUT, this.refresh);

    this.p2pMessaging.p2pContactStore.on(Store.EVENT_PUT, this.refresh);

    if (user.unlocked) {
      this.init();
    }
    else {
      let listener = () => { this.init() };
      user.on(UserService.EVENT_UNLOCKED, listener);
      $scope.$on('$destroy',()=>user.removeListener(UserService.EVENT_UNLOCKED, listener));
    }

    $rootScope.$on('$locationChangeSuccess', () => { this.setActivePublicKey() });
    this.setActivePublicKey();

    //let myRoom = this.p2pMessaging.register();

    this.p2pMessaging.onMessage = (msg, room) => {
      for (let contact of this.contacts) {
        if (this.contactHasUnreadP2PMessage(contact)) {
          this.refreshContacts();
          return;
        }
      }
    };
  }

  getActivePublicKey() {
    var path = this.$location.path().replace(/^\//,'').split('/'), route = path[0], params = path.slice(1);
    return (route == "messenger") ? params[0] : null;
  }

  setActivePublicKey() {
    this.activePublicKey = this.getActivePublicKey();

    if (this.activePublicKey && this.activePublicKey != "0") {
      let room = this.p2pMessaging.enterRoom(this.activePublicKey);
      if (room) {
        if (!room.onOpenDataChannel) {
          room.onOpenDataChannel = peerId => {
            this.refresh();
          };
          room.onCloseDataChannel = peerId => {
            this.refresh();
          };
        }
      }
    }

    if (!this.activePublicKey || this.activePublicKey == "0") {
      if (this.contacts[0] && this.contacts[0].publicKey != "0") {
        this.$location.path(`/messenger/${this.contacts[0].publicKey}`);
      }
    }

    let activeContact = this.contacts.find(contact => contact.publicKey == this.activePublicKey);
    if (activeContact) {
      activeContact["hasUnreadP2PMessage"] = false;
    }
  }

  init() {
    this.refreshContacts();
    // var topic = new TransactionTopicBuilder().account(this.user.account);
    // var observer = this.engine.socket().observe<TransactionObserver>(topic).
    //   add(this.refresh).
    //   remove(this.refresh).
    //   confirm(this.refresh);
    // this.$scope.$on("$destroy",() => { observer.destroy() });
  }

  refreshContacts() {
    this.heat.api.getMessagingContacts(this.user.account, 0, 100).then((contacts) => {
      this.$scope.$evalAsync(() => {
        this.contacts = contacts;

        //merge contacts obtained via p2p messaging
        let keysToRemove = [];
        this.p2pMessaging.p2pContactStore.forEach((key, p2pContact: IHeatMessageContact) => {
          let duplicate = this.contacts.find(contact => contact.publicKey == p2pContact.publicKey);
          if (duplicate) {
            keysToRemove.push(key);
          } else {
            p2pContact['isP2POnlyContact'] = true;
            this.contacts.push(p2pContact);
          }
        });
        keysToRemove.forEach(key => this.p2pMessaging.p2pContactStore.remove(key))

        this.contacts = this.contacts.filter((contact)=> {
          return contact.account != this.user.account;
        }).map((contact) => {
          if (!contact['isP2POnlyContact']) {
            contact['hasUnreadMessage'] = this.contactHasUnreadMessage(contact);
          }
          contact['hasUnreadP2PMessage'] =
            !(this.p2pMessaging.offchainMode && this.activePublicKey == contact.publicKey)
            && this.contactHasUnreadP2PMessage(contact);
          // contact['p2pStatus'] = this.p2pStatus(contact);
          return contact;
        });

        if (!this.getActivePublicKey() || this.getActivePublicKey()=="0") {
          this.setActivePublicKey();
        }
      });
    })
  }

  p2pStatus(contact: IHeatMessageContact) {
    let room = this.p2pMessaging.getOneToOneRoom(contact.publicKey);
    if (room) {
      let peer = room.getPeer(contact.publicKey);
      if (peer && peer.isConnected()) {
        return "channelOpened";
      } else {
        //if (room.state.entered == "entered") { //it is more corerctly, but need the callback like room.onEntered()
        if (room.state.entered != "not") {
          return "roomRegistered";
        }
      }
    }
  }

  contactHasUnreadMessage(contact: IHeatMessageContact): boolean {
    return contact.timestamp > this.store.getNumber(contact.account, 0);
  }

  contactHasUnreadP2PMessage(contact: IHeatMessageContact): boolean {
    let room = this.p2pMessaging.getOneToOneRoom(contact.publicKey);
    if (room) {
      return room.lastIncomingMessageTimestamp > this.seenP2PMessageTimestampStore.getNumber(contact.account, 0);
    }
    return false;
  }

}
