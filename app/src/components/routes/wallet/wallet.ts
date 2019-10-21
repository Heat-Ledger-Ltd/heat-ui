/*
 * The MIT License (MIT)
 * Copyright (c) 2018 Heat Ledger Ltd.
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

class TokenBalance {
  public isTokenBalance = true
  public balance: string
  public visible = false
  constructor(public name: string, public symbol: string, public address: string) { }
}

class CurrencyBalance {
  public isCurrencyBalance = true
  public balance: string
  public inUse = false
  public tokens: Array<TokenBalance> = []
  public visible = false
  walletEntry: WalletEntry
  constructor(public name: string, public symbol: string, public address: string, public secretPhrase: string) { }

  public unlock(noPathChange?: boolean) {
    let user = <UserService>heat.$inject.get('user')
    let $location = <angular.ILocationService>heat.$inject.get('$location')
    let lightwalletService = <LightwalletService>heat.$inject.get('lightwalletService')
    let bip44Compatible = lightwalletService.validSeed(this.secretPhrase)

    /* Create the ICurrency based on the currency type */
    let currency: ICurrency = null
    if (this.name == 'Ethereum') {
      currency = new ETHCurrency(this.walletEntry.secretPhrase, this.secretPhrase, this.address)
    }
    else if (this.name == 'Bitcoin') {
      currency = new BTCCurrency(this.walletEntry.secretPhrase, this.secretPhrase, this.address)
    }
    else if (this.name == 'FIMK') {
      currency = new FIMKCurrency(this.walletEntry.secretPhrase, this.secretPhrase, this.address)
    }
    else if (this.name == 'NXT') {
      currency = new NXTCurrency(this.walletEntry.secretPhrase, this.secretPhrase, this.address)
    }
    else if (this.name == 'Iota') {
      currency = new IOTACurrency(this.walletEntry.secretPhrase, this.secretPhrase, this.address)
    }
    else if (this.name == 'ARDOR') {
      currency = new ARDRCurrency(this.walletEntry.secretPhrase, this.secretPhrase, this.address)
    }
    else if (this.name == 'Litecoin') {
      currency = new LTCCurrency(this.walletEntry.secretPhrase, this.secretPhrase, this.address)
    }
    else if (this.name == 'BitcoinCash') {
      currency = new BCHCurrency(this.walletEntry.secretPhrase, this.secretPhrase, this.address)
    }
    else {
      currency = new HEATCurrency(
        this.walletEntry ? this.walletEntry.secretPhrase : this.secretPhrase,
        this.secretPhrase,
        this.address
      )
    }
    user.unlock(this.secretPhrase, null, bip44Compatible, currency).then(
      () => {
        if (!noPathChange) {
          $location.path(currency.homePath)
          heat.fullApplicationScopeReload()
        }
      }
    )
  }
}

class CurrencyAddressLoading {
  public isCurrencyAddressLoading = true
  public visible = false
  public wallet: WalletType
  constructor(public name: string) { }
}

class CurrencyAddressCreate {
  public isCurrencyAddressCreate = true
  public visible = false
  public hidden = true
  public parent: WalletEntry
  public flatten: () => void
  constructor(public name: string, public wallet: WalletType) { }

  private getStore() {
    let storage = <StorageService>heat.$inject.get('storage')
    let $rootScope = heat.$inject.get('$rootScope');
    return storage.namespace('wallet', $rootScope, true)
  }

  private getCurrencies(account: string) {
    let currencies = this.getStore().get(account)
    if (!currencies)
      currencies = []
    return currencies;
  }
  private distinctValues = (value, index, self) => {
    return self.indexOf(value) === index;
  }
  private addCurrency(account: string, currency: string) {
    let store = this.getStore()
    let currencies = this.getCurrencies(account)
    currencies.push(currency)
    store.put(account, currencies.filter(this.distinctValues));
  }
  /* Handler for creating a new address, this method is declared here (on the node so to say)
    still after an architectural change where we dont display the CREATE node anymore.
    We'll be leaving it in place where all you need to do is set this.hidden=false to
    have it displayed again. */
  createAddress(component: WalletComponent) {

    // collect all CurrencyBalance of 'our' same currency type
    let currencyBalances = this.parent.currencies.filter(c => c['isCurrencyBalance'] && c.name == this.name)

    // if there is no address in use yet we use the first one
    if (currencyBalances.length == 0) {
      let nextAddress = this.wallet.addresses[0]
      let newCurrencyBalance = new CurrencyBalance('Ethereum', 'ETH', nextAddress.address, nextAddress.privateKey)
      newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
      component.rememberAdressCreated(this.parent.account, nextAddress.address)
      newCurrencyBalance.visible = this.parent.expanded
      this.flatten()
      this.addCurrency(this.parent.account, 'ETH')
      return true
    }

    // determine the first 'nxt' address based of the last currencyBalance displayed
    let lastAddress = currencyBalances[currencyBalances.length - 1]['address']

    // when the last address is not yet used it should be used FIRST before we allow the creation of a new address
    if (!currencyBalances[currencyBalances.length - 1]['inUse']) {
      return false
    }

    // look up the following address
    for (let i = 0; i < this.wallet.addresses.length; i++) {

      // we've found the address
      if (this.wallet.addresses[i].address == lastAddress) {

        // next address is the one - but if no more addresses we exit since not possible
        if (i == this.wallet.addresses.length - 1)
          return

        let nextAddress = this.wallet.addresses[i + 1]
        let newCurrencyBalance = new CurrencyBalance('Ethereum', 'ETH', nextAddress.address, nextAddress.privateKey)
        newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
        component.rememberAdressCreated(this.parent.account, nextAddress.address)
        newCurrencyBalance.visible = this.parent.expanded
        let index = this.parent.currencies.indexOf(currencyBalances[currencyBalances.length - 1]) + 1
        this.parent.currencies.splice(index, 0, newCurrencyBalance)
        this.flatten()
        this.addCurrency(this.parent.account, 'ETH')
        return true
      }
    }

    return false
  }

  createBtcAddress(component: WalletComponent) {

    // collect all CurrencyBalance of 'our' same currency type
    let currencyBalances = this.parent.currencies.filter(c => c['isCurrencyBalance'] && c.name == this.name)

    // if there is no address in use yet we use the first one
    if (currencyBalances.length == 0) {
      let nextAddress = this.wallet.addresses[0]
      let newCurrencyBalance = new CurrencyBalance('Bitcoin', 'BTC', nextAddress.address, nextAddress.privateKey)
      newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
      component.rememberAdressCreated(this.parent.account, nextAddress.address)
      newCurrencyBalance.visible = this.parent.expanded
      this.flatten()
      this.addCurrency(this.parent.account, 'BTC')
      return true
    }

    // determine the first 'nxt' address based of the last currencyBalance displayed
    let lastAddress = currencyBalances[currencyBalances.length - 1]['address']

    // when the last address is not yet used it should be used FIRST before we allow the creation of a new address
    if (!currencyBalances[currencyBalances.length - 1]['inUse']) {
      return false
    }

    // look up the following address
    for (let i = 0; i < this.wallet.addresses.length; i++) {

      // we've found the address
      if (this.wallet.addresses[i].address == lastAddress) {

        // next address is the one - but if no more addresses we exit since not possible
        if (i == this.wallet.addresses.length - 1)
          return

        let nextAddress = this.wallet.addresses[i + 1]
        let newCurrencyBalance = new CurrencyBalance('Bitcoin', 'BTC', nextAddress.address, nextAddress.privateKey)
        newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
        component.rememberAdressCreated(this.parent.account, nextAddress.address)
        newCurrencyBalance.visible = this.parent.expanded
        let index = this.parent.currencies.indexOf(currencyBalances[currencyBalances.length - 1]) + 1
        this.parent.currencies.splice(index, 0, newCurrencyBalance)
        this.flatten()
        this.addCurrency(this.parent.account, 'BTC')
        return true
      }
    }

    return false
  }

  createFIMKAddress(component: WalletComponent) {

    // collect all CurrencyBalance of 'our' same currency type
    let currencyBalances = this.parent.currencies.filter(c => c['isCurrencyBalance'] && c.name == this.name)

    // if there is no address in use yet we use the first one
    if (currencyBalances.length == 0) {
      let nextAddress = this.wallet.addresses[0]
      let newCurrencyBalance = new CurrencyBalance('FIMK', 'FIM', nextAddress.address, nextAddress.privateKey)
      newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
      component.rememberAdressCreated(this.parent.account, nextAddress.address)
      newCurrencyBalance.visible = this.parent.expanded
      this.flatten()
      this.addCurrency(this.parent.account, 'FIM')
      return true
    }

    return false
  }

  createNXTAddress(component: WalletComponent) {
    let currencyBalances = this.parent.currencies.filter(c => c['isCurrencyBalance'] && c.name == this.name)
    if (currencyBalances.length == 0) {
      let nextAddress = this.wallet.addresses[0]
      let newCurrencyBalance = new CurrencyBalance('NXT', 'NXT', nextAddress.address, nextAddress.privateKey)
      newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
      component.rememberAdressCreated(this.parent.account, nextAddress.address)
      newCurrencyBalance.visible = this.parent.expanded
      this.flatten()
      this.addCurrency(this.parent.account, 'NXT')
      return true
    }
    return false
  }

  createARDRAddress(component: WalletComponent) {
    let currencyBalances = this.parent.currencies.filter(c => c['isCurrencyBalance'] && c.name == this.name)
    if (currencyBalances.length == 0) {
      let nextAddress = this.wallet.addresses[0]
      let newCurrencyBalance = new CurrencyBalance('ARDOR', 'ARDR', nextAddress.address, nextAddress.privateKey)
      newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
      component.rememberAdressCreated(this.parent.account, nextAddress.address)
      newCurrencyBalance.visible = this.parent.expanded
      this.flatten()
      this.addCurrency(this.parent.account, 'ARDR')
      return true
    }
    return false
  }

  createLtcAddress(component: WalletComponent) {
    // collect all CurrencyBalance of 'our' same currency type
    let currencyBalances = this.parent.currencies.filter(c => c['isCurrencyBalance'] && c.name == this.name)

    // if there is no address in use yet we use the first one
    if (currencyBalances.length == 0) {
      let nextAddress = this.wallet.addresses[0]
      let newCurrencyBalance = new CurrencyBalance('Litecoin', 'LTC', nextAddress.address, nextAddress.privateKey)
      newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
      component.rememberAdressCreated(this.parent.account, nextAddress.address)
      newCurrencyBalance.visible = this.parent.expanded
      this.flatten()
      this.addCurrency(this.parent.account, 'LTC')
      return true
    }

    // determine the first 'nxt' address based of the last currencyBalance displayed
    let lastAddress = currencyBalances[currencyBalances.length - 1]['address']

    // when the last address is not yet used it should be used FIRST before we allow the creation of a new address
    if (!currencyBalances[currencyBalances.length - 1]['inUse']) {
      return false
    }

    // look up the following address
    for (let i = 0; i < this.wallet.addresses.length; i++) {

      // we've found the address
      if (this.wallet.addresses[i].address == lastAddress) {

        // next address is the one - but if no more addresses we exit since not possible
        if (i == this.wallet.addresses.length - 1)
          return

        let nextAddress = this.wallet.addresses[i + 1]
        let newCurrencyBalance = new CurrencyBalance('Litecoin', 'LTC', nextAddress.address, nextAddress.privateKey)
        newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
        component.rememberAdressCreated(this.parent.account, nextAddress.address)
        newCurrencyBalance.visible = this.parent.expanded
        let index = this.parent.currencies.indexOf(currencyBalances[currencyBalances.length - 1]) + 1
        this.parent.currencies.splice(index, 0, newCurrencyBalance)
        this.flatten()
        this.addCurrency(this.parent.account, 'LTC')
        return true
      }
    }

    return false
  }

