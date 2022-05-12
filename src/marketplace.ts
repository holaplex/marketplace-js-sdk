import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { programs, Wallet } from '@metaplex/js'
import { updateAuctionHouse } from './instructions'
import { MarktplaceSettingsPayload, AuctionHouse } from './types'
import ipfsSDK from './ipfs'
import { Client } from './client'
import { OffersClient } from './offers'
import { ListingsClient } from './listings'
import { NATIVE_MINT } from '@solana/spl-token'
import { AuctionHouseProgram } from '@holaplex/mpl-auction-house'
import { createCreateAuctionHouseInstruction } from '@holaplex/mpl-auction-house/dist/src/generated/instructions'
import { SalesClient } from './sales'
import { AdminClient } from './admin'

const {
  metaplex: { Store, SetStoreV2, StoreConfig },
} = programs

export interface MarketplaceClientParams {
  connection: Connection
  wallet: Wallet
}

export class MarketplaceClient extends Client {
  async create() {
    throw Error('Not implemented')
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

    settings.address.owner = publicKey.toBase58()
    settings.address.store = storePubkey.toBase58()
    settings.address.storeConfig = storeConfigPubkey.toBase58()

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

  offers(auctionHouse: AuctionHouse): OffersClient {
    return new OffersClient(this.connection, this.wallet, auctionHouse)
  }

  listings(auctionHouse: AuctionHouse): ListingsClient {
    return new ListingsClient(this.connection, this.wallet, auctionHouse)
  }

  sales(auctionHouse: AuctionHouse): SalesClient {
    return new SalesClient(this.connection, this.wallet, auctionHouse)
  }

  admin(): AdminClient {
    return new AdminClient(this.connection, this.wallet)
  }

  async createAuctionHouses(
    tokens: { address: string }[],
    sellerFeeBasisPoints: number
  ): Promise<{ address: string }[]> {
    const wallet = this.wallet as Wallet
    const publicKey = wallet.publicKey as PublicKey
    const connection = this.connection

    const auctionHouses: { address: string }[] = []
    const instructions: TransactionInstruction[] = []

    tokens.forEach(async (token) => {
      const canChangeSalePrice = false
      const requiresSignOff = false
      const treasuryWithdrawalDestination = undefined
      const feeWithdrawalDestination = undefined
      const treasuryMint = token.address

      const twdKey = treasuryWithdrawalDestination
        ? new PublicKey(treasuryWithdrawalDestination)
        : wallet.publicKey

      const fwdKey = feeWithdrawalDestination
        ? new PublicKey(feeWithdrawalDestination)
        : wallet.publicKey

      const tMintKey = treasuryMint ? new PublicKey(treasuryMint) : NATIVE_MINT

      const twdAta = tMintKey.equals(NATIVE_MINT)
        ? twdKey
        : (
            await AuctionHouseProgram.findAssociatedTokenAccountAddress(
              tMintKey,
              twdKey
            )
          )[0]

      const [auctionHouse, bump] =
        await AuctionHouseProgram.findAuctionHouseAddress(
          wallet.publicKey,
          tMintKey
        )

      auctionHouses.push({ address: auctionHouse.toBase58() })

      const [feeAccount, feePayerBump] =
        await AuctionHouseProgram.findAuctionHouseFeeAddress(auctionHouse)

      const [treasuryAccount, treasuryBump] =
        await AuctionHouseProgram.findAuctionHouseTreasuryAddress(auctionHouse)

      const auctionHouseCreateInstruction = createCreateAuctionHouseInstruction(
        {
          treasuryMint: tMintKey,
          payer: wallet.publicKey,
          authority: wallet.publicKey,
          feeWithdrawalDestination: fwdKey,
          treasuryWithdrawalDestination: twdAta,
          treasuryWithdrawalDestinationOwner: twdKey,
          auctionHouse,
          auctionHouseFeeAccount: feeAccount,
          auctionHouseTreasury: treasuryAccount,
        },
        {
          bump,
          feePayerBump,
          treasuryBump,
          sellerFeeBasisPoints,
          requiresSignOff,
          canChangeSalePrice,
        }
      )
      instructions.push(auctionHouseCreateInstruction)
    })

    const transaction = new Transaction()

    instructions.forEach((instruction: TransactionInstruction) => {
      transaction.add(instruction)
    })

    transaction.feePayer = publicKey
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash()
    ).blockhash

    const signedTransaction = await this.wallet.signTransaction!(transaction)
    const txtId = await connection.sendRawTransaction(
      signedTransaction.serialize()
    )

    if (txtId) await connection.confirmTransaction(txtId, 'confirmed')

    return auctionHouses
  }
}

export const initMarketplaceSDK = (
  connection: Connection,
  wallet: Wallet
): MarketplaceClient => {
  return new MarketplaceClient(connection, wallet)
}
