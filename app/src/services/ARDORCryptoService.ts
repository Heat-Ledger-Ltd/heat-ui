@Service('ardorCryptoService')
@Inject('$window', 'user')
class ARDORCryptoService {

  private nxtCrypto;

  constructor(private $window: angular.IWindowService,
              private user: UserService) {
    this.nxtCrypto = $window.heatlibs.nxtCrypto;
  }

  /* Sets the seed to this wallet */
  unlock(seedOrPrivateKey: any): Promise<WalletType> {
    return new Promise((resolve, reject) => {
      let walletType = { addresses: [] }
      let publicKey = this.nxtCrypto.getPublicKey(seedOrPrivateKey)
      let address = this.nxtCrypto.getAccountRSFromSecretPhrase(seedOrPrivateKey, 'ARDOR')
      let accountId = this.nxtCrypto.getAccountId(publicKey)
      walletType.addresses[0] = { address: address, privateKey: seedOrPrivateKey, accountId: accountId }
      resolve(walletType);
    });
  }

  refreshAdressBalances(wallet: WalletType) {
    let userAccount = wallet.addresses[0].accountId;
    return new Promise((resolve, reject) => {
      let ardorBlockExplorerService: ArdorBlockExplorerService = heat.$inject.get('ardorBlockExplorerService')
      ardorBlockExplorerService.getTransactions(userAccount,0,10).then(transactions => {
        if(transactions.length != 0) {
          ardorBlockExplorerService.getBalance(userAccount).then(balance => {
            wallet.addresses[0].balance = new Big(utils.convertToQNTf(balance)).toFixed(8);
            wallet.addresses[0].inUse = true;
            ardorBlockExplorerService.getAccountAssets(userAccount).then(accountAssets => {
              wallet.addresses[0].tokensBalances = []
              accountAssets.forEach(asset => {
                wallet.addresses[0].tokensBalances.push({
                  symbol: asset?asset.name:'',
                  name: asset?asset.name:'',
                  decimals: asset.decimals,
                  balance: utils.formatQNT(asset.unconfirmedQuantityQNT,asset.decimals),
                  address: asset.asset
                })
              });
              resolve(true)
            })
          })
        } else {
          resolve(false)
        }
      })
    })
  }
}