  createBchAddress(component: WalletComponent) {

    // collect all CurrencyBalance of 'our' same currency type
    let currencyBalances = this.parent.currencies.filter(c => c['isCurrencyBalance'] && c.name == this.name)

    // if there is no address in use yet we use the first one
    if (currencyBalances.length == 0) {
      let nextAddress = this.wallet.addresses[0]
      let newCurrencyBalance = new CurrencyBalance('BitcoinCash', 'BCH', nextAddress.address, nextAddress.privateKey)
      newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
      component.rememberAdressCreated(this.parent.account, nextAddress.address.split(":")[1])
      newCurrencyBalance.visible = this.parent.expanded
      this.parent.currencies.push(newCurrencyBalance)
      this.flatten()
      return true
    }

    // determine the first 'nxt' address based of the last currencyBalance displayed
    let lastAddress = currencyBalances[currencyBalances.length - 1]['address']

    // when the last address is not yet used it should be used FIRST before we allow the creation of a new address
    if (!currencyBalances[currencyBalances.length - 1]['inUse']) {
      return false
    }

    // look up the following address
    for (let i = 0; i < this.wallet.addresses.length; i++) {

      // we've found the address
      if (this.wallet.addresses[i].address == lastAddress) {

        // next address is the one - but if no more addresses we exit since not possible
        if (i == this.wallet.addresses.length - 1)
          return

        let nextAddress = this.wallet.addresses[i + 1]
        let newCurrencyBalance = new CurrencyBalance('BitcoinCash', 'BCH', nextAddress.address, nextAddress.privateKey)
        newCurrencyBalance.walletEntry = component.walletEntries.find(c => c.account == this.parent.account)
        component.rememberAdressCreated(this.parent.account, nextAddress.address.split(":")[1])
        newCurrencyBalance.visible = this.parent.expanded
        let index = this.parent.currencies.indexOf(currencyBalances[currencyBalances.length - 1]) + 1
        this.parent.currencies.splice(index, 0, newCurrencyBalance)
        this.flatten()
        return true
      }
    }

    return false
  }
}

class WalletEntry {
  public isWalletEntry = true
  public selected = true
  public identifier: string
  public secretPhrase: string
  public bip44Compatible: boolean
  public currencies: Array<CurrencyBalance | CurrencyAddressCreate | CurrencyAddressLoading> = []
  public pin: string
  public unlocked = false
  public visible = true
  public expanded = false
  public btcWalletAddressIndex = 0
  constructor(public account: string, public name: string, public component: WalletComponent) {
    this.identifier = name ? `${name} | ${account}` : account
  }

  public toggle(forceVisible?: boolean) {
    this.expanded = forceVisible || !this.expanded
    this.currencies.forEach(curr => {
      let currency = <any>curr
      currency.visible = this.expanded
      if (currency.tokens) {
        currency.tokens.forEach(token => {
          token.visible = this.expanded
        })
      }
    })
    if (this.expanded) {
      this.component.loadEthereumAddresses(this);
      this.component.loadBitcoinAddresses(this);
      this.component.loadFIMKAddresses(this);
      this.component.loadNXTAddresses(this);
      this.component.loadARDORAddresses(this);
      this.component.loadIotaAddresses(this);
      this.component.loadLtcAddresses(this);
      this.component.loadBitcoinCashAddresses(this)
    }
  }

  showSecretPhrase() {
    let panel: PanelService = heat.$inject.get('panel')
    panel.show(`
      <div layout="column" flex class="toolbar-copy-passphrase">
        <md-input-container flex>
          <textarea rows="2" flex ng-bind="vm.secretPhrase" readonly ng-trim="false"></textarea>
        </md-input-container>
      </div>
    `, {
        secretPhrase: this.secretPhrase
      })
  }

}

@RouteConfig('/wallet')
@Component({
  selector: 'wallet',
  template: `
   <!--  layout-align="start center" -->
    <div layout="column"  flex layout-padding>
      <div layout="row">

        <!-- Open File input is hidden -->
        <md-button class="md-primary md-raised">
          <md-tooltip md-direction="bottom">Open wallet file, adds all contents</md-tooltip>
          <label for="walet-input-file">
            Import File
          </label>
        </md-button>
        <input type="file" onchange="angular.element(this).scope().vm.pageAddFileInputChange(this.files)" class="ng-hide" id="walet-input-file">

        <!-- Adds a wallet seed (heat secret phrase or bip44 eth/btc seed) -->
        <md-button class="md-primary md-raised" ng-click="vm.importSeed()" aria-label="Import Seed">
          <md-tooltip md-direction="bottom">Import Seed</md-tooltip>
          Import Seed/Private Key
        </md-button>

        <!-- Export Wallet to File -->
        <md-button class="md-warn md-raised" ng-click="vm.exportWallet()" aria-label="Export Wallet" ng-if="!vm.allLocked">
          <md-tooltip md-direction="bottom">Export Wallet File</md-tooltip>
          Export Wallet File
        </md-button>

        <md-select class="wallet-dropdown md-warn md-raised" placeholder="Create Address" ng-change="vm.createAccount($event)" ng-model="vm.selectedChain">
          <md-option style="height: 30px;"ng-repeat="entry in vm.chains" value="{{entry.name}}" ng-disabled="{{entry.disabled}}">{{entry.name}}</md-option>
        </md-select>
      </div>

      <div layout="column" layout-fill  flex>
        <div layout-fill layout="column" class="wallet-entries" flex>

          <!-- Build a wallet structure that contains ::
                - wallet entries
                - per entry currency balances
                - per currency token balances  -->

          <md-list layout-fill layout="column" flex>
            <md-list-item ng-repeat="entry in vm.entries" ng-if="entry.visible && !entry.hidden">

              <!-- Wallet entry -->
              <div ng-if="entry.isWalletEntry" layout="row" class="wallet-entry" flex>
                <!--
                <md-checkbox ng-model="entry.selected">
                  <md-tooltip md-direction="bottom">
                    Check this to include in wallet export
                  </md-tooltip>
                </md-checkbox>
                -->
                <md-button class="md-icon-button left" ng-click="entry.toggle()">
                  <md-icon md-font-library="material-icons">{{entry.expanded?'expand_less':'expand_more'}}</md-icon>
                </md-button>

                <div flex ng-if="entry.secretPhrase" class="identifier"><a ng-click="entry.toggle()">{{entry.identifier}}</a></div>
                <div flex ng-if="!entry.secretPhrase" class="identifier">{{entry.identifier}}</div>
                <md-button ng-if="!entry.unlocked" ng-click="vm.unlock($event, entry)">Sign in</md-button>

                <md-menu md-position-mode="target-right target" md-offset="34px 34px" ng-if="entry.unlocked">
                  <md-button aria-label="user menu" class="md-icon-button right" ng-click="$mdOpenMenu($event)" md-menu-origin >
                    <md-icon md-font-library="material-icons">more_horiz</md-icon>
                  </md-button>
                  <md-menu-content width="4">
                    <md-menu-item>
                      <md-button aria-label="explorer" ng-click="entry.showSecretPhrase()">
                        <md-icon md-font-library="material-icons">file_copy</md-icon>
                        Show private key
                      </md-button>
                    </md-menu-item>
                    <md-menu-item>
                      <md-button aria-label="explorer" ng-click="vm.remove($event, entry)">
                        <md-icon md-font-library="material-icons">delete_forever</md-icon>
                        Remove
                      </md-button>
                    </md-menu-item>
                  </md-menu-content>
                </md-menu>
              </div>

              <!-- Currency Balance -->
              <div ng-if="entry.isCurrencyBalance" layout="row" class="currency-balance" flex>
                <div class="name">{{entry.name}}</div>&nbsp;
                <div class="identifier" flex><a ng-click="entry.unlock()">{{entry.address}}</a></div>&nbsp;
                <div class="balance">{{entry.balance}}&nbsp;{{entry.symbol}}</div>
              </div>

              <!-- Currency Address Loading -->
              <div ng-if="entry.isCurrencyAddressLoading" layout="row" class="currency-balance" flex>
                <div class="name">{{entry.name}}</div>&nbsp;
                <div class="identifier" flex>Loading ..</div>
              </div>

              <!-- Currency Address Create -->
              <div ng-if="entry.isCurrencyAddressCreate" layout="row" class="currency-balance" flex>
                <div class="name">{{entry.name}}</div>&nbsp;
                <div class="identifier" flex></div>
                <md-button ng-click="entry.createAddress()">Create New</md-button>
              </div>

              <!-- Token Balance -->
              <div ng-if="entry.isTokenBalance" layout="row" class="token-balance" flex>
                <div class="name">{{entry.name}}</div>&nbsp;
                <div class="identifier" flex>{{entry.address}}</div>&nbsp;
                <div class="balance">{{entry.balance}}&nbsp;{{entry.symbol}}</div>
              </div>

            </md-list-item>
          </md-list>
        </div>
      </div>
    </div>
  `
})
@Inject('$scope', '$q', 'localKeyStore', 'walletFile', '$window', 'lightwalletService', 'heat', 'assetInfo', 'ethplorer', '$mdToast', '$mdDialog', 'clipboard', 'user', 'bitcoreService', 'fimkCryptoService', 'nxtCryptoService', 'ardorCryptoService', 'ltcCryptoService', 'bchCryptoService', 'nxtBlockExplorerService', 'ardorBlockExplorerService', 'mofoSocketService', 'iotaCoreService', 'storage', '$rootScope')
class WalletComponent {
  selectAll = true;
  allLocked = true

  entries: Array<WalletEntry | CurrencyBalance | TokenBalance> = []
  walletEntries: Array<WalletEntry> = []
  createdAddresses: { [key: string]: Array<string> } = {}
  chains = [{ name: 'HEAT', disabled: false }, { name: 'ETH', disabled: false }, { name: 'BTC', disabled: false }, { name: 'FIMK', disabled: false }, { name: 'NXT', disabled: true }, { name: 'ARDR', disabled: true }, { name: 'IOTA', disabled: false }, { name: 'LTC', disabled: false }, { name: 'BCH', disabled: false }];
  selectedChain = '';
  store: any;

  constructor(private $scope: angular.IScope,
    private $q: angular.IQService,
    private localKeyStore: LocalKeyStoreService,
    private walletFile: WalletFileService,
    private $window: angular.IWindowService,
    private lightwalletService: LightwalletService,
    private heat: HeatService,
    private assetInfo: AssetInfoService,
    private ethplorer: EthplorerService,
    private $mdToast: angular.material.IToastService,
    private $mdDialog: angular.material.IDialogService,
    private clipboard: ClipboardService,
    private user: UserService,
    private bitcoreService: BitcoreService,
    private fimkCryptoService: FIMKCryptoService,
    private nxtCryptoService: NXTCryptoService,
    private ardorCryptoService: ARDORCryptoService,
    private ltcCryptoService: LTCCryptoService,
    private bchCryptoService: BCHCryptoService,
    private nxtBlockExplorerService: NxtBlockExplorerService,
    private ardorBlockExplorerService: ArdorBlockExplorerService,
    private mofoSocketService: MofoSocketService,
    private iotaCoreService: IotaCoreService,
    private storage: StorageService,
    private $rootScope: angular.IScope) {
    this.store = this.storage.namespace('wallet', $rootScope, true)
    nxtBlockExplorerService.getBlockchainStatus().then(() => {
      let nxtChain = { name: 'NXT', disabled: false }
      let index = this.chains.findIndex((entry) => entry.name === nxtChain.name);
      this.chains[index] = nxtChain
    })

    ardorBlockExplorerService.getBlockchainStatus().then(() => {
      let ardorChain = { name: 'ARDR', disabled: false }
      let index = this.chains.findIndex((entry) => entry.name === ardorChain.name);
      this.chains[index] = ardorChain
    })

    this.initLocalKeyStore()
    this.initCreatedAddresses()
  }

