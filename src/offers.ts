import { Client } from './client'
import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import {
  SYSVAR_INSTRUCTIONS_PUBKEY,
  PublicKey,
  Transaction,
  Connection,
  TransactionInstruction,
} from '@solana/web3.js'
import { AuctionHouse, Nft, Offer, Listing, Creator } from './types'
import { Wallet } from '@metaplex/js'

const { instructions } = AuctionHouseProgram
const {
  createDepositInstruction,
  createPrintBidReceiptInstruction,
  createPublicBuyInstruction,
  createCancelBidReceiptInstruction,
  createCancelInstruction,
  createWithdrawInstruction,
  createSellInstruction,
  createPrintListingReceiptInstruction,
  createExecuteSaleInstruction,
  createPrintPurchaseReceiptInstruction,
  createCancelListingReceiptInstruction,
} = instructions

export interface MakeOfferParams {
  amount: number
  nft: Nft
}

export interface CancelOfferParams {
  amount: number
  offer: Offer
  nft: Nft
}

export interface AcceptOfferParams {
  offer: Offer
  nft: Nft
  cancel?: Listing[]
}

export class OffersClient extends Client {
  private auctionHouse: AuctionHouse

  constructor(
    connection: Connection,
    wallet: Wallet,
    auctionHouse: AuctionHouse
  ) {
    super(connection, wallet)

    this.auctionHouse = auctionHouse
  }

