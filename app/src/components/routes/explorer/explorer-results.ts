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
@RouteConfig('/explorer-results/:type/','/explorer-results/:type/:query')
@Component({
  selector: 'explorerResults',
  inputs: ['type','query'],
  template: `
    <div layout="column" flex layout-padding layout-fill>
      <explorer-search layout="column" type="vm.type" query="vm.query"></explorer-search>
      <div layout="row" layout-align="start center" class="type-row">
        <md-button ng-class="{'active':vm.type=='accounts'}"
          ng-disabled="vm.type=='accounts'"
          ng-href="#/explorer-results/accounts/{{vm.query}}">Accounts</md-button>
        <md-button ng-class="{'active':vm.type=='blocks'}"
          ng-disabled="vm.type=='blocks'"
          ng-href="#/explorer-results/blocks/{{vm.query}}">Blocks</md-button>
        <md-button ng-class="{'active':vm.type=='transactions'}"
          ng-disabled="vm.type=='transactions'"
          ng-href="#/explorer-results/transactions/{{vm.query}}">Transactions</md-button>
      </div>
      <explorer-results-accounts query="vm.query" flex layout="column"></explorer-results-accounts>
    </div>
  `
})
@Inject('$scope','heat')
class ExplorerResultsComponent {
  type: string; // @input
  query: string; // @input

  constructor(private $scope: angular.IScope,
              private heat: HeatService) {
  }
}