  createAccount($event) {
    if (this.$scope['vm'].selectedChain === 'ETH') {
      this.createEthAccount($event)
    } else if (this.$scope['vm'].selectedChain === 'BTC') {
      this.createBtcAccount($event)
    }
    else if (this.$scope['vm'].selectedChain === 'FIMK') {
      this.createFIMKAccount($event)
    }
    else if (this.$scope['vm'].selectedChain === 'NXT') {
      this.createNXTAccount($event)
    }
    else if (this.$scope['vm'].selectedChain === 'ARDR') {
      this.createARDRAccount($event)
    }
    else if (this.$scope['vm'].selectedChain === 'IOTA') {
      this.createIotaAccount($event)
    }
    else if (this.$scope['vm'].selectedChain === 'LTC') {
      this.createLtcAccount($event)
    }
    else if (this.$scope['vm'].selectedChain === 'BCH') {
      this.createBCHAccount($event)
    }
    else if (this.$scope['vm'].selectedChain === 'HEAT') {
      this.createHEATAccount($event)
    }
    this.$scope['vm'].selectedChain = null
  }

  initLocalKeyStore() {
    this.entries = []
    this.walletEntries = []
    this.localKeyStore.list().map((account: string) => {
      let name = this.localKeyStore.keyName(account)
      let walletEntry = new WalletEntry(account, name, this)
      this.walletEntries.push(walletEntry)
    });
    this.walletEntries.forEach(walletEntry => {
      let password = this.localKeyStore.getPasswordForAccount(walletEntry.account)
      if (password) {
        try {
          var key = this.localKeyStore.load(walletEntry.account, password);
          if (key) {
            walletEntry.secretPhrase = key.secretPhrase
            walletEntry.bip44Compatible = this.lightwalletService.validSeed(key.secretPhrase)
            walletEntry.unlocked = true
            walletEntry.pin = password
            this.initWalletEntry(walletEntry)
          }
        } catch (e) { console.log(e) }
      }
    })
    this.flatten()
    this.fetchCryptoAddresses('BTC')
  }

  initCreatedAddresses() {
    for (let i = 0; i < window.localStorage.length; i++) {
      let key = window.localStorage.key(i)
      let data = key.match(/eth-address-created:(.+):(.+)/)
      if (data) {
        let acc = data[1], addr = data[2]
        this.createdAddresses[acc] = this.createdAddresses[acc] || []
        this.createdAddresses[acc].push(addr)
      }
    }
  }

  rememberAdressCreated(account: string, ethAddress: string) {
    this.createdAddresses[account] = this.createdAddresses[account] || []
    this.createdAddresses[account].push(ethAddress)
    window.localStorage.setItem(`eth-address-created:${account}:${ethAddress}`, "1")
  }

  /* Iterates down all children of walletEntries and flattens them into the entries list */
  flatten() {
    this.$scope.$evalAsync(() => {
      this.entries = []
      this.walletEntries.forEach(walletEntry => {
        this.entries.push(walletEntry)
        walletEntry.currencies = walletEntry.currencies.filter((currency, index, self) => {
          //For currencyAddressCreate and currencyAddressLoading obj
          if (!currency.hasOwnProperty('address') && (currency.hasOwnProperty('isCurrencyAddressCreate') || currency.hasOwnProperty('isCurrencyAddressLoading'))) {
            return true
          }

          //For currencyBalance obj
          return index === self.findIndex((t) => (
            //@ts-ignore
            t.name === currency.name && t.address === currency.address
          ))
        });
        walletEntry.currencies.forEach(curr => {
          let currencyBalance = <CurrencyBalance>curr
          this.entries.push(currencyBalance)
          if (currencyBalance.tokens) {
            currencyBalance.tokens.forEach(tokenBalance => {
              this.entries.push(tokenBalance)
            })
          }
        })
      })
    })
  }

  shareCurrencyAddressesWithP2pContacts(currency: string, address: string) {
    let p2pContactsUtils = <P2pContactUtils>heat.$inject.get('p2pContactUtils')
    let p2pMessaging = <P2PMessaging>heat.$inject.get('P2PMessaging')
    p2pMessaging.p2pContactStore.forEach((key, contact) => {
      console.log(`sharing key ${address} of currency ${currency} with p2p contact: ${contact.account}`)
      p2pContactsUtils.shareCryptoAddress(contact, currency, address)
    })
  }

  fetchCryptoAddresses(currency: string) {
    let p2pContactsUtils = <P2pContactUtils>heat.$inject.get('p2pContactUtils')
    let p2pMessaging = <P2PMessaging>heat.$inject.get('P2PMessaging')
    p2pMessaging.p2pContactStore.forEach((key, contact) => {
      console.log(`fetching ${currency} of p2p contact: ${contact.account}`)
      p2pContactsUtils.fetchCryptoAddress(contact, currency)
    })
  }

  pageAddAddSecretPhrase($event) {
    this.promptSecretPlusPassword($event).then(
      data => {
        let account = heat.crypto.getAccountId(data.secretPhrase)
        let publicKey = heat.crypto.secretPhraseToPublicKey(data.secretPhrase)
        let key = {
          account: account,
          secretPhrase: data.secretPhrase,
          pincode: data.password,
          name: '',
          publicKey
        };
        this.localKeyStore.add(key);
        this.$scope.$evalAsync(() => {
          this.initLocalKeyStore()
        })
      }
    )
  }

  pageAddFileInputChange(files) {
    if (files && files[0]) {
      let reader = new FileReader();
      reader.onload = () => {
        this.$scope.$evalAsync(() => {
          let fileContents = reader.result;
          let wallet = this.walletFile.createFromText(<string>fileContents);
          if (wallet) {
            let addedKeys = this.localKeyStore.import(wallet);
            this.$scope.$evalAsync(() => {
              this.initLocalKeyStore();
            })
            let message = `Imported ${addedKeys.length} keys into this device`;
            this.$mdToast.show(this.$mdToast.simple().textContent(message).hideDelay(5000));
          }
        })
      };
      reader.readAsText(files[0]);
    }
  }

  remove($event, entry: WalletEntry) {
    dialogs.prompt($event, 'Remove Wallet Entry',
      `This completely removes the wallet entry from your device.
       Please enter your Password (or Pin Code) to confirm you wish to remove this entry`, '').then(
        pin => {
          if (pin == entry.pin) {
            this.localKeyStore.remove(entry.account)
            this.initLocalKeyStore()
            if (entry.account === this.user.account) {
              this.heat.api.getKeystoreEntryCountByAccount(entry.account).then(count => {
                if (count > 0) {
                  this.shareCurrencyAddressesWithP2pContacts('BTC', '')
                }
              })
            }
          } else {
            this.$mdToast.show(this.$mdToast.simple().textContent('Incorrect Password (or Pin Code). Wallet Entry not removed.').hideDelay(5000));
          }
        }
      );
  }

  unlock($event, selectedWalletEntry: WalletEntry) {
    dialogs.prompt($event, 'Enter Password (or Pin)', 'Please enter your Password (or Pin Code) to unlock', '').then(
      pin => {
        let count = 0
        this.walletEntries.forEach(walletEntry => {
          if (!walletEntry.secretPhrase) {
            var key = this.localKeyStore.load(walletEntry.account, pin);
            if (key) {
              count += 1
              this.localKeyStore.rememberPassword(walletEntry.account, pin)
              walletEntry.pin = pin
              walletEntry.secretPhrase = key.secretPhrase
              walletEntry.bip44Compatible = this.lightwalletService.validSeed(key.secretPhrase)
              walletEntry.unlocked = true
              this.initWalletEntry(walletEntry)
            }
          }
        })
        let message = `Unlocked ${count ? count : 'NO'} entries`
        this.$mdToast.show(this.$mdToast.simple().textContent(message).hideDelay(5000));
        selectedWalletEntry.toggle(true)

        /* Only if no user is signed in currently, will we auto select one signin */
        if (!this.user.unlocked) {
          /* Try and unlock the selected entry */
          if (selectedWalletEntry.unlocked) {
            for (let i = 0; i < selectedWalletEntry.currencies.length; i++) {
              let balance = <CurrencyBalance>selectedWalletEntry.currencies[i]
              if (balance.isCurrencyBalance) {
                balance.unlock(true)
                return
              }
            }
          }

          /* Try and find another CurrencyBalance */
          for (let i = 0; i < this.entries.length; i++) {
            let entry = <WalletEntry>this.entries[i];
            if (entry.unlocked) {
              for (let k = 0; k < entry.currencies.length; k++) {
                let balance = <CurrencyBalance>entry.currencies[k];
                if (balance.isCurrencyBalance) {
                  balance.unlock(true);
                  return
                }
              }
            }
          }

        }

      }
    )
  }

