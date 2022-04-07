import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js'
import { NodeWallet } from '@metaplex/js'
import { initMarketplaceSDK, Client } from '../client'

test('initMarketplaceSDK', () => {
  const connection = new Connection(clusterApiUrl('devnet'))
  const wallet = new NodeWallet(Keypair.generate())

  const sdk = initMarketplaceSDK(connection, wallet)

  expect(sdk).toBeInstanceOf(Client)
})