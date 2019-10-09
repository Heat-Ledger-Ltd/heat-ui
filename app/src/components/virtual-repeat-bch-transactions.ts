///<reference path='VirtualRepeatComponent.ts'/>

@Component({
  selector: 'virtualRepeatBchTransactions',
  inputs: ['account'],
  template: `
    <div layout="column" flex layout-fill>
      <div layout="row" class="trader-component-title" ng-hide="vm.hideLabel">Latest Transactions
      </div>
      <md-list flex layout-fill layout="column">
        <md-list-item class="header">

          <!-- DATE -->
          <div class="truncate-col date-col left">Time</div>

          <!-- TX ID  -->
          <div class="truncate-col tx-col left">Transaction ID</div>

          <!-- FROM -->
          <div class="truncate-col info-col left">FROM</div>

          <!-- TO -->
          <div class="truncate-col info-col left">TO</div>

          <!-- AMOUNT -->
          <div class="truncate-col amount-col right">Amount</div>

          <!-- JSON -->
          <div class="truncate-col json-col"></div>

        </md-list-item>
        <md-virtual-repeat-container md-top-index="vm.topIndex" flex layout-fill layout="column" virtual-repeat-flex-helper>
          <md-list-item md-virtual-repeat="item in vm" md-on-demand aria-label="Entry" class="row">

            <!-- DATE -->
            <div class="truncate-col date-col left">{{item.dateTime}}</div>

            <!-- TX ID -->
            <div class="truncate-col tx-col left" >
              <span>
                <a target="_blank" href="https://bch1.heatwallet.com/tx/{{item.txid}}">{{item.txid}}</a>
              </span>
            </div>

            <!-- FROM -->
            <div class="truncate-col info-col left">
              <span ng-show = "item.from !== 'Multiple Inputs'">{{item.from}}</span>
              <a ng-show = "item.from === 'Multiple Inputs'" ng-click="vm.jsonDetails($event, item.json)">{{item.from}}</a>
            </div>

            <!-- TO -->
            <div class="truncate-col info-col left">
              <span ng-show = "item.to !== 'Multiple Outputs'">{{item.to}}</span>
              <a ng-show = "item.to === 'Multiple Outputs'" ng-click="vm.jsonDetails($event, item.json)">{{item.to}}</a>
            </div>

            <!-- AMOUNT -->
            <div class="truncate-col amount-col right">
              <span>{{item.amount}}</span>
            </div>

            <!-- JSON -->
            <div class="truncate-col json-col">
              <a ng-click="vm.jsonDetails($event, item.json)">
                <md-icon md-font-library="material-icons">code</md-icon>
              </a>
            </div>

          </md-list-item>
        </md-virtual-repeat-container>
      </md-list>
    </div>
  `
})

@Inject('$scope', '$q', 'bchTransactionsProviderFactory', 'settings', 'bchPendingTransactions', 'user', 'bitcoinMessagesService')
class VirtualRepeatBchTransactionsComponent extends VirtualRepeatComponent {

  account: string; // @input
  constructor(protected $scope: angular.IScope,
    protected $q: angular.IQService,
    private bchTransactionsProviderFactory: BchTransactionsProviderFactory,
    private settings: SettingsService,
    private bchPendingTransactions: BchPendingTransactionsService,
    private user: UserService) {
    super($scope, $q);
    var format = this.settings.get(SettingsService.DATEFORMAT_DEFAULT);

    this.initializeVirtualRepeat(
      this.bchTransactionsProviderFactory.createProvider(this.account),
      /* decorator function */
      (transaction: any) => {
        transaction.txid = transaction.txid;
        transaction.dateTime = dateFormat(new Date(transaction.blockTime * 1000), format);

        let totalInputs = transaction.vin.length; //Total number of inputs
        let totalOutputs = transaction.vout.length;

        let inputAmount = 0; //Total amount in input for current address
        let inputs = '';
        for (let i = 0; i < transaction.vin.length; i++) {
          if (transaction.vin[i].isAddress) {
            if (transaction.vin[i].addresses[0] === this.account) {
              inputAmount += parseFloat(transaction.vin[i].value)
            }
            inputs += `
            ${transaction.vin[i].addresses[0]} (${(parseFloat(transaction.vin[i].value) / 100000000).toFixed(8)})`;
          }
        }

        if (transaction.vin.length === 1) {
          if (transaction.vin[0].isAddress) {
            transaction.from = transaction.vin[0].addresses[0].substr(0, 40).concat('...')
          } else {
            transaction.from = 'Block Mined'
          }
        } else {
          transaction.from = 'Multiple Inputs'
        }

        let outputAmount = 0; //Total amount in output for current address
        let outputs = '';
        for (let i = 0; i < transaction.vout.length; i++) {
          if (transaction.vout[i].addresses[0] === this.account) {
            outputAmount += parseFloat(transaction.vout[i].value)
          }
          outputs += `
          ${transaction.vout[i].addresses[0]} (${(parseFloat(transaction.vout[i].value) / 100000000).toFixed(8)})`;
        }

        if (transaction.vout.length == 1) {
          transaction.to = transaction.vout[0].addresses[0].substr(0, 40).concat('...')
        } else {
          if (transaction.vout.length === 2 && outputs.indexOf(this.account) > -1) {
            if (inputs.indexOf(this.account) > -1) {
              transaction.to = transaction.vout[0].addresses[0] === this.account ?
                transaction.vout[1].addresses[0] : transaction.vout[0].addresses[0];
            } else {
              transaction.to = transaction.vout[0].addresses[0] === this.account ?
                transaction.vout[0].addresses[0] : transaction.vout[1].addresses[0];
            }
            transaction.to = transaction.to.substr(0, 40).concat('...')
          } else {
            transaction.to = 'Multiple Outputs';
          }
        }

        if (inputs.indexOf(this.account) > -1) {
          transaction.amount = `-${(inputAmount / 100000000).toFixed(8)}`;
        } else {
          transaction.amount = `${(outputAmount / 100000000).toFixed(8)}`;
        }

        transaction.json = {
          txid: transaction.txid,
          time: transaction.dateTime,
          block: transaction.blockHeight,
          totalInputs,
          totalOutputs,
          confirmations: transaction.confirmations,
          fees: (parseFloat(transaction.fees) / 100000000).toFixed(8),
          inputs: inputs.trim(),
          outputs: outputs.trim()
        }
      }
    );

    var refresh = utils.debounce(angular.bind(this, this.determineLength), 500, false);
    let timeout = setTimeout(refresh, 10 * 1000)

    let listener = this.determineLength.bind(this)
    this.PAGE_SIZE = 10;
    bchPendingTransactions.addListener(listener)

    $scope.$on('$destroy', () => {
      bchPendingTransactions.removeListener(listener)
      clearTimeout(timeout)
    })
  }

  jsonDetails($event, item) {
    dialogs.jsonDetails($event, item, 'Transaction: ' + item.txid);
  }


  onSelect(selectedTransaction) { }
}