  initWalletEntry(walletEntry: WalletEntry) {
    this.allLocked = false
    let heatAccount = heat.crypto.getAccountIdFromPublicKey(heat.crypto.secretPhraseToPublicKey(walletEntry.secretPhrase))
    let heatCurrencyBalance = new CurrencyBalance('HEAT', 'HEAT', heatAccount, walletEntry.secretPhrase)
    heatCurrencyBalance.visible = walletEntry.expanded
    walletEntry.currencies.push(heatCurrencyBalance)
    this.flatten()

    this.heat.api.getAccountByNumericId(heatAccount).then((account) => {
      this.$scope.$evalAsync(() => {
        let balanceUnconfirmed = utils.formatQNT(account.unconfirmedBalance, 8);
        heatCurrencyBalance.balance = balanceUnconfirmed
      })
      this.getAccountAssets(heatAccount).then((assetInfos) => {
        heatCurrencyBalance.tokens = []
        assetInfos.forEach(assetInfo => {
          let tokenBalance = new TokenBalance(assetInfo.name, assetInfo.symbol, assetInfo.id)
          tokenBalance.balance = utils.formatQNT(assetInfo.userBalance, 8)
          tokenBalance.visible = walletEntry.expanded
          heatCurrencyBalance.tokens.push(tokenBalance)
        })
        this.flatten()
      })
    }, () => {
      this.$scope.$evalAsync(() => {
        heatCurrencyBalance.balance = "Address is unused"
        heatCurrencyBalance.symbol = ''
      })
    });

    /* Bitcoin and Ethereum integration start here */
    let selectedCurrencies = this.store.get(walletEntry.account) || []
    if (selectedCurrencies.indexOf('BTC') > -1)
      this.bitcoreService.unlock(walletEntry.secretPhrase).then(wallet => {
        if (wallet !== undefined) {
          let btcCurrencyAddressLoading = new CurrencyAddressLoading('Bitcoin')
          btcCurrencyAddressLoading.visible = walletEntry.expanded;
          btcCurrencyAddressLoading.wallet = wallet;
          walletEntry.currencies.push(btcCurrencyAddressLoading);

          let btcCurrencyAddressCreate = new CurrencyAddressCreate('Bitcoin', wallet)
          btcCurrencyAddressCreate.visible = walletEntry.expanded
          btcCurrencyAddressCreate.parent = walletEntry
          btcCurrencyAddressCreate.flatten = this.flatten.bind(this)
          walletEntry.currencies.push(btcCurrencyAddressCreate)

          this.flatten()
          if (this.user.account === walletEntry.account)
            this.shareCurrencyAddressesWithP2pContacts('BTC', wallet.addresses[0].address)

          /* Only if this node is expanded will we load the addresses */
          if (walletEntry.expanded) {
            this.loadBitcoinAddresses(walletEntry)
          }
        }
      })
    if (selectedCurrencies.indexOf('ETH') > -1)
      this.lightwalletService.unlock(walletEntry.secretPhrase, "").then(wallet => {

        let ethCurrencyAddressLoading = new CurrencyAddressLoading('Ethereum')
        ethCurrencyAddressLoading.visible = walletEntry.expanded
        ethCurrencyAddressLoading.wallet = wallet
        walletEntry.currencies.push(ethCurrencyAddressLoading)

        let ethCurrencyAddressCreate = new CurrencyAddressCreate('Ethereum', wallet)
        ethCurrencyAddressCreate.visible = walletEntry.expanded
        ethCurrencyAddressCreate.parent = walletEntry
        ethCurrencyAddressCreate.flatten = this.flatten.bind(this)

        walletEntry.currencies.push(ethCurrencyAddressCreate)

        this.flatten()

        /* Only if this node is expanded will we load the addresses */
        if (walletEntry.expanded) {
          this.loadEthereumAddresses(walletEntry)
        }
      })
    if (selectedCurrencies.indexOf('IOTA') > -1) // removing nullity check since iota wallet then it tries to load iota for every mnemonic and throws error along with "plain text seed" on console
      this.iotaCoreService.unlock(walletEntry.secretPhrase).then(wallet => {
        let iotaCurrencyAddressLoading = new CurrencyAddressLoading('Iota')
        iotaCurrencyAddressLoading.visible = walletEntry.expanded
        iotaCurrencyAddressLoading.wallet = wallet
        walletEntry.currencies.push(iotaCurrencyAddressLoading)

        let iotaCurrencyAddressCreate = new CurrencyAddressCreate('Iota', wallet)
        iotaCurrencyAddressCreate.visible = walletEntry.expanded
        iotaCurrencyAddressCreate.parent = walletEntry
        iotaCurrencyAddressCreate.flatten = this.flatten.bind(this)

        walletEntry.currencies.push(iotaCurrencyAddressCreate)

        this.flatten()

        /* Only if this node is expanded will we load the addresses */
        if (walletEntry.expanded) {
          this.loadIotaAddresses(walletEntry)
        }
      })
    if (selectedCurrencies.indexOf('FIM') > -1)
      this.fimkCryptoService.unlock(walletEntry.secretPhrase).then(wallet => {
        this.mofoSocketService.mofoSocket().then(() => {
          let fimkCurrencyAddressLoading = new CurrencyAddressLoading('FIMK')
          fimkCurrencyAddressLoading.visible = walletEntry.expanded
          fimkCurrencyAddressLoading.wallet = wallet
          walletEntry.currencies.push(fimkCurrencyAddressLoading)

          let fimkCurrencyAddressCreate = new CurrencyAddressCreate('FIMK', wallet)
          fimkCurrencyAddressCreate.visible = walletEntry.expanded
          fimkCurrencyAddressCreate.parent = walletEntry
          fimkCurrencyAddressCreate.flatten = this.flatten.bind(this)
          walletEntry.currencies.push(fimkCurrencyAddressCreate)

          this.flatten()

          /* Only if this node is expanded will we load the addresses */
          if (walletEntry.expanded) {
            this.loadFIMKAddresses(walletEntry)
          }
        })
      })
    if (selectedCurrencies.indexOf('NXT') > -1)
      this.nxtCryptoService.unlock(walletEntry.secretPhrase).then(wallet => {
        this.nxtBlockExplorerService.getBlockchainStatus().then(() => {
          let nxtCurrencyAddressLoading = new CurrencyAddressLoading('NXT')
          nxtCurrencyAddressLoading.visible = walletEntry.expanded
          nxtCurrencyAddressLoading.wallet = wallet
          walletEntry.currencies.push(nxtCurrencyAddressLoading)

          let nxtCurrencyAddressCreate = new CurrencyAddressCreate('NXT', wallet)
          nxtCurrencyAddressCreate.visible = walletEntry.expanded
          nxtCurrencyAddressCreate.parent = walletEntry
          nxtCurrencyAddressCreate.flatten = this.flatten.bind(this)
          walletEntry.currencies.push(nxtCurrencyAddressCreate)

          if (walletEntry.expanded) {
            this.loadNXTAddresses(walletEntry)
          }
        })
      })
    if (selectedCurrencies.indexOf('ARDR') > -1)
      this.ardorCryptoService.unlock(walletEntry.secretPhrase).then(wallet => {
        this.ardorBlockExplorerService.getBlockchainStatus().then(() => {
          let ardorCurrencyAddressLoading = new CurrencyAddressLoading('ARDOR')
          ardorCurrencyAddressLoading.visible = walletEntry.expanded
          ardorCurrencyAddressLoading.wallet = wallet
          walletEntry.currencies.push(ardorCurrencyAddressLoading)

          let ardorCurrencyAddressCreate = new CurrencyAddressCreate('ARDOR', wallet)
          ardorCurrencyAddressCreate.visible = walletEntry.expanded
          ardorCurrencyAddressCreate.parent = walletEntry
          ardorCurrencyAddressCreate.flatten = this.flatten.bind(this)
          walletEntry.currencies.push(ardorCurrencyAddressCreate)

          if (walletEntry.expanded) {
            this.loadARDORAddresses(walletEntry)
          }
        })
      })
    if (selectedCurrencies.indexOf('LTC') > -1)
      this.ltcCryptoService.unlock(walletEntry.secretPhrase).then(wallet => {
        if (wallet !== undefined) {
          let ltcCurrencyAddressLoading = new CurrencyAddressLoading('Litecoin')
          ltcCurrencyAddressLoading.visible = walletEntry.expanded;
          ltcCurrencyAddressLoading.wallet = wallet;
          walletEntry.currencies.push(ltcCurrencyAddressLoading);

          let ltcCurrencyAddressCreate = new CurrencyAddressCreate('Litecoin', wallet)
          ltcCurrencyAddressCreate.visible = walletEntry.expanded
          ltcCurrencyAddressCreate.parent = walletEntry
          ltcCurrencyAddressCreate.flatten = this.flatten.bind(this)
          walletEntry.currencies.push(ltcCurrencyAddressCreate)

          this.flatten()

          /* Only if this node is expanded will we load the addresses */
          if (walletEntry.expanded) {
            this.loadLtcAddresses(walletEntry)
          }
        }
      })
    if (selectedCurrencies.indexOf('BCH') > -1)
      this.bchCryptoService.unlock(walletEntry.secretPhrase).then(wallet => {
        if (wallet !== undefined) {
          let bchCurrencyAddressLoading = new CurrencyAddressLoading('BitcoinCash')
          bchCurrencyAddressLoading.visible = walletEntry.expanded;
          bchCurrencyAddressLoading.wallet = wallet;
          walletEntry.currencies.push(bchCurrencyAddressLoading);

          let bchCurrencyAddressCreate = new CurrencyAddressCreate('BitcoinCash', wallet)
          bchCurrencyAddressCreate.visible = walletEntry.expanded
          bchCurrencyAddressCreate.parent = walletEntry
          bchCurrencyAddressCreate.flatten = this.flatten.bind(this)
          walletEntry.currencies.push(bchCurrencyAddressCreate)

          this.flatten()

          /* Only if this node is expanded will we load the addresses */
          if (walletEntry.expanded) {
            this.loadBitcoinCashAddresses(walletEntry)
          }
        }
      })
  }

  public loadNXTAddresses(walletEntry: WalletEntry) {

    /* Find the Loading node, if thats not available we can exit */
    let nxtCurrencyAddressLoading = <CurrencyAddressLoading>walletEntry.currencies.find(c => (<CurrencyAddressLoading>c).isCurrencyAddressLoading && c.name == 'NXT')
    if (!nxtCurrencyAddressLoading)
      return

    this.nxtCryptoService.refreshAdressBalances(nxtCurrencyAddressLoading.wallet).then(() => {

      /* Make sure we exit if no loading node exists */
      if (!walletEntry.currencies.find(c => c['isCurrencyAddressLoading']))
        return

      let index = walletEntry.currencies.indexOf(nxtCurrencyAddressLoading)
      nxtCurrencyAddressLoading.wallet.addresses.forEach(address => {
        let wasCreated = (this.createdAddresses[walletEntry.account] || []).indexOf(address.address) != -1
        if (address.inUse || wasCreated) {
          let nxtCurrencyBalance = new CurrencyBalance('NXT', 'NXT', address.address, address.privateKey)
          nxtCurrencyBalance.balance = address.balance ? address.balance + "" : "0"
          nxtCurrencyBalance.visible = walletEntry.expanded
          nxtCurrencyBalance.inUse = wasCreated ? false : true
          nxtCurrencyBalance.walletEntry = walletEntry
          walletEntry.currencies.splice(index, 0, nxtCurrencyBalance)
          index++;

          if (address.tokensBalances) {
            address.tokensBalances.forEach(balance => {
              let tokenBalance = new TokenBalance(balance.name, balance.symbol, balance.address)
              tokenBalance.balance = utils.commaFormat(balance.balance)
              tokenBalance.visible = walletEntry.expanded
              nxtCurrencyBalance.tokens.push(tokenBalance)
            })
          }
        }
      })

      // we can remove the loading entry
      walletEntry.currencies = walletEntry.currencies.filter(c => c != nxtCurrencyAddressLoading)
      this.flatten()
    })
  }

  public loadARDORAddresses(walletEntry: WalletEntry) {

    /* Find the Loading node, if thats not available we can exit */
    let ardorCurrencyAddressLoading = <CurrencyAddressLoading>walletEntry.currencies.find(c => (<CurrencyAddressLoading>c).isCurrencyAddressLoading && c.name == 'ARDOR')
    if (!ardorCurrencyAddressLoading)
      return

    this.ardorCryptoService.refreshAdressBalances(ardorCurrencyAddressLoading.wallet).then(() => {
      /* Make sure we exit if no loading node exists */
      if (!walletEntry.currencies.find(c => c['isCurrencyAddressLoading']))
        return

      let index = walletEntry.currencies.indexOf(ardorCurrencyAddressLoading)
      ardorCurrencyAddressLoading.wallet.addresses.forEach(address => {
        let wasCreated = (this.createdAddresses[walletEntry.account] || []).indexOf(address.address) != -1
        if (address.inUse || wasCreated) {
          let nxtCurrencyBalance = new CurrencyBalance('ARDOR', 'ARDR', address.address, address.privateKey)
          nxtCurrencyBalance.balance = address.balance ? address.balance + "" : "0"
          nxtCurrencyBalance.visible = walletEntry.expanded
          nxtCurrencyBalance.inUse = wasCreated ? false : true
          nxtCurrencyBalance.walletEntry = walletEntry
          walletEntry.currencies.splice(index, 0, nxtCurrencyBalance)
          index++;

          if (address.tokensBalances) {
            address.tokensBalances.forEach(balance => {
              let tokenBalance = new TokenBalance(balance.name, balance.symbol, balance.address)
              tokenBalance.balance = utils.commaFormat(balance.balance)
              tokenBalance.visible = walletEntry.expanded
              nxtCurrencyBalance.tokens.push(tokenBalance)
            })
          }
        }
      })

      // we can remove the loading entry
      walletEntry.currencies = walletEntry.currencies.filter(c => c != ardorCurrencyAddressLoading)
      this.flatten()
    })
  }

