import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js'
import { NodeWallet } from '@metaplex/js'
import { initMarketplaceSDK, MarketplaceClient } from '../marketplace'
import { OffersClient } from '../offers'
import { ListingsClient } from '../listings'

describe('marketplaces', () => {
  let sdk: MarketplaceClient

  beforeEach(() => {
    const connection = new Connection(clusterApiUrl('devnet'))
    const wallet = new NodeWallet(Keypair.generate())
  
    sdk = initMarketplaceSDK(connection, wallet)
  })

  describe('initMarketplaceSDK', () => {
    it('returns a new MarketplaceClient', () => {
      expect(sdk).toBeInstanceOf(MarketplaceClient)
    })
  })
  
  describe('MarketplaceClient', () => {
    describe('#offers', () => {
      it('returns the OffersClient', () => {
        expect(sdk.offers()).toBeInstanceOf(OffersClient)
      })
    })

    describe('#listings', () => {
      it('returns the ListingsClient', () => {
        expect(sdk.listings()).toBeInstanceOf(ListingsClient)
      })
    })
  })
})