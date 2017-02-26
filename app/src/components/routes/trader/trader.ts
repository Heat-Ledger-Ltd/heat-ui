/*
 * The MIT License (MIT)
 * Copyright (c) 2016 Heat Ledger Ltd.
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
declare var Big: any;
@RouteConfig('/trader/:currency/:asset')
@Component({
  selector: 'trader',
  inputs: ['currency','asset'],
  template: `
    <div layout="column" flex>
      <trader-volume class="trader-component" currency-info="vm.currencyInfo" asset-info="vm.assetInfo" layout="column"></trader-volume>
    </div>
    <div layout="row" flex layout-fill>
      <md-sidenav class="md-sidenav-left" md-component-id="trader-markets-sidenav"
          md-is-locked-open="vm.marketsSidenavLockedOpen" md-is-open="vm.marketsSidenavOpen"
          md-disable-backdrop flex layout-fill>
        <div layout="column" flex layout-fill>
          <trader-balances layout="column" ng-if="vm.user.unlocked"></trader-balances>
          <trader-markets layout="column" flex layout-fill></trader-markets>
          <trader-trollbox layout="column"></trader-trollbox>
        </div>
      </md-sidenav>
      <div layout="column" flex layout-fill>
        <div layout="column" flex layout-fill class="layout-row">
          <div layout="column" layout-gt-sm="row" flex layout-fill>
            <trader-info class="trader-component" toggle-markets="vm.toggleMarkets" markets-sidenav-open="vm.marketsSidenavOpen" currency-info="vm.currencyInfo" asset-info="vm.assetInfo" flex layout="column" layout-fill></trader-info>
            <trader-chart class="trader-component" flex layout="column" layout-fill currency-info="vm.currencyInfo" asset-info="vm.assetInfo"></trader-chart>
          </div>
        </div>
        <div layout="column" layout-gt-sm="row" flex layout-fill class="layout-row">
          <trader-orders-buy class="trader-component" selected-order="vm.selectedOrder" currency-info="vm.currencyInfo" asset-info="vm.assetInfo" flex layout="column" layout-fill></trader-orders-buy>
          <trader-quick-buy-sell class="trader-component" one-click-orders="vm.oneClickOrders" selected-order="vm.selectedOrder" currency-info="vm.currencyInfo" asset-info="vm.assetInfo" flex layout="column" layout-fill></trader-quick-buy-sell>
          <trader-orders-sell class="trader-component" selected-order="vm.selectedOrder" currency-info="vm.currencyInfo" asset-info="vm.assetInfo" flex layout="column" layout-fill></trader-orders-sell>
        </div>
        <div layout="column" layout-gt-sm="row" flex layout-fill class="layout-row">
          <trader-trade-history class="trader-component" currency-info="vm.currencyInfo" asset-info="vm.assetInfo" flex="40" layout="column" layout-fill></trader-trade-history>
          <trader-orders-my ng-if="vm.user.unlocked" class="trader-component" one-click-orders="vm.oneClickOrders" currency-info="vm.currencyInfo" asset-info="vm.assetInfo" flex="60" layout="column" layout-fill></trader-orders-my>
        </div>
      </div>
    </div>
  `
})
@Inject('$scope','user','$timeout','assetInfo','$mdSidenav')
class TraderComponent {

  currency: string; // @input
  asset: string; // @input

  currencyInfo: AssetInfo;
  assetInfo: AssetInfo;

  oneClickOrders: boolean;

  marketCurrency: string = "0";
  marketSort: string = "change";
  marketAsc: string = "false";

  toggleMarkets: Function;
  marketsSidenavOpen: boolean = true;
  marketsSidenavLockedOpen: boolean = true;

  selectedOrder: IHeatOrder; // the order currently selected in either buy-orders or sell-orders lists.

  constructor(private $scope: angular.IScope,
              public user: UserService,
              private $timeout: angular.ITimeoutService,
              private assetInfoService: AssetInfoService,
              private $mdSidenav: angular.material.ISidenavService) {

    /* @input this is passed as method to trader-info component which has the button to call this action */
    this.toggleMarkets = () => {
      var sidenav = this.$mdSidenav("trader-markets-sidenav");
      if (sidenav.isOpen()) {
        this.marketsSidenavLockedOpen = false;
        sidenav.close();
      }
      else {
        this.marketsSidenavLockedOpen = true;
        sidenav.open();
      }
    };

    // lookup currency and asset info and pass as parameters to child components
    assetInfoService.getInfo(this.currency).then((info) => {
      $scope.$evalAsync(() => {
        this.currencyInfo = info;
      });
    });
    assetInfoService.getInfo(this.asset).then((info) => {
      $scope.$evalAsync(() => {
        this.assetInfo = info;
      });
    });

    this.user.account = user.account || "";
  }
}