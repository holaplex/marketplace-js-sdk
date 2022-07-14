import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { programs, Wallet } from '@metaplex/js'
import { createAuctionHouse, updateAuctionHouse } from './instructions'
import { MarktplaceSettingsPayload, AuctionHouse } from './types'
import ipfsSDK from './ipfs'
import { Client } from './client'
import { OffersClient } from './offers'
import { ListingsClient } from './listings'
import { createWithdrawFromTreasuryInstruction } from '@metaplex-foundation/mpl-auction-house/dist/src/generated/instructions'
import { EscrowClient } from './escrow'
import { PendingTransaction } from './transaction'

const {
  metaplex: { Store, SetStoreV2, StoreConfig },
} = programs

export interface MarketplaceClientParams {
  connection: Connection
  wallet: Wallet
}

export class MarketplaceClient extends Client {
  async create(settings: MarktplaceSettingsPayload, transactionFee: number) {
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

    const auctionHouseCreateInstruction = await createAuctionHouse({
      wallet: wallet as any,
      sellerFeeBasisPoints: transactionFee,
      treasuryWithdrawalDestination: this.wallet.publicKey.toBase58(),
      feeWithdrawalDestination: this.wallet.publicKey.toBase58(),
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

    transaction.add(auctionHouseCreateInstruction)
    transaction.add(setStorefrontV2Instructions)

    transaction.feePayer = wallet.publicKey as any
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash

    const signedTransaction = await wallet.signTransaction(transaction)

    const txtId = await connection.sendRawTransaction(
      signedTransaction.serialize()
    )

    if (txtId) await connection.confirmTransaction(txtId)
  }

  async update(
    settings: MarktplaceSettingsPayload,
    transactionFee: number
  ): Promise<PendingTransaction> {
    const wallet = this.wallet
    const publicKey = wallet.publicKey as PublicKey
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
    return [transaction, []]
  }

  async claimFunds(ah: AuctionHouse) {
    const wallet = this.wallet
    const publicKey = wallet.publicKey as PublicKey
    const connection = this.connection
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const auctionHouseTreasury = new PublicKey(ah.auctionHouseTreasury)

    const treasuryWithdrawalDestination = new PublicKey(
      ah.treasuryWithdrawalDestination
    )

    const auctionHouseTreasuryBalance = await connection.getBalance(
      auctionHouseTreasury
    )

    const withdrawFromTreasuryInstructionAccounts = {
      treasuryMint,
      authority,
      treasuryWithdrawalDestination,
      auctionHouseTreasury,
      auctionHouse,
    }
    const withdrawFromTreasuryInstructionArgs = {
      amount: auctionHouseTreasuryBalance,
    }

    const withdrawFromTreasuryInstruction =
      createWithdrawFromTreasuryInstruction(
        withdrawFromTreasuryInstructionAccounts,
        withdrawFromTreasuryInstructionArgs
      )

    const txt = new Transaction()

    txt.add(withdrawFromTreasuryInstruction)

    txt.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
    txt.feePayer = publicKey

    let signed: Transaction | undefined = undefined

    signed = await wallet.signTransaction(txt)

    let signature: string | undefined = undefined

    signature = await connection.sendRawTransaction(signed.serialize())

    await connection.confirmTransaction(signature, 'confirmed')
  }

  offers(auctionHouse: AuctionHouse): OffersClient {
    return new OffersClient(this.connection, this.wallet, auctionHouse)
  }

  listings(auctionHouse: AuctionHouse): ListingsClient {
    return new ListingsClient(this.connection, this.wallet, auctionHouse)
  }

  escrow(auctionHouse: AuctionHouse): EscrowClient {
    return new EscrowClient(this.connection, this.wallet, auctionHouse)
  }
}

export const initMarketplaceSDK = (
  connection: Connection,
  wallet: Wallet
): MarketplaceClient => {
  return new MarketplaceClient(connection, wallet)
}