  async make({ amount, nft }: MakeOfferParams): Promise<OffersClient> {
    const { publicKey, signTransaction } = this.wallet
    const connection = this.connection
    const ah = this.auctionHouse
    const buyerPrice = amount
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const tokenMint = new PublicKey(nft.mintAddress)
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)
    const metadata = new PublicKey(nft.address)

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        publicKey
      )

    const [buyerTradeState, tradeStateBump] =
      await AuctionHouseProgram.findPublicBidTradeStateAddress(
        publicKey,
        auctionHouse,
        treasuryMint,
        tokenMint,
        buyerPrice,
        1
      )

    const txt = new Transaction()

    const depositInstructionAccounts = {
      wallet: publicKey,
      paymentAccount: publicKey,
      transferAuthority: publicKey,
      treasuryMint,
      escrowPaymentAccount,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
    }
    const depositInstructionArgs = {
      escrowPaymentBump,
      amount: buyerPrice,
    }

    const depositInstruction = createDepositInstruction(
      depositInstructionAccounts,
      depositInstructionArgs
    )

    const publicBuyInstruction = createPublicBuyInstruction(
      {
        wallet: publicKey,
        paymentAccount: publicKey,
        transferAuthority: publicKey,
        treasuryMint,
        tokenAccount,
        metadata,
        escrowPaymentAccount,
        authority,
        auctionHouse,
        auctionHouseFeeAccount,
        buyerTradeState,
      },
      {
        escrowPaymentBump,
        tradeStateBump,
        tokenSize: 1,
        buyerPrice,
      }
    )

    const [receipt, receiptBump] =
      await AuctionHouseProgram.findBidReceiptAddress(buyerTradeState)

    const printBidReceiptInstruction = createPrintBidReceiptInstruction(
      {
        receipt,
        bookkeeper: publicKey,
        instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
      },
      {
        receiptBump,
      }
    )

    txt
      .add(depositInstruction)
      .add(publicBuyInstruction)
      .add(printBidReceiptInstruction)

    this.addTransaction(txt)
    return this
  }

  async cancel({ nft, offer }: CancelOfferParams): Promise<OffersClient> {
    const ah = this.auctionHouse
    const { publicKey, signTransaction } = this.wallet
    const connection = this.connection
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const tokenMint = new PublicKey(nft.mintAddress)
    const receipt = new PublicKey(offer.address)
    const buyerPrice = offer.price.toNumber()
    const tradeState = new PublicKey(offer.tradeState)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        publicKey
      )

    const txt = new Transaction()

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

    const cancelBidReceiptInstructionAccounts = {
      receipt: receipt,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    }

    const cancelBidInstruction = createCancelInstruction(
      cancelInstructionAccounts,
      cancelInstructionArgs
    )

    const cancelBidReceiptInstruction = createCancelBidReceiptInstruction(
      cancelBidReceiptInstructionAccounts
    )

    const withdrawInstructionAccounts = {
      receiptAccount: publicKey,
      wallet: publicKey,
      escrowPaymentAccount,
      auctionHouse,
      authority,
      treasuryMint,
      auctionHouseFeeAccount,
    }

    const withdrawInstructionArgs = {
      escrowPaymentBump,
      amount: buyerPrice,
    }

    const withdrawInstruction = createWithdrawInstruction(
      withdrawInstructionAccounts,
      withdrawInstructionArgs
    )

    txt
      .add(cancelBidInstruction)
      .add(cancelBidReceiptInstruction)
      .add(withdrawInstruction)

    this.addTransaction(txt)
    return this
  }

  async accept({
    offer,
    nft,
    cancel,
  }: AcceptOfferParams): Promise<OffersClient> {
    const { publicKey, signTransaction } = this.wallet
    const connection = this.connection
    const ah = this.auctionHouse

    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const tokenMint = new PublicKey(nft.mintAddress)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const auctionHouseTreasury = new PublicKey(ah.auctionHouseTreasury)
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)
    const bidReceipt = new PublicKey(offer.address)
    const buyerPubkey = new PublicKey(offer.buyer)
    const metadata = new PublicKey(nft.address)

    const [sellerTradeState, sellerTradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        tokenAccount,
        treasuryMint,
        tokenMint,
        offer.price.toNumber(),
        1
      )

    const [buyerTradeState] =
      await AuctionHouseProgram.findPublicBidTradeStateAddress(
        buyerPubkey,
        auctionHouse,
        treasuryMint,
        tokenMint,
        offer.price.toNumber(),
        1
      )

    const [purchaseReceipt, purchaseReceiptBump] =
      await AuctionHouseProgram.findPurchaseReceiptAddress(
        sellerTradeState,
        buyerTradeState
      )

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        buyerPubkey
      )

    const [programAsSigner, programAsSignerBump] =
      await AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress()

    const [freeTradeState, freeTradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        tokenAccount,
        treasuryMint,
        tokenMint,
        0,
        1
      )

    const [buyerReceiptTokenAccount] =
      await AuctionHouseProgram.findAssociatedTokenAccountAddress(
        tokenMint,
        buyerPubkey
      )

    const [listingReceipt, listingReceiptBump] =
      await AuctionHouseProgram.findListingReceiptAddress(sellerTradeState)

    const sellInstructionAccounts = {
      wallet: publicKey,
      tokenAccount,
      metadata,
      authority,
      auctionHouse: auctionHouse,
      auctionHouseFeeAccount: auctionHouseFeeAccount,
      sellerTradeState: sellerTradeState,
      freeSellerTradeState: freeTradeState,
      programAsSigner: programAsSigner,
    }

    const sellInstructionArgs = {
      tradeStateBump: sellerTradeStateBump,
      freeTradeStateBump: freeTradeStateBump,
      programAsSignerBump: programAsSignerBump,
      buyerPrice: offer.price,
      tokenSize: 1,
    }

    const printListingReceiptInstructionAccounts = {
      receipt: listingReceipt,
      bookkeeper: publicKey,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    }

    const printListingReceiptInstructionArgs = {
      receiptBump: listingReceiptBump,
    }

    const executeSaleInstructionAccounts = {
      buyer: buyerPubkey,
      seller: publicKey,
      auctionHouse,
      tokenAccount,
      tokenMint,
      treasuryMint,
      metadata,
      authority,
      sellerTradeState,
      buyerTradeState,
      freeTradeState,
      sellerPaymentReceiptAccount: publicKey,
      escrowPaymentAccount,
      buyerReceiptTokenAccount,
      auctionHouseFeeAccount,
      auctionHouseTreasury,
      programAsSigner,
    }
    const executeSaleInstructionArgs = {
      escrowPaymentBump,
      freeTradeStateBump,
      programAsSignerBump,
      buyerPrice: offer.price,
      tokenSize: 1,
    }
    const executePrintPurchaseReceiptInstructionAccounts = {
      purchaseReceipt,
      listingReceipt,
      bidReceipt,
      bookkeeper: publicKey,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    }

    const executePrintPurchaseReceiptInstructionArgs = {
      purchaseReceiptBump: purchaseReceiptBump,
    }

    const createListingInstruction = createSellInstruction(
      sellInstructionAccounts,
      sellInstructionArgs
    )
    const createPrintListingInstruction = createPrintListingReceiptInstruction(
      printListingReceiptInstructionAccounts,
      printListingReceiptInstructionArgs
    )
    const executeSaleInstruction = createExecuteSaleInstruction(
      executeSaleInstructionAccounts,
      executeSaleInstructionArgs
    )
    const executePrintPurchaseReceiptInstruction =
      createPrintPurchaseReceiptInstruction(
        executePrintPurchaseReceiptInstructionAccounts,
        executePrintPurchaseReceiptInstructionArgs
      )

    const txt = new Transaction()

    txt
      .add(createListingInstruction)
      .add(createPrintListingInstruction)
      .add(
        new TransactionInstruction({
          programId: AuctionHouseProgram.PUBKEY,
          data: executeSaleInstruction.data,
          keys: executeSaleInstruction.keys.concat(
            nft.creators.map((creator: Creator) => ({
              pubkey: new PublicKey(creator.address),
              isSigner: false,
              isWritable: true,
            }))
          ),
        })
      )
      .add(executePrintPurchaseReceiptInstruction)

    if (cancel) {
      cancel.forEach((listing) => {
        const cancelInstructionAccounts = {
          wallet: publicKey,
          tokenAccount,
          tokenMint,
          authority,
          auctionHouse,
          auctionHouseFeeAccount,
          tradeState: new PublicKey(listing.tradeState),
        }
        const cancelListingInstructionArgs = {
          buyerPrice: listing.price,
          tokenSize: 1,
        }

        const cancelListingReceiptAccounts = {
          receipt: new PublicKey(listing.address),
          instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
        }

        const cancelListingInstruction = createCancelInstruction(
          cancelInstructionAccounts,
          cancelListingInstructionArgs
        )

        const cancelListingReceiptInstruction =
          createCancelListingReceiptInstruction(cancelListingReceiptAccounts)

        txt.add(cancelListingInstruction).add(cancelListingReceiptInstruction)
      })
    }

    this.addTransaction(txt)
    return this
  }
}