  /* Only when we expand a wallet entry do we lookup its balances */
  public loadFIMKAddresses(walletEntry: WalletEntry) {

    /* Find the Loading node, if thats not available we can exit */
    let fimkCurrencyAddressLoading = <CurrencyAddressLoading>walletEntry.currencies.find(c => (<CurrencyAddressLoading>c).isCurrencyAddressLoading && c.name == 'FIMK')
    if (!fimkCurrencyAddressLoading)
      return

    this.fimkCryptoService.refreshAdressBalances(fimkCurrencyAddressLoading.wallet).then(() => {

      /* Make sure we exit if no loading node exists */
      if (!walletEntry.currencies.find(c => c['isCurrencyAddressLoading']))
        return

      let index = walletEntry.currencies.indexOf(fimkCurrencyAddressLoading)
      fimkCurrencyAddressLoading.wallet.addresses.forEach(address => {
        let wasCreated = (this.createdAddresses[walletEntry.account] || []).indexOf(address.address) != -1
        if (address.inUse || wasCreated) {
          let fimkCurrencyBalance = new CurrencyBalance('FIMK', 'FIM', address.address, address.privateKey)
          fimkCurrencyBalance.balance = address.balance ? address.balance + "" : "0"
          fimkCurrencyBalance.visible = walletEntry.expanded
          fimkCurrencyBalance.inUse = wasCreated ? false : true
          fimkCurrencyBalance.walletEntry = walletEntry
          walletEntry.currencies.splice(index, 0, fimkCurrencyBalance)
          index++;

          if (address.tokensBalances) {
            address.tokensBalances.forEach(balance => {
              let tokenBalance = new TokenBalance(balance.name, balance.symbol, balance.address)
              tokenBalance.balance = utils.commaFormat(balance.balance)
              tokenBalance.visible = walletEntry.expanded
              fimkCurrencyBalance.tokens.push(tokenBalance)
            })
          }
        }
      })

      // we can remove the loading entry
      walletEntry.currencies = walletEntry.currencies.filter(c => c != fimkCurrencyAddressLoading)
      this.flatten()
    })
  }

  /* Only when we expand a wallet entry do we lookup its balances */
  public loadEthereumAddresses(walletEntry: WalletEntry) {

    /* Find the Loading node, if thats not available we can exit */
    let ethCurrencyAddressLoading = <CurrencyAddressLoading>walletEntry.currencies.find(c => (<CurrencyAddressLoading>c).isCurrencyAddressLoading && c.name == 'Ethereum')
    if (!ethCurrencyAddressLoading)
      return

    this.lightwalletService.refreshAdressBalances(ethCurrencyAddressLoading.wallet).then(() => {

      /* Make sure we exit if no loading node exists */
      if (!walletEntry.currencies.find(c => c['isCurrencyAddressLoading']))
        return

      let index = walletEntry.currencies.indexOf(ethCurrencyAddressLoading)
      ethCurrencyAddressLoading.wallet.addresses.forEach(address => {
        let wasCreated = (this.createdAddresses[walletEntry.account] || []).indexOf(address.address) != -1
        if (address.inUse || wasCreated) {
          let ethCurrencyBalance = new CurrencyBalance('Ethereum', 'ETH', address.address, address.privateKey)
          ethCurrencyBalance.balance = Number(address.balance + "").toFixed(18)
          ethCurrencyBalance.visible = walletEntry.expanded
          ethCurrencyBalance.inUse = wasCreated ? false : true
          ethCurrencyBalance.walletEntry = walletEntry
          walletEntry.currencies.splice(index, 0, ethCurrencyBalance)
          index++;

          if (address.tokensBalances) {
            address.tokensBalances.forEach(balance => {
              let tokenBalance = new TokenBalance(balance.name, balance.symbol, balance.address)
              tokenBalance.balance = utils.commaFormat(balance.balance)
              tokenBalance.visible = walletEntry.expanded
              ethCurrencyBalance.tokens.push(tokenBalance)
            })
          }
        }
      })

      // we can remove the loading entry
      walletEntry.currencies = walletEntry.currencies.filter(c => c != ethCurrencyAddressLoading)
      this.flatten()
    })
  }

  public loadIotaAddresses(walletEntry: WalletEntry) {

    /* Find the Loading node, if thats not available we can exit */
    let iotaCurrencyAddressLoading = <CurrencyAddressLoading>walletEntry.currencies.find(c => (<CurrencyAddressLoading>c).isCurrencyAddressLoading && c.name == 'Iota')
    if (!iotaCurrencyAddressLoading)
      return

    this.iotaCoreService.refreshAdressBalances(iotaCurrencyAddressLoading.wallet).then(() => {

      /* Make sure we exit if no loading node exists */
      if (!walletEntry.currencies.find(c => c['isCurrencyAddressLoading']))
        return

      let index = walletEntry.currencies.indexOf(iotaCurrencyAddressLoading)
      iotaCurrencyAddressLoading.wallet.addresses.forEach(address => {
        let wasCreated = (this.createdAddresses[walletEntry.account] || []).indexOf(address.address) != -1
        if (address.inUse || wasCreated) {
          let iotaCurrencyBalance = new CurrencyBalance('Iota', 'i', address.address, address.privateKey)
          iotaCurrencyBalance.balance = Number(address.balance + "").toFixed(0)
          iotaCurrencyBalance.visible = walletEntry.expanded
          iotaCurrencyBalance.inUse = wasCreated ? false : true
          iotaCurrencyBalance.walletEntry = walletEntry
          walletEntry.currencies.splice(index, 0, iotaCurrencyBalance)
          index++;
        }
      })

      // we can remove the loading entry
      walletEntry.currencies = walletEntry.currencies.filter(c => c != iotaCurrencyAddressLoading)
      this.flatten()
    })
  }


  /* Only when we expand a wallet entry do we lookup its balances */
  public loadBitcoinAddresses(walletEntry: WalletEntry) {

    /* Find the Loading node, if thats not available we can exit */
    let btcCurrencyAddressLoading = <CurrencyAddressLoading>walletEntry.currencies.find(c => (<CurrencyAddressLoading>c).isCurrencyAddressLoading && c.name == 'Bitcoin')
    if (!btcCurrencyAddressLoading)
      return

    this.bitcoreService.refreshAdressBalances(btcCurrencyAddressLoading.wallet).then(() => {

      /* Make sure we exit if no loading node exists */
      if (!walletEntry.currencies.find(c => c['isCurrencyAddressLoading']))
        return

      let index = walletEntry.currencies.indexOf(btcCurrencyAddressLoading)
      btcCurrencyAddressLoading.wallet.addresses.forEach(address => {
        let wasCreated = (this.createdAddresses[walletEntry.account] || []).indexOf(address.address) != -1
        if (address.inUse || wasCreated) {
          let btcCurrencyBalance = new CurrencyBalance('Bitcoin', 'BTC', address.address, address.privateKey)
          btcCurrencyBalance.balance = address.balance + ""
          btcCurrencyBalance.visible = walletEntry.expanded
          btcCurrencyBalance.inUse = wasCreated ? false : true
          btcCurrencyBalance.walletEntry = walletEntry
          walletEntry.currencies.splice(index, 0, btcCurrencyBalance)
          index++;
        }
      })

      // we can remove the loading entry
      walletEntry.currencies = walletEntry.currencies.filter(c => c != btcCurrencyAddressLoading)
      this.flatten()
    })
  }

  /* Only when we expand a wallet entry do we lookup its balances */
  public loadBitcoinCashAddresses(walletEntry: WalletEntry) {

    /* Find the Loading node, if thats not available we can exit */
    let bchCurrencyAddressLoading = <CurrencyAddressLoading>walletEntry.currencies.find(c => (<CurrencyAddressLoading>c).isCurrencyAddressLoading && c.name == 'BitcoinCash')
    if (!bchCurrencyAddressLoading)
      return

    this.bchCryptoService.refreshAdressBalances(bchCurrencyAddressLoading.wallet).then(() => {

      /* Make sure we exit if no loading node exists */
      if (!walletEntry.currencies.find(c => c['isCurrencyAddressLoading']))
        return

      let index = walletEntry.currencies.indexOf(bchCurrencyAddressLoading)
      bchCurrencyAddressLoading.wallet.addresses.forEach(address => {
        let wasCreated = (this.createdAddresses[walletEntry.account] || []).indexOf(address.address.split(":")[1]) != -1
        if (address.inUse || wasCreated) {
          let bchCurrencyBalance = new CurrencyBalance('BitcoinCash', 'BCH', address.address, address.privateKey)
          bchCurrencyBalance.balance = address.balance + ""
          bchCurrencyBalance.visible = walletEntry.expanded
          bchCurrencyBalance.inUse = wasCreated ? false : true
          bchCurrencyBalance.walletEntry = walletEntry

          walletEntry.currencies.splice(index, 0, bchCurrencyBalance)
          index++;
        }
      })

      // we can remove the loading entry
      walletEntry.currencies = walletEntry.currencies.filter(c => c != bchCurrencyAddressLoading)
      this.flatten()
    })
  }

  public loadLtcAddresses(walletEntry: WalletEntry) {

    /* Find the Loading node, if thats not available we can exit */
    let ltcCurrencyAddressLoading = <CurrencyAddressLoading>walletEntry.currencies.find(c => (<CurrencyAddressLoading>c).isCurrencyAddressLoading && c.name == 'Litecoin')
    if (!ltcCurrencyAddressLoading)
      return

    this.ltcCryptoService.refreshAdressBalances(ltcCurrencyAddressLoading.wallet).then(() => {

      /* Make sure we exit if no loading node exists */
      if (!walletEntry.currencies.find(c => c['isCurrencyAddressLoading']))
        return

      let index = walletEntry.currencies.indexOf(ltcCurrencyAddressLoading)
      ltcCurrencyAddressLoading.wallet.addresses.forEach(address => {
        let wasCreated = (this.createdAddresses[walletEntry.account] || []).indexOf(address.address) != -1
        if (address.inUse || wasCreated) {
          let ltcCurrencyBalance = new CurrencyBalance('Litecoin', 'LTC', address.address, address.privateKey)
          ltcCurrencyBalance.balance = address.balance + ""
          ltcCurrencyBalance.visible = walletEntry.expanded
          ltcCurrencyBalance.inUse = wasCreated ? false : true
          ltcCurrencyBalance.walletEntry = walletEntry

          walletEntry.currencies.splice(index, 0, ltcCurrencyBalance)
          index++;
        }
      })

      walletEntry.currencies = walletEntry.currencies.filter(c => c != ltcCurrencyAddressLoading)
      this.flatten()
    })
  }

  private getAccountAssets(account: string): angular.IPromise<Array<AssetInfo>> {
    let deferred = this.$q.defer<Array<AssetInfo>>();
    this.heat.api.getAccountBalances(account, "0", 1, 0, 100).then(balances => {
      let assetInfos: Array<AssetInfo> = [];
      let promises = [];
      balances.forEach(balance => {
        if (balance.id != '0') {
          promises.push(
            this.assetInfo.getInfo(balance.id).then(info => {
              assetInfos.push(angular.extend(info, {
                userBalance: balance.virtualBalance
              }))
            })
          );
        }
      });
      if (promises.length > 0) {
        this.$q.all(promises).then(() => {
          assetInfos.sort((a, b) => {
            var textA = a.symbol.toUpperCase();
            var textB = b.symbol.toUpperCase();
            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
          });
          deferred.resolve(assetInfos);
        }, deferred.reject);
      }
      else {
        deferred.resolve([]);
      }
    }, deferred.reject);
    return <angular.IPromise<Array<AssetInfo>>>deferred.promise;
  }

  // @click
  importSeed($event) {
    this.promptSecretPlusPassword($event).then(
      data => {
        let account = heat.crypto.getAccountId(data.secretPhrase)
        let publicKey = heat.crypto.secretPhraseToPublicKey(data.secretPhrase)
        let key = {
          account: account,
          secretPhrase: data.secretPhrase,
          pincode: data.password,
          name: '',
          publicKey
        };
        this.localKeyStore.add(key);
        let message = `Seed was successfully imported under HEAT account ${account}`;
        this.$mdToast.show(this.$mdToast.simple().textContent(message).hideDelay(5000));
        this.user.unlock(data.secretPhrase, key, this.lightwalletService.validSeed(data.secretPhrase)).then(() => heat.fullApplicationScopeReload())
      }
    )
  }

