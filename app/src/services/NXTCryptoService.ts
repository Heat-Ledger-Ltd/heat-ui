@Service('nxtCryptoService')
@Inject('$window')
class NXTCryptoService {

  private nxtCrypto;

  constructor(private $window: angular.IWindowService) {
    this.nxtCrypto = $window.heatlibs.nxtCrypto;
  }

  /* Sets the seed to this wallet */
  unlock(seedOrPrivateKey: any): Promise<WalletType> {
    return new Promise((resolve, reject) => {
      let walletType = { addresses: [] }
      walletType.addresses[0] = { address: this.nxtCrypto.getAccountRSFromSecretPhrase(seedOrPrivateKey, 'NXT'), privateKey: seedOrPrivateKey }
      resolve(walletType);
    });
  }

  refreshAdressBalances(wallet: WalletType) {
    let address = wallet.addresses[0].address
    return new Promise((resolve, reject) => {
      let nxtBlockExplorerService: NxtBlockExplorerService = heat.$inject.get('nxtBlockExplorerService')
      nxtBlockExplorerService.getAccount(wallet.addresses[0].address).then(data => {
        wallet.addresses[0].balance = new Big(utils.convertToQNTf(data.unconfirmedBalanceNQT)).toFixed(8);
        wallet.addresses[0].inUse = true;
        nxtBlockExplorerService.getAccountAssets(address).then(accountAssets => {
          wallet.addresses[0].tokensBalances = []
          let promises = []
          accountAssets.forEach(asset => {
            let promise = nxtBlockExplorerService.getAssetInfo(asset.asset).then(assetInfo => {
              wallet.addresses[0].tokensBalances.push({
                symbol: assetInfo?assetInfo.name:'',
                name: assetInfo?assetInfo.name:'',
                decimals: assetInfo.decimals,
                balance: utils.formatQNT(asset.unconfirmedQuantityQNT,assetInfo.decimals),
                address: asset.asset
              })
            })
            promises.push(promise)
          });

          Promise.all(promises).then(() => resolve(true))

          if(accountAssets.length === 0)
            resolve(true)
        })
      }, err => {
        resolve(false)
      })
    })
  }
}