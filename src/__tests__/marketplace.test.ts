import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js'
import { NodeWallet } from '@metaplex/js'
import { initMarketplaceSDK, MarketplaceClient } from '../marketplace'
import { OffersClient } from '../offers'
import { ListingsClient } from '../listings'
import { AuctionHouse } from '../types'

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
    let auctionHouse: AuctionHouse
    
    beforeEach(() => {
      auctionHouse = {
        address: '8et18wjPAf9TUsvKrt7wmKxFWjo4tz2rTJoHnuL6PzgX',
        treasuryMint: 'So11111111111111111111111111111111111111112',
        auctionHouseTreasury: 'FqLZuGRWjAX2hWybQidF1USws7xa5MKiiro8afUidrBJ',
        treasuryWithdrawalDestination: 'ohs9X6mPZG3mLqdPheYpEGvvXZkGwVFdV1ec8WbTecV',
        feeWithdrawalDestination: 'ohs9X6mPZG3mLqdPheYpEGvvXZkGwVFdV1ec8WbTecV',
        authority: 'ohs9X6mPZG3mLqdPheYpEGvvXZkGwVFdV1ec8WbTecV',
        creator: 'ohs9X6mPZG3mLqdPheYpEGvvXZkGwVFdV1ec8WbTecV',
        auctionHouseFeeAccount: '2kPTuBsUyao3uT5dtLjVCK5RdvK4CX1cEKMDaxaeugiM',
        bump: 254,
        treasuryBump: 255,
        feePayerBump: 255,
        sellerFeeBasisPoints: 100,
        requiresSignOff: false,
        canChangeSalePrice: false
      }
    })

    describe('#offers', () => {
      it('returns an OffersClient', () => {
        expect(sdk.offers(auctionHouse)).toBeInstanceOf(OffersClient)
      })
    })

    describe('#listings', () => {
      it('returns a ListingsClient', () => {
        expect(sdk.listings(auctionHouse)).toBeInstanceOf(ListingsClient)
      })
    })
  })
})