  // @click
  exportWallet() {
    let exported = this.localKeyStore.export();
    let encoded = this.walletFile.encode(exported);
    var blob = new Blob([encoded], { type: "text/plain;charset=utf-8" });
    saveAs(blob, 'heat.wallet');
  }

  promptSecretPlusPassword($event): angular.IPromise<{ password: string, secretPhrase: string }> {
    let self = this
    function DialogController($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }
      $scope['vm'].okButtonClick = function () {
        $mdDialog.hide({
          password: $scope['vm'].data.password1,
          secretPhrase: $scope['vm'].data.secretPhrase,
        })
        importWallet($scope['vm'].data.secretPhrase, $scope['vm'].data.selectedImport)
      }
      $scope['vm'].secretChanged = function () {
        $scope['vm'].data.bip44Compatible = self.lightwalletService.validSeed($scope['vm'].data.secretPhrase)
      }
      $scope['vm'].data = {
        password1: '',
        password2: '',
        secretPhrase: '',
        bip44Compatible: false,
        selectedImport: ''
      }
      $scope['vm'].currencyList = [{ name: 'HEAT', symbol: 'HEAT' }, { name: 'Ethereum', symbol: 'ETH' }, { name: 'Bitcoin', symbol: 'BTC' }, { name: 'FIMK', symbol: 'FIM' }, { name: 'NXT', symbol: 'NXT' }, { name: 'ARDOR', symbol: 'ARDR' }, { name: 'IOTA', symbol: 'IOTA' }, { name: 'Litecoin', symbol: 'LTC' }, { name: 'BitcoinCash', symbol: 'BCH' }];
    }

    function importWallet(secret: string, selectedImport: string) {
      let distinctValues = (value, index, self) => {
        return self.indexOf(value) === index;
      }
      let storage = <StorageService>heat.$inject.get('storage');
      let $rootScope = heat.$inject.get('$rootScope');
      let store = storage.namespace('wallet', $rootScope, true);
      let accountId = heat.crypto.getAccountId(secret)
      let currencies = store.get(accountId)
      if (!currencies)
        currencies = []
      currencies.push(selectedImport)
      store.put(accountId, currencies.filter(distinctValues));
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Import Seed/Private Key</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">
                <p>Select currency to import</p>
                <md-input-container flex>
                  <md-select ng-model="vm.data.selectedImport" placeholder="Select currency" auto-focus>
                    <md-option style="height: 30px;" ng-repeat="entry in vm.currencyList" value="{{entry.symbol}}">{{entry.symbol}}</md-option>
                  </md-select>
                </md-input-container>
                <p>Enter your Secret Seed and provide a Password (or Pin)</p>
                <md-input-container flex>
                  <label>Private key / secret phrase</label>
                  <textarea rows="2" flex ng-model="vm.data.secretPhrase" name="secretPhrase" required ng-trim="false" ng-change="vm.secretChanged() "></textarea>
                </md-input-container>
                <md-input-container flex>
                  <label>Desired Heatwallet PIN / password</label>
                  <input type="password" ng-model="vm.data.password1" required name="password1">
                </md-input-container>
                <md-input-container flex>
                  <label>Desired Heatwallet PIN / password (confirm)</label>
                  <input type="password" ng-model="vm.data.password2" required name="password2">
                </md-input-container>
                <span>BIP44 compatible = <b>{{vm.data.bip44Compatible?'TRUE':'FALSE'}}</b></span>
              </div>
            </md-dialog-content>
            <md-dialog-actions layout="row">
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick()" aria-label="Cancel">Cancel</md-button>
              <md-button type="submit" ng-disabled="dialogForm.$invalid || vm.data.password1 != vm.data.password2 || vm.data.selectedImport === ''" class="md-primary"
                  ng-click="vm.okButtonClick()" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createEthAccount($event) {
    let walletEntries = this.walletEntries
    let self = this
    if (walletEntries.length == 0)
      return

    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].copySeed = function () {
        self.clipboard.copyText(document.getElementById('wallet-secret-textarea')['value'], 'Copied seed to clipboard');
      }

      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }

