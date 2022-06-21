import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import {
  SYSVAR_INSTRUCTIONS_PUBKEY,
  PublicKey,
  Transaction,
  Connection,
  TransactionInstruction,
  AccountMeta,
} from '@solana/web3.js'
import { Wallet } from '@metaplex/js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Client } from './client'
import { PendingTransaction } from './transaction'
import { AuctionHouse, Nft, Listing, Creator } from './types'

const { instructions } = AuctionHouseProgram

const {
  createSellInstruction,
  createPrintListingReceiptInstruction,
  createPublicBuyInstruction,
  createPrintBidReceiptInstruction,
  createExecuteSaleInstruction,
  createPrintPurchaseReceiptInstruction,
  createCancelInstruction,
  createCancelListingReceiptInstruction,
} = instructions

export interface PostListingParams {
  amount: number
  nft: Nft
}

export interface CancelListingParams {
  listing: Listing
  nft: Nft
}

export interface BuyListingParams {
  listing: Listing
  nft: Nft
}

export class ListingsClient extends Client {
  private auctionHouse: AuctionHouse

  constructor(
    connection: Connection,
    wallet: Wallet,
    auctionHouse: AuctionHouse
  ) {
    super(connection, wallet)

    this.auctionHouse = auctionHouse
  }

  async post({ amount, nft }: PostListingParams): Promise<PendingTransaction> {
    const { publicKey, signTransaction } = this.wallet
    const ah = this.auctionHouse
    const buyerPrice = amount
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const tokenMint = new PublicKey(nft.mintAddress)
    const metadata = new PublicKey(nft.address)

    const associatedTokenAccount = new PublicKey(
      nft.owner.associatedTokenAccountAddress
    )

    const [sellerTradeState, tradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        associatedTokenAccount,
        treasuryMint,
        tokenMint,
        buyerPrice,
        1
      )

    const [programAsSigner, programAsSignerBump] =
      await AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress()

    const [freeTradeState, freeTradeBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        associatedTokenAccount,
        treasuryMint,
        tokenMint,
        0,
        1
      )

    const txt = new Transaction()

    const sellInstructionArgs = {
      tradeStateBump,
      freeTradeStateBump: freeTradeBump,
      programAsSignerBump: programAsSignerBump,
      buyerPrice,
      tokenSize: 1,
    }

    const sellInstructionAccounts = {
      wallet: publicKey,
      tokenAccount: associatedTokenAccount,
      metadata: metadata,
      authority: authority,
      auctionHouse: auctionHouse,
      auctionHouseFeeAccount: auctionHouseFeeAccount,
      sellerTradeState: sellerTradeState,
      freeSellerTradeState: freeTradeState,
      programAsSigner: programAsSigner,
    }

    const sellInstruction = createSellInstruction(
      sellInstructionAccounts,
      sellInstructionArgs
    )

    const [receipt, receiptBump] =
      await AuctionHouseProgram.findListingReceiptAddress(sellerTradeState)

    const printListingReceiptInstruction = createPrintListingReceiptInstruction(
      {
        receipt,
        bookkeeper: publicKey,
        instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
      },
      {
        receiptBump,
      }
    )

    txt.add(sellInstruction).add(printListingReceiptInstruction)

    return [txt, []]
  }

  async cancel({ listing, nft }: CancelListingParams): Promise<PendingTransaction> {
    const { publicKey, signTransaction } = this.wallet
    const ah = this.auctionHouse
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const tokenMint = new PublicKey(nft.mintAddress)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const receipt = new PublicKey(listing.address)
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)

    const buyerPrice = listing.price.toNumber()

    const [tradeState] = await AuctionHouseProgram.findTradeStateAddress(
      publicKey,
      auctionHouse,
      tokenAccount,
      treasuryMint,
      tokenMint,
      buyerPrice,
      1
    )

    const cancelInstructionAccounts = {
      wallet: publicKey,
      tokenAccount,
      tokenMint,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      tradeState,
    }
    const cancelInstructionArgs = {
      buyerPrice,
      tokenSize: 1,
    }

    const cancelListingReceiptAccounts = {
      receipt,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    }

