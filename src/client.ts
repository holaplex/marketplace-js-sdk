import {
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js'
import { programs, Wallet } from '@metaplex/js'
import { updateAuctionHouse } from './instructions'
import { MarktplaceSettingsPayload } from './types'
import ipfsSDK from './ipfs'

const {
  metaplex: { Store, SetStoreV2, StoreConfig },
} = programs

export interface MarketplaceClientParams {
  connection: Connection
  wallet: Wallet
}

export class Client {
  private connection: Connection
  private wallet: Wallet

  constructor({ connection, wallet }: MarketplaceClientParams) {
    this.connection = connection
    this.wallet = wallet
  }

  async update(
    settings: MarktplaceSettingsPayload,
    transactionFee: number
  ): Promise<void> {
    const wallet = this.wallet
    const publicKey = wallet.publicKey as PublicKey
    const connection = this.connection

    const storePubkey = await Store.getPDA(publicKey)
    const storeConfigPubkey = await StoreConfig.getPDA(storePubkey)

    settings.address.store = storePubkey.toBase58()
    settings.address.storeConfig = storeConfigPubkey.toBase58()
    settings.address.owner = publicKey.toBase58()

    const storefrontSettings = new File(
      [JSON.stringify(settings)],
      'storefront_settings'
    )
    const { uri } = await ipfsSDK.uploadFile(storefrontSettings)

    const auctionHouseUpdateInstruction = await updateAuctionHouse({
      wallet: wallet as Wallet,
      sellerFeeBasisPoints: transactionFee,
    })

    const setStorefrontV2Instructions = new SetStoreV2(
      {
        feePayer: publicKey,
      },
      {
        admin: publicKey,
        store: storePubkey,
        config: storeConfigPubkey,
        isPublic: false,
        settingsUri: uri,
      }
    )
    const transaction = new Transaction()

    if (auctionHouseUpdateInstruction) {
      transaction.add(auctionHouseUpdateInstruction)
    }

    transaction.add(setStorefrontV2Instructions)
    transaction.feePayer = publicKey
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash

    const signedTransaction = await wallet.signTransaction(transaction)
    const txtId = await connection.sendRawTransaction(
      signedTransaction.serialize()
    )

    if (txtId) await connection.confirmTransaction(txtId, 'confirmed')
  }
}

export const initMarketplaceSDK = (
  connection: Connection,
  wallet: Wallet
): Client => {
  return new Client({ connection, wallet })
}