      $scope['vm'].okButtonClick = function ($event) {
        let walletEntry = $scope['vm'].data.selectedWalletEntry
        if (walletEntry) {
          let walletEntry = $scope['vm'].data.selectedWalletEntry
          let success = false
          if (walletEntry) {
            let node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'Ethereum')
            if (!node) {
              let storage = <StorageService>heat.$inject.get('storage')
              let $rootScope = heat.$inject.get('$rootScope');
              let store = storage.namespace('wallet', $rootScope, true)
              let currencies = store.get(walletEntry.account)
              if (!currencies)
                currencies = []
              currencies.push('ETH')
              store.put(walletEntry.account, currencies.filter((value, index, self) => self.indexOf(value) === index));
              self.initWalletEntry(walletEntry)
            }
            // load in next event loop to load currency addresses first
            setTimeout(() => {
              node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'Ethereum')
              success = node.createAddress(self)
              walletEntry.toggle(true)
              $mdDialog.hide(null).then(() => {
                if (!success) {
                  dialogs.alert($event, 'Unable to Create Address', 'Make sure you use the previous address first before you can create a new address')
                }
              })
            }, 0)
          }
        }
      }

      $scope['vm'].data = {
        selectedWalletEntry: walletEntries[0],
        selected: walletEntries[0].account,
        walletEntries: walletEntries,
        password: ''
      }

      $scope['vm'].selectedWalletEntryChanged = function () {
        $scope['vm'].data.password = ''
        $scope['vm'].data.selectedWalletEntry = walletEntries.find(w => $scope['vm'].data.selected == w.account)
      }

      $scope['vm'].passwordChanged = function () {
        let password = $scope['vm'].data.password
        let account = $scope['vm'].data.selected
        let walletEntry = walletEntries.find(w => w.account == account)
        try {
          var key = self.localKeyStore.load(account, password);
          if (key) {
            self.localKeyStore.rememberPassword(walletEntry.account, password)
            walletEntry.pin = password
            walletEntry.secretPhrase = key.secretPhrase
            walletEntry.bip44Compatible = self.lightwalletService.validSeed(key.secretPhrase)
            walletEntry.unlocked = true
            self.initWalletEntry(walletEntry)
            walletEntry.toggle(true)
          }
        } catch (e) { }
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Create Ethereum Address</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">
                <p>To create a new Ethereum address, please choose the master HEAT account you want to attach the new Ethereum address to:</p>

                <!-- Select Master Account -->

                <md-input-container flex>
                  <md-select ng-model="vm.data.selected" ng-change="vm.selectedWalletEntryChanged()">
                    <md-option ng-repeat="entry in vm.data.walletEntries" value="{{entry.account}}">{{entry.identifier}}</md-option>
                  </md-select>
                </md-input-container>

                <!-- Put In Password -->

                <div flex layout="column" ng-if="vm.data.selectedWalletEntry && !vm.data.selectedWalletEntry.unlocked">
                  <p>
                    Please first unlock this account by entering your password below
                  </p>
                  <md-input-container flex >
                    <label>Password</label>
                    <input ng-model="vm.data.password" ng-change="vm.passwordChanged()">
                  </md-input-container>
                </div>

                <!-- Invalid Non BIP44 Seed-->

                <p ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && !vm.data.selectedWalletEntry.bip44Compatible">
                  Eth wallet cannot be added to that old HEAT account. Please choose another or create a new HEAT account with BIP44 compatible seed.
                </p>

                <!-- Valid BIP44 Seed -->
                <div flex layout="column"
                  ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && vm.data.selectedWalletEntry.bip44Compatible">

                  <p>This is your Ethereum address seed, It’s the same as for your HEAT account {{vm.data.selectedWalletEntry.account}}.
                      Please store it in a safe place or you may lose access to your Ethereum.
                      <a ng-click="vm.copySeed()">Copy Seed</a></p>

                  <md-input-container flex>
                    <textarea id="wallet-secret-textarea" rows="3" flex ng-model="vm.data.selectedWalletEntry.secretPhrase" readonly ng-trim="false"
                        style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
                    <span style="display:none">{{vm.data.selectedWalletEntry.secretPhrase}}</span>
                  </md-input-container>

                </div>
              </div>

            </md-dialog-content>
            <md-dialog-actions layout="row">
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
              <md-button ng-disabled="!vm.data.selectedWalletEntry || !vm.data.selectedWalletEntry.unlocked || !vm.data.selectedWalletEntry.bip44Compatible"
                  class="md-primary" ng-click="vm.okButtonClick($event)" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createBtcAccount($event) {
    let walletEntries = this.walletEntries
    let self = this
    if (walletEntries.length == 0)
      return

    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].copySeed = function () {
        self.clipboard.copyText(document.getElementById('wallet-secret-textarea')['value'], 'Copied seed to clipboard');
      }

      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }

      $scope['vm'].okButtonClick = function ($event) {
        let walletEntry = $scope['vm'].data.selectedWalletEntry
        let success = false
        if (walletEntry) {
          let node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'Bitcoin')
          if (!node) {
            let storage = <StorageService>heat.$inject.get('storage')
            let $rootScope = heat.$inject.get('$rootScope');
            let store = storage.namespace('wallet', $rootScope, true)
            let currencies = store.get(walletEntry.account)
            if (!currencies)
              currencies = []
            currencies.push('BTC')
            store.put(walletEntry.account, currencies.filter((value, index, self) => self.indexOf(value) === index));
            self.initWalletEntry(walletEntry)
          }
          // load in next event loop to load currency addresses first
          setTimeout(() => {
            node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'Bitcoin')
            success = node.createBtcAddress(self)
            walletEntry.toggle(true)
            $mdDialog.hide(null).then(() => {
              if (!success) {
                dialogs.alert($event, 'Unable to Create Address', 'Make sure you use the previous address first before you can create a new address')
              }
            })
          }, 0)
        }
      }

      $scope['vm'].data = {
        selectedWalletEntry: walletEntries[0],
        selected: walletEntries[0].account,
        walletEntries: walletEntries,
        password: ''
      }

      $scope['vm'].selectedWalletEntryChanged = function () {
        $scope['vm'].data.password = ''
        $scope['vm'].data.selectedWalletEntry = walletEntries.find(w => $scope['vm'].data.selected == w.account)
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Create Bitcoin Address</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">
                <p>To create a new Bitcoin address, please choose the master HEAT account you want to attach the new Bitcoin address to:</p>

                <!-- Select Master Account -->

                <md-input-container flex>
                  <md-select ng-model="vm.data.selected" ng-change="vm.selectedWalletEntryChanged()">
                    <md-option ng-repeat="entry in vm.data.walletEntries" value="{{entry.account}}">{{entry.identifier}}</md-option>
                  </md-select>
                </md-input-container>

                <!-- Invalid Non BIP44 Seed-->

                <p ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && !vm.data.selectedWalletEntry.bip44Compatible">
                  Btc wallet cannot be added to that old HEAT account. Please choose another or create a new HEAT account with BIP44 compatible seed.
                </p>

                <!-- Valid BIP44 Seed -->
                <div flex layout="column"
                  ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && vm.data.selectedWalletEntry.bip44Compatible">

                  <p>This is your Bitcoin address seed, It’s the same as for your HEAT account {{vm.data.selectedWalletEntry.account}}.
                      Please store it in a safe place or you may lose access to your Bitcoin.
                      <a ng-click="vm.copySeed()">Copy Seed</a></p>

                  <md-input-container flex>
                    <textarea id="wallet-secret-textarea" rows="3" flex ng-model="vm.data.selectedWalletEntry.secretPhrase" readonly ng-trim="false"
                        style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
                    <span style="display:none">{{vm.data.selectedWalletEntry.secretPhrase}}</span>
                  </md-input-container>

                </div>
              </div>

            </md-dialog-content>
            <md-dialog-actions layout="row">
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
              <md-button ng-disabled="!vm.data.selectedWalletEntry || !vm.data.selectedWalletEntry.unlocked || !vm.data.selectedWalletEntry.bip44Compatible"
                  class="md-primary" ng-click="vm.okButtonClick($event)" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createIotaAccount($event) {
    let walletEntries = this.walletEntries
    let self = this
    if (walletEntries.length == 0)
      return

    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }
      $scope['vm'].okButtonClick = function () {
        $mdDialog.cancel()
      }
      $scope['vm'].generateSeed = function () {
        var length = 81;
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ9";
        var randomValues = new Uint32Array(length);
        var result = new Array(length);
        window.crypto.getRandomValues(randomValues);
        var cursor = 0;
        for (var i = 0; i < randomValues.length; i++) {
          cursor += randomValues[i];
          result[i] = chars[cursor % chars.length];
        }
        $scope['vm'].iotaSeed = result.join('');
      };
      $scope['vm'].generateSeed();
      $scope['vm'].copySeed = function () {
        self.clipboard.copyText(document.getElementById('wallet-secret-textarea')['value'], 'Copied seed to clipboard');
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      /*style: `
        .iota-address {
          line-height: 1.5em;
          height: 3em;
        }`,*/
      template: `
      <md-dialog>
        <form name="dialogForm">
          <md-toolbar>
            <div class="md-toolbar-tools"><h2>Create IOTA Address</h2></div>
          </md-toolbar>
          <md-dialog-content style="min-width:500px;max-width:700px" layout="column" layout-padding>
            <div flex layout="column">
              <p>This is your IOTA address seed.
                Please store it in a safe place or you may lose access to your IOTA.
                <a ng-click="vm.copySeed()">Copy Seed</a>
              </p>
              <p>
                Proceed to <b>IMPORT SEED/ PRIVATE KEY</b> to import this seed to your wallet.
              </p>
              <md-input-container flex>
                <textarea id="wallet-secret-textarea" rows="3" flex ng-model="vm.iotaSeed" readonly ng-trim="false"
                    style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
              </md-input-container>
              <span style="display:none">{{vm.iotaSeed}}</span>
            </div>
          </md-dialog-content>
          <md-dialog-actions>
            <md-button class="md-primary md-raised" ng-click="vm.okButtonClick($event)" aria-label="=Ok">Ok</md-button>
            <md-button class="md-primary md-raised" ng-click="vm.generateSeed($event)" aria-label="Generate New">Generate New</md-button>
            <md-button class="md-warn md-raised" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
          </md-dialog-actions>
        </form>
      </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createFIMKAccount($event) {
    let walletEntries = this.walletEntries
    let self = this
    if (walletEntries.length == 0)
      return

    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].copySeed = function () {
        self.clipboard.copyText(document.getElementById('wallet-secret-textarea')['value'], 'Copied seed to clipboard');
      }

      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }

      $scope['vm'].okButtonClick = function ($event) {
        let walletEntry = $scope['vm'].data.selectedWalletEntry
        let success = false
        if (walletEntry) {
          let node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'FIMK')
          if (!node) {
            let storage = <StorageService>heat.$inject.get('storage')
            let $rootScope = heat.$inject.get('$rootScope');
            let store = storage.namespace('wallet', $rootScope, true)
            let currencies = store.get(walletEntry.account)
            if (!currencies)
              currencies = []
            currencies.push('FIM')
            store.put(walletEntry.account, currencies.filter((value, index, self) => self.indexOf(value) === index));
            self.initWalletEntry(walletEntry)
          }
          // load in next event loop to load currency addresses first
          setTimeout(() => {
            node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'FIMK')
            success = node.createFIMKAddress(self)
            walletEntry.toggle(true)
            $mdDialog.hide(null).then(() => {
              if (!success) {
                dialogs.alert($event, 'Unable to Create Address', 'FIMK address already created for this account')
              }
            })
          }, 0)
        }
      }

      $scope['vm'].data = {
        selectedWalletEntry: walletEntries[0],
        selected: walletEntries[0].account,
        walletEntries: walletEntries,
        password: ''
      }

      $scope['vm'].selectedWalletEntryChanged = function () {
        $scope['vm'].data.password = ''
        $scope['vm'].data.selectedWalletEntry = walletEntries.find(w => $scope['vm'].data.selected == w.account)
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Create FIMK Address</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">
                <p>To create a new FIMK address, please choose the master HEAT account you want to attach the new FIMK address to:</p>

                <!-- Select Master Account -->

                <md-input-container flex>
                  <md-select ng-model="vm.data.selected" ng-change="vm.selectedWalletEntryChanged()">
                    <md-option ng-repeat="entry in vm.data.walletEntries" value="{{entry.account}}">{{entry.identifier}}</md-option>
                  </md-select>
                </md-input-container>

                <!-- Invalid Non BIP44 Seed-->

                <p ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && !vm.data.selectedWalletEntry.bip44Compatible">
                  FIMK wallet cannot be added to that old HEAT account. Please choose another or create a new HEAT account with BIP44 compatible seed.
                </p>

                <!-- Valid BIP44 Seed -->
                <div flex layout="column"
                  ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && vm.data.selectedWalletEntry.bip44Compatible">

                  <p>This is your FIMK address seed, It’s the same as for your HEAT account {{vm.data.selectedWalletEntry.account}}.
                      Please store it in a safe place or you may lose access to your FIMK.
                      <a ng-click="vm.copySeed()">Copy Seed</a></p>

                  <md-input-container flex>
                    <textarea id="wallet-secret-textarea" rows="3" flex ng-model="vm.data.selectedWalletEntry.secretPhrase" readonly ng-trim="false"
                        style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
                    <span style="display:none">{{vm.data.selectedWalletEntry.secretPhrase}}</span>
                  </md-input-container>

                </div>
              </div>

            </md-dialog-content>
            <md-dialog-actions layout="row">
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
              <md-button ng-disabled="!vm.data.selectedWalletEntry || !vm.data.selectedWalletEntry.unlocked || !vm.data.selectedWalletEntry.bip44Compatible"
                  class="md-primary" ng-click="vm.okButtonClick($event)" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createNXTAccount($event) {
    let walletEntries = this.walletEntries
    let self = this
    if (walletEntries.length == 0)
      return

    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].copySeed = function () {
        self.clipboard.copyText(document.getElementById('wallet-secret-textarea')['value'], 'Copied seed to clipboard');
      }

      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }

      $scope['vm'].okButtonClick = function ($event) {
        let walletEntry = $scope['vm'].data.selectedWalletEntry
        let success = false
        if (walletEntry) {
          let node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'NXT')
          if (!node) {
            let storage = <StorageService>heat.$inject.get('storage')
            let $rootScope = heat.$inject.get('$rootScope');
            let store = storage.namespace('wallet', $rootScope, true)
            let currencies = store.get(walletEntry.account)
            if (!currencies)
              currencies = []
            currencies.push('NXT')
            store.put(walletEntry.account, currencies.filter((value, index, self) => self.indexOf(value) === index));
            self.initWalletEntry(walletEntry)
          }
          // load in next event loop to load currency addresses first
          setTimeout(() => {
            node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'NXT')
            success = node.createNXTAddress(self)
            walletEntry.toggle(true)
            $mdDialog.hide(null).then(() => {
              if (!success) {
                dialogs.alert($event, 'Unable to Create Address', 'NXT address already created for this account')
              }
            })
          }, 0)
        }
      }

      $scope['vm'].data = {
        selectedWalletEntry: walletEntries[0],
        selected: walletEntries[0].account,
        walletEntries: walletEntries,
        password: ''
      }

      $scope['vm'].selectedWalletEntryChanged = function () {
        $scope['vm'].data.password = ''
        $scope['vm'].data.selectedWalletEntry = walletEntries.find(w => $scope['vm'].data.selected == w.account)
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Create NXT Address</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">
                <p>To create a new NXT address, please choose the master HEAT account you want to attach the new NXT address to:</p>

                <!-- Select Master Account -->

                <md-input-container flex>
                  <md-select ng-model="vm.data.selected" ng-change="vm.selectedWalletEntryChanged()">
                    <md-option ng-repeat="entry in vm.data.walletEntries" value="{{entry.account}}">{{entry.identifier}}</md-option>
                  </md-select>
                </md-input-container>

                <!-- Invalid Non BIP44 Seed-->

                <p ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && !vm.data.selectedWalletEntry.bip44Compatible">
                  NXT wallet cannot be added to that old HEAT account. Please choose another or create a new HEAT account with BIP44 compatible seed.
                </p>

                <!-- Valid BIP44 Seed -->
                <div flex layout="column"
                  ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && vm.data.selectedWalletEntry.bip44Compatible">

                  <p>This is your NXT address seed, It’s the same as for your HEAT account {{vm.data.selectedWalletEntry.account}}.
                      Please store it in a safe place or you may lose access to your NXT.
                      <a ng-click="vm.copySeed()">Copy Seed</a></p>

                  <md-input-container flex>
                    <textarea id="wallet-secret-textarea" rows="3" flex ng-model="vm.data.selectedWalletEntry.secretPhrase" readonly ng-trim="false"
                        style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
                    <span style="display:none">{{vm.data.selectedWalletEntry.secretPhrase}}</span>
                  </md-input-container>

                </div>
              </div>

            </md-dialog-content>
            <md-dialog-actions layout="row">
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
              <md-button ng-disabled="!vm.data.selectedWalletEntry || !vm.data.selectedWalletEntry.unlocked || !vm.data.selectedWalletEntry.bip44Compatible"
                  class="md-primary" ng-click="vm.okButtonClick($event)" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createARDRAccount($event) {
    let walletEntries = this.walletEntries
    let self = this
    if (walletEntries.length == 0)
      return

    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].copySeed = function () {
        self.clipboard.copyText(document.getElementById('wallet-secret-textarea')['value'], 'Copied seed to clipboard');
      }

      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }

      $scope['vm'].okButtonClick = function ($event) {
        let walletEntry = $scope['vm'].data.selectedWalletEntry
        let success = false
        if (walletEntry) {
          let node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'ARDR')
          if (!node) {
            let storage = <StorageService>heat.$inject.get('storage')
            let $rootScope = heat.$inject.get('$rootScope');
            let store = storage.namespace('wallet', $rootScope, true)
            let currencies = store.get(walletEntry.account)
            if (!currencies)
              currencies = []
            currencies.push('ARDR')
            store.put(walletEntry.account, currencies.filter((value, index, self) => self.indexOf(value) === index));
            self.initWalletEntry(walletEntry)
          }
          // load in next event loop to load currency addresses first
          setTimeout(() => {
            node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'ARDR')
            success = node.createARDRAddress(self)
            walletEntry.toggle(true)
            $mdDialog.hide(null).then(() => {
              if (!success) {
                dialogs.alert($event, 'Unable to Create Address', 'ARDR address already created for this account')
              }
            })
          }, 0)
        }
      }

      $scope['vm'].data = {
        selectedWalletEntry: walletEntries[0],
        selected: walletEntries[0].account,
        walletEntries: walletEntries,
        password: ''
      }

      $scope['vm'].selectedWalletEntryChanged = function () {
        $scope['vm'].data.password = ''
        $scope['vm'].data.selectedWalletEntry = walletEntries.find(w => $scope['vm'].data.selected == w.account)
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Create ARDR Address</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">
                <p>To create a new ARDR address, please choose the master HEAT account you want to attach the new ARDR address to:</p>

                <!-- Select Master Account -->

                <md-input-container flex>
                  <md-select ng-model="vm.data.selected" ng-change="vm.selectedWalletEntryChanged()">
                    <md-option ng-repeat="entry in vm.data.walletEntries" value="{{entry.account}}">{{entry.identifier}}</md-option>
                  </md-select>
                </md-input-container>

                <!-- Invalid Non BIP44 Seed-->

                <p ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && !vm.data.selectedWalletEntry.bip44Compatible">
                  ARDR wallet cannot be added to that old HEAT account. Please choose another or create a new HEAT account with BIP44 compatible seed.
                </p>

                <!-- Valid BIP44 Seed -->
                <div flex layout="column"
                  ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && vm.data.selectedWalletEntry.bip44Compatible">

                  <p>This is your ARDR address seed, It’s the same as for your HEAT account {{vm.data.selectedWalletEntry.account}}.
                      Please store it in a safe place or you may lose access to your ARDR.
                      <a ng-click="vm.copySeed()">Copy Seed</a></p>

                  <md-input-container flex>
                    <textarea id="wallet-secret-textarea" rows="3" flex ng-model="vm.data.selectedWalletEntry.secretPhrase" readonly ng-trim="false"
                        style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
                    <span style="display:none">{{vm.data.selectedWalletEntry.secretPhrase}}</span>
                  </md-input-container>

                </div>
              </div>

            </md-dialog-content>
            <md-dialog-actions layout="row">
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
              <md-button ng-disabled="!vm.data.selectedWalletEntry || !vm.data.selectedWalletEntry.unlocked || !vm.data.selectedWalletEntry.bip44Compatible"
                  class="md-primary" ng-click="vm.okButtonClick($event)" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createLtcAccount($event) {
    let walletEntries = this.walletEntries
    let self = this
    if (walletEntries.length == 0)
      return

    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].copySeed = function () {
        self.clipboard.copyWithUI(document.getElementById('wallet-secret-textarea'), 'Copied seed to clipboard');
      }

      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }

      $scope['vm'].okButtonClick = function ($event) {
        let walletEntry = $scope['vm'].data.selectedWalletEntry
        let success = false
        if (walletEntry) {
          let node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'Litecoin')
          if (!node) {
            let storage = <StorageService>heat.$inject.get('storage')
            let $rootScope = heat.$inject.get('$rootScope');
            let store = storage.namespace('wallet', $rootScope, true)
            let currencies = store.get(walletEntry.account)
            if (!currencies)
              currencies = []
            currencies.push('LTC')
            store.put(walletEntry.account, currencies.filter((value, index, self) => self.indexOf(value) === index));
            self.initWalletEntry(walletEntry)
          }
          // load in next event loop to load currency addresses first
          setTimeout(() => {
            node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'Litecoin')
            success = node.createLtcAddress(self)
            walletEntry.toggle(true)
            $mdDialog.hide(null).then(() => {
              if (!success) {
                dialogs.alert($event, 'Unable to Create Address', 'Make sure you use the previous address first before you can create a new address')
              }
            })
          }, 0)
        }
      }

      $scope['vm'].data = {
        selectedWalletEntry: walletEntries[0],
        selected: walletEntries[0].account,
        walletEntries: walletEntries,
        password: ''
      }

      $scope['vm'].selectedWalletEntryChanged = function () {
        $scope['vm'].data.password = ''
        $scope['vm'].data.selectedWalletEntry = walletEntries.find(w => $scope['vm'].data.selected == w.account)
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Create Litecoin Address</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">
                <p>To create a new Litecoin address, please choose the master HEAT account you want to attach the new Litecoin address to:</p>

                <!-- Select Master Account -->

                <md-input-container flex>
                  <md-select ng-model="vm.data.selected" ng-change="vm.selectedWalletEntryChanged()">
                    <md-option ng-repeat="entry in vm.data.walletEntries" value="{{entry.account}}">{{entry.identifier}}</md-option>
                  </md-select>
                </md-input-container>

                <!-- Invalid Non BIP44 Seed-->

                <p ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && !vm.data.selectedWalletEntry.bip44Compatible">
                  LTC wallet cannot be added to that old HEAT account. Please choose another or create a new HEAT account with BIP44 compatible seed.
                </p>

                <!-- Valid BIP44 Seed -->
                <div flex layout="column"
                  ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && vm.data.selectedWalletEntry.bip44Compatible">

                  <p>This is your Litecoin address seed, It’s the same as for your HEAT account {{vm.data.selectedWalletEntry.account}}.
                      Please store it in a safe place or you may lose access to your Litecoin.
                      <a ng-click="vm.copySeed()">Copy Seed</a></p>

                  <md-input-container flex>
                    <textarea rows="3" flex ng-model="vm.data.selectedWalletEntry.secretPhrase" readonly ng-trim="false"
                        style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
                    <span id="wallet-secret-textarea" style="display:none">{{vm.data.selectedWalletEntry.secretPhrase}}</span>
                  </md-input-container>

                </div>
              </div>

            </md-dialog-content>
            <md-dialog-actions layout="row">
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
              <md-button ng-disabled="!vm.data.selectedWalletEntry || !vm.data.selectedWalletEntry.unlocked || !vm.data.selectedWalletEntry.bip44Compatible"
                  class="md-primary" ng-click="vm.okButtonClick($event)" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createHEATAccount($event) {
    let self = this;
    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }
      $scope['vm'].okButtonClick = function () {
        const mnemonic = $scope['vm'].heatSeed;
        const pin  = $scope['vm'].pin;

        let account = heat.crypto.getAccountId(mnemonic)
        let publicKey = heat.crypto.secretPhraseToPublicKey(mnemonic)
        let key = {
          account: account,
          secretPhrase: mnemonic,
          pincode: pin,
          name: '',
          publicKey
        };
        self.localKeyStore.add(key);
        $scope.$evalAsync(() => {
          self.initLocalKeyStore()
        })

        $mdDialog.cancel()
      }
      $scope['vm'].generateSeed = function () {
        $scope['vm'].heatSeed = self.lightwalletService.generateRandomSeed()
      };
      $scope['vm'].generateSeed();
      $scope['vm'].copySeed = function () {
        self.clipboard.copyText(document.getElementById('wallet-secret-textarea')['value'], 'Copied seed to clipboard');
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
      <md-dialog>
        <form name="dialogForm">
          <md-toolbar>
            <div class="md-toolbar-tools"><h2>Create HEAT Address</h2></div>
          </md-toolbar>
          <md-dialog-content style="min-width:500px;max-width:700px" layout="column" layout-padding>
            <div flex layout="column">
              <p>This is your HEAT address seed.
                Please store it in a safe place or you may lose access to your HEAT.
                <a ng-click="vm.copySeed()">Copy Seed</a>
              </p>
              <md-input-container flex>
                <textarea id="wallet-secret-textarea" rows="3" flex ng-model="vm.heatSeed" readonly ng-trim="false"
                    style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
              </md-input-container>
              <span style="display:none">{{vm.heatSeed}}</span>
              <md-input-container flex>
                <label>Desired Heatwallet PIN / password</label>
                <input type="password" ng-model="vm.pin" required name="pin">
              </md-input-container>
            </div>
          </md-dialog-content>
          <md-dialog-actions>
            <md-button class="md-primary md-raised" ng-disabled="!vm.pin" ng-click="vm.okButtonClick($event)" aria-label="=Ok">Ok</md-button>
            <md-button class="md-primary md-raised" ng-click="vm.generateSeed($event)" aria-label="Generate New">Generate New</md-button>
            <md-button class="md-warn md-raised" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
          </md-dialog-actions>
        </form>
      </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

  createBCHAccount($event) {
    let walletEntries = this.walletEntries
    let self = this
    if (walletEntries.length == 0)
      return

    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].copySeed = function () {
        self.clipboard.copyText(document.getElementById('wallet-secret-textarea')['value'], 'Copied seed to clipboard');
      }

      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }

      $scope['vm'].okButtonClick = function ($event) {
        let walletEntry = $scope['vm'].data.selectedWalletEntry
        let success = false
        if (walletEntry) {
          let node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'BitcoinCash')
          if (!node) {
            let storage = <StorageService>heat.$inject.get('storage')
            let $rootScope = heat.$inject.get('$rootScope');
            let store = storage.namespace('wallet', $rootScope, true)
            let currencies = store.get(walletEntry.account)
            if (!currencies)
              currencies = []
            currencies.push('BCH')
            store.put(walletEntry.account, currencies.filter((value, index, self) => self.indexOf(value) === index));
            self.initWalletEntry(walletEntry)
          }
          // load in next event loop to load currency addresses first
          setTimeout(() => {
            node = walletEntry.currencies.find(c => c.isCurrencyAddressCreate && c.name == 'BitcoinCash')
            success = node.createBchAddress(self)
            walletEntry.toggle(true)
            $mdDialog.hide(null).then(() => {
              if (!success) {
                dialogs.alert($event, 'Unable to Create Address', 'Make sure you use the previous address first before you can create a new address')
              }
            })
          }, 0)
        }
      }

      $scope['vm'].data = {
        selectedWalletEntry: walletEntries[0],
        selected: walletEntries[0].account,
        walletEntries: walletEntries,
        password: ''
      }

      $scope['vm'].selectedWalletEntryChanged = function () {
        $scope['vm'].data.password = ''
        $scope['vm'].data.selectedWalletEntry = walletEntries.find(w => $scope['vm'].data.selected == w.account)
      }
    }

    let deferred = this.$q.defer<{ password: string, secretPhrase: string }>()
    this.$mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Create Bitcoin Cash Address</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">
                <p>To create a new Bitcoin Cash address, please choose the master HEAT account you want to attach the new Bitcoin Cash address to:</p>

                <!-- Select Master Account -->

                <md-input-container flex>
                  <md-select ng-model="vm.data.selected" ng-change="vm.selectedWalletEntryChanged()">
                    <md-option ng-repeat="entry in vm.data.walletEntries" value="{{entry.account}}">{{entry.identifier}}</md-option>
                  </md-select>
                </md-input-container>

                <!-- Invalid Non BIP44 Seed-->

                <p ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && !vm.data.selectedWalletEntry.bip44Compatible">
                  Btc wallet cannot be added to that old HEAT account. Please choose another or create a new HEAT account with BIP44 compatible seed.
                </p>

                <!-- Valid BIP44 Seed -->
                <div flex layout="column"
                  ng-if="vm.data.selectedWalletEntry && vm.data.selectedWalletEntry.unlocked && vm.data.selectedWalletEntry.bip44Compatible">

                  <p>This is your Bitcoin Cash address seed, It’s the same as for your HEAT account {{vm.data.selectedWalletEntry.account}}.
                      Please store it in a safe place or you may lose access to your Bitcoin Cash.
                      <a ng-click="vm.copySeed()">Copy Seed</a></p>

                  <md-input-container flex>
                    <textarea rows="3" flex ng-model="vm.data.selectedWalletEntry.secretPhrase" readonly ng-trim="false"
                        style="font-family:monospace; font-size:16px; font-weight: bold; color: white; border: 1px solid white"></textarea>
                    <span id="wallet-secret-textarea" style="display:none">{{vm.data.selectedWalletEntry.secretPhrase}}</span>
                  </md-input-container>

                </div>
              </div>

            </md-dialog-content>
            <md-dialog-actions layout="row">
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick($event)" aria-label="Cancel">Cancel</md-button>
              <md-button ng-disabled="!vm.data.selectedWalletEntry || !vm.data.selectedWalletEntry.unlocked || !vm.data.selectedWalletEntry.bip44Compatible"
                  class="md-primary" ng-click="vm.okButtonClick($event)" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }

}