    const cancelInstruction = createCancelInstruction(
      cancelInstructionAccounts,
      cancelInstructionArgs
    )
    const cancelListingReceiptInstruction =
      createCancelListingReceiptInstruction(cancelListingReceiptAccounts)

    const txt = new Transaction()

    txt.add(cancelInstruction).add(cancelListingReceiptInstruction)

    return [txt, []]
  }

  async buy({ listing, nft }: BuyListingParams): Promise<PendingTransaction> {
    const { publicKey } = this.wallet
    const ah = this.auctionHouse
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const seller = new PublicKey(listing.seller)
    const tokenMint = new PublicKey(nft.mintAddress)
    const auctionHouseTreasury = new PublicKey(ah.auctionHouseTreasury)
    const listingReceipt = new PublicKey(listing.address)
    const sellerTradeState = new PublicKey(listing.tradeState)
    const buyerPrice = listing.price.toNumber()
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)
    const metadata = new PublicKey(nft.address)
    const isNative = treasuryMint.equals(NATIVE_MINT)

    let sellerPaymentReceiptAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryMint,
      seller,
    )

    if (isNative) {
      sellerPaymentReceiptAccount = seller
    }

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        publicKey
      )

    const [buyerTradeState, _tradeStateBump] =
      await AuctionHouseProgram.findPublicBidTradeStateAddress(
        publicKey,
        auctionHouse,
        treasuryMint,
        tokenMint,
        buyerPrice,
        1
      )
    const [freeTradeState, freeTradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        seller,
        auctionHouse,
        tokenAccount,
        treasuryMint,
        tokenMint,
        0,
        1
      )
    const [programAsSigner, programAsSignerBump] =
      await AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress()
    const [buyerReceiptTokenAccount] =
      await AuctionHouseProgram.findAssociatedTokenAccountAddress(
        tokenMint,
        publicKey
      )

    const [bidReceipt, _bidReceiptBump] =
      await AuctionHouseProgram.findBidReceiptAddress(buyerTradeState)
    const [purchaseReceipt, purchaseReceiptBump] =
      await AuctionHouseProgram.findPurchaseReceiptAddress(
        sellerTradeState,
        buyerTradeState
      )

    const executeSaleInstructionAccounts = {
      buyer: publicKey,
      seller,
      tokenAccount,
      tokenMint,
      metadata,
      treasuryMint,
      escrowPaymentAccount,
      sellerPaymentReceiptAccount,
      buyerReceiptTokenAccount,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      auctionHouseTreasury,
      buyerTradeState,
      sellerTradeState,
      freeTradeState,
      programAsSigner,
    }

    const executeSaleInstructionArgs = {
      escrowPaymentBump,
      freeTradeStateBump,
      programAsSignerBump,
      buyerPrice,
      tokenSize: 1,
    }

    const printPurchaseReceiptAccounts = {
      bookkeeper: publicKey,
      purchaseReceipt,
      bidReceipt,
      listingReceipt,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    }
    const printPurchaseReceiptArgs = {
      purchaseReceiptBump,
    }

    const executeSaleInstruction = createExecuteSaleInstruction(
      executeSaleInstructionAccounts,
      executeSaleInstructionArgs
    )
    const printPurchaseReceiptInstruction =
      createPrintPurchaseReceiptInstruction(
        printPurchaseReceiptAccounts,
        printPurchaseReceiptArgs
      )

    const txt = new Transaction()

    let remainingAccounts: AccountMeta[] = []

    for (let creator of nft.creators) {
      const creatorAccount = {
        pubkey: new PublicKey(creator.address),
        isSigner: false,
        isWritable: true,
      }
      remainingAccounts = [...remainingAccounts, creatorAccount]

      if (isNative) {
        continue
      }

      const pubkey = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryMint,
        creatorAccount.pubkey
      )

      const creatorAtaAccount = {
        pubkey,
        isSigner: false,
        isWritable: true
      }

      remainingAccounts = [...remainingAccounts, creatorAtaAccount]
    }

    txt
      .add(
        new TransactionInstruction({
          programId: AuctionHouseProgram.PUBKEY,
          data: executeSaleInstruction.data,
          keys: executeSaleInstruction.keys.concat(remainingAccounts),
        })
      )
      .add(printPurchaseReceiptInstruction)

    return [txt, []]
  